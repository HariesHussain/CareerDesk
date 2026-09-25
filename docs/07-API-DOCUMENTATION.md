# 07 — Internal API Documentation (OpportunityOS REST API)

Base path: `/api`. All responses JSON. Auth via secure session cookies or JWT bearer tokens.
This documents OUR endpoints — not Brabble's (that is documented in `08-EXTERNAL-API-INTEGRATION.md`).


## GET /api/opportunities
Public. List opportunities from the local DB (never calls Brabble live).

Query params (all optional):
- `q` — substring match on title/organiser
- `category` — one of the normalized categories actually present in the DB
- `mode` — ONLINE / OFFLINE / HYBRID
- `city` — matches stored city text
- `free` — `true` to filter fee == "Free"
- `sort` — `deadline` (default) / `newest` / `alphabetical`
- `limit` — default 20, max 100
- `offset` — default 0

Response:
```
{
  "total": 214,
  "count": 20,
  "offset": 0,
  "limit": 20,
  "opportunities": [ { ...normalized fields, see 06-DATABASE-DESIGN.md... } ]
}
```

## GET /api/opportunities/<id>
Public. Full detail for one opportunity (internal `id`, not Brabble's `external_id`). 404 if
not found or not `status="approved"`.

## POST /api/auth/register
Body: `{ "email": "...", "password": "..." }`. Creates a student user, hashes password,
starts a session. 400 on invalid email/weak password, 409 if email exists.

## POST /api/auth/login
Body: `{ "email": "...", "password": "..." }`. Starts session on success, 401 on failure.

## POST /api/auth/logout
Ends the session.

## GET /api/bookmarks
Auth required. Returns the current user's bookmarked opportunities (joined with
opportunity data).

## POST /api/bookmarks
Auth required. Body: `{ "opportunity_id": 123 }`. Creates a bookmark; idempotent (409 or
no-op if already bookmarked — decide and document consistently in code).

## DELETE /api/bookmarks/<opportunity_id>
Auth required. Removes the bookmark.

## GET /api/applications
Auth required. Returns the current user's tracked applications with status.

## POST /api/applications
Auth required. Body: `{ "opportunity_id": 123, "status": "Applied" }`. Upserts status for
that (user, opportunity) pair. 400 if status isn't one of the allowed enum values.

## GET /api/dashboard
Auth required. Returns aggregate counts: total saved, total applied, upcoming deadlines
(next N, from bookmarked/applied opportunities only), status breakdown.

## POST /api/submissions
Auth required. Body: submission form fields (see `06-DATABASE-DESIGN.md`). Creates a
`pending` submission. 400 on missing required fields or invalid URL.

## GET /api/admin/submissions
Admin only. Lists pending (and optionally all) submissions. 403 if not admin.

## POST /api/admin/submissions/<id>/approve
Admin only. Marks submission approved, creates the public `opportunities` row, logs an
`admin_actions` entry.

## POST /api/admin/submissions/<id>/reject
Admin only. Body: `{ "reason": "..." }` optional. Marks rejected, logs admin action.

## DELETE /api/admin/opportunities/<id>
Admin only. Deletes/hides an opportunity, logs admin action.

## GET /api/cron/sync
Protected. Triggered by Vercel Cron or manual admin maintenance.
Headers required: `Authorization: Bearer <CRON_SECRET>` (or query param `?token=<CRON_SECRET>`).
Returns:
```json
{
  "status": "success",
  "fetched": 909,
  "inserted": 24,
  "updated": 110,
  "duration_ms": 1420
}
```
Unauthorized requests receive `401 Unauthorized`.

## Error format (all endpoints)
```
{ "error": "human-readable message" }
```
No stack traces, no internal paths, ever (see `11-ERROR-HANDLING.md`).

