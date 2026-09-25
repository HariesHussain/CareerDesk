# 19 — Troubleshooting

## Sync job fails with 401
Your `BRABBLE_API_KEY` is missing or invalid. Regenerate at brabble.ai/dashboard →
Developer settings, update `.env`, restart the app (Flask only reads env vars at startup).

## Sync job fails with 429
Daily 1,000-request limit hit. There's no `Retry-After` header — compute next midnight IST
and wait; check `sync_logs` to see how the quota got used up (likely a bug causing
excessive calls, since normal sync uses ~120/day).

## Opportunities look stale
Check `GET /api/admin/sync-status` (or `sync_logs` directly) for `finished_at` and
`status`. If the last successful sync is more than a few hours old, the scheduler may have
stopped — check the host's scheduled-task logs.

## A field is missing/different from what's documented
Brabble's docs warn their contract can change without notice. Check the actual raw
response (temporarily log it), compare to `08-EXTERNAL-API-INTEGRATION.md`, and update the
normalizer + this doc together — don't silently patch around it.

## Deadlines look wrong by a few hours
Almost always a timezone bug — confirm the stored value is UTC and the conversion to IST
happens only at display time, once, in one place (not scattered across the codebase).

## Can't create an admin account
There is no public "become admin" endpoint by design. Set `role = 'admin'` directly on the student user row in the Supabase Table Editor (`users` table) during setup.

## Supabase connection error: "Too many connections"
In serverless environments, always connect using Supabase's **Transaction Connection Pooler** (Port `6543` via `pgbouncer`) rather than the direct database port (`5432`). Ensure `DATABASE_URL` uses port `6543` with `?pgbouncer=true`.

## Supabase: "Row Level Security policy violated"
If queries fail with permission errors, check Supabase Dashboard → Authentication / Policies. Ensure your serverless sync script uses `SUPABASE_SERVICE_ROLE_KEY` (which safely bypasses RLS for batch upserts) while user queries authenticate with their student session token.

## Vercel Cron returns 401 Unauthorized
Check that your cron trigger includes the matching `Authorization: Bearer <CRON_SECRET>` or `?token=<CRON_SECRET>` header configured in Vercel environment variables.

## Vercel Function Timeout (504 Gateway Timeout)
Vercel Hobby plan functions time out after 10–15 seconds. If Brabble sync exceeds this during initial population of 900+ listings, page through listings with smaller batches (`limit=50` with sequential offsets) or run the initial population script locally via `python sync.py`.

## Frontend shows nothing but the API returns data
Check the browser console for JavaScript errors before assuming a backend problem — a broken `fetch` handler or CORS mismatch will fail silently without a visible error banner.

