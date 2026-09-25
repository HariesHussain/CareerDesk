# 08 — External API Integration: Brabble

**Status: VERIFIED via live authenticated request on 2026-09-20, plus official docs at
https://brabble.ai/developers and https://brabble.ai/docs. This file is the single source
of truth for how our app talks to Brabble — nothing here is invented.**

## Endpoint
`GET https://brabble.ai/api/listings` — the only endpoint. No `/v1/` prefix exists.

## Auth
Send the key as either header (both checked every request):
```
Authorization: Bearer brbl_<64 hex chars>
x-api-key: brbl_<64 hex chars>
```
Key obtained once, manually, from `https://brabble.ai/dashboard` → Developer settings, and
stored as `BRABBLE_API_KEY` in `.env` (never committed, never sent to the browser).

## Query parameters (all optional)
| param | values | notes |
|---|---|---|
| `hub` | hackathons, case-competitions, coding-contests, school-students, college-students | last two match eligibility text, not type |
| `city` | delhi-ncr, indore, hyderabad, pune, ahmedabad, bhopal, bengaluru, mumbai, chennai, kolkata, jaipur, lucknow | excludes ONLINE listings entirely |
| `platform` | unstop, devpost, devfolio, mlh, dorahacks, hackerearth, hack-club, ethglobal, internshala, codeforces, codechef, leetcode | exact match |
| `type` | HACKATHON, CASE STUDY, CONTEST, CODING, INNOVATION, DESIGN, COMPETITION, QUIZ | server-side exact match |
| `mode` | ONLINE, OFFLINE, HYBRID | |
| `free` | `true` | fee exactly "Free" |
| `q` | any string | substring on title+organiser |
| `limit` | 1–200, default 50 | invalid/negative -> default; >200 clamped |
| `offset` | default 0, max 10000 | |

Unknown `hub`/`city`/`platform` value → `400`, not an empty list.

## Verified live response shape (2026-09-20, real data)
```json
{
  "refreshedAt": "2026-09-20T05:02:50.441Z",
  "origin": "store",
  "total": 909,
  "count": 5,
  "offset": 0,
  "limit": 5,
  "listings": [
    {
      "id": "unstop-1752029",
      "title": "Moxie - Quizora",
      "organiser": "Muzaffarpur Institute of Technology (MIT), Muzaffarpur",
      "type": "COMPETITION",
      "kind": "competition",
      "platform": "Unstop",
      "url": "https://unstop.com/quiz/...",
      "shareUrl": "https://brabble.ai/s/unstop-1752029",
      "deadline": "2026-09-20T05:30:00.000Z",
      "mode": "ONLINE",
      "city": "Remote",
      "prize": { "label": "See listing", "inr": null },
      "team": "1",
      "fee": "Free",
      "eligibility": ["Engineering Students", "Postgraduate", "Undergraduate"],
      "registered": 403
    }
  ],
  "attribution": "Free to use, including commercially. Please credit Brabble.ai and link back where a reader can see it.",
  "docs": "https://brabble.ai/developers"
}
```
This confirms (not assumed): `total=909` at capture time, `city` can be the literal string
`"Remote"` (not just empty), `type=COMPETITION` and `type=HACKATHON` and `type=DESIGN`
appear in real data, `prize.label` really is `"See listing"` for a large share of rows
exactly as the docs warned, paid entries exist (`fee: "Paid entry"`, not only "Free"),
and `team` can be a range string like `"1 to 4"`.

## Field semantics that MUST be handled correctly (documented gotchas)
- `kind`: `"competition"` → `deadline` = when applications close. `"contest"` →
  `deadline` = when it starts. The normalizer must branch on this before writing any
  user-facing "X days left" text.
- `prize.label` is frequently `"See listing"` with `prize.inr = null` — the UI must handle
  this gracefully, not display "null" or an empty prize badge.
- `city` can be `""`, `"Remote"`, or a real city name — don't assume it's always a place.
- Expired listings are already excluded by Brabble before they reach us — our own
  `is_expired` flag only needs to catch listings that disappear *between* our syncs, or
  that we choose to keep for historical application records.

## Rate limits
1,000 requests/day per key, resets midnight IST. Every 200 response carries
`x-ratelimit-limit` / `x-ratelimit-remaining`. On `429`, there is **no `Retry-After`
header** — the client must compute time-to-next-midnight-IST itself.

## Sync strategy (stays far under 1,000/day)
- Full paginated sweep (limit=200) once per hour, matching Brabble's own hourly refresh
  cadence — roughly 5 requests/hour to cover ~909 listings = ~120/day, well under the cap.
- Read `x-ratelimit-remaining` on every response; if it drops below a safety threshold
  (e.g. 100), stop syncing for the rest of the day and log a warning to `sync_logs`.
- No per-user-request calls to Brabble ever — the frontend only ever talks to our own
  `/api/opportunities`.

## Errors
| status | meaning | handling |
|---|---|---|
| 400 | bad query param | should never happen in our own client; log as a bug if it does |
| 401 | missing/invalid key | fail sync loudly, alert via sync_logs `status="failure"` |
| 429 | over daily limit | stop syncing until next IST midnight, log it |
| 5xx | upstream failure | retry with backoff; if still failing, keep last-known-good DB data |

## Fair use obligations (binding on our implementation)
- Cache what we fetch — never call Brabble per page-load.
- Every page that shows Brabble-sourced opportunities must display the attribution string
  and link back (`shareUrl` or `docs` link) where a reader can see it.
- Registration must always happen on the organiser's own `url` — we never collect entries
  or fees ourselves.
- We may reuse rows (including commercially) but must not republish the whole dataset as
  though we assembled it ourselves, and must not strip the caveats attached to prize/count
  figures (e.g. `registered` is "not comparable across platforms" per the docs).

## Known open item
`type`/`hub` enums have no `INTERNSHIP` value, and none appeared in the verified sample
despite Internshala being a listed source platform. **UNKNOWN — VERIFY** before adding
internships to any future roadmap phase; do not build internship filters against
unconfirmed data.

## Versioning risk
Brabble's own docs state auth was added to a previously-open endpoint without a version
bump or advance notice, and there is no published deprecation policy. Our client
(`brabble_client.py`) must be written defensively: pin only to fields we use, and treat any
unexpected 4xx/5xx or missing field as a loud, logged failure — never a silent guess.
