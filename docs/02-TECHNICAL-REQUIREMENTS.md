# 02 — Technical Requirements Document (TRD)

## Stack
- **Backend**: Python 3.11+, Flask (configured for Vercel Serverless Functions)
- **Database**: Supabase (Managed cloud PostgreSQL 15+) with Row Level Security (RLS) & Connection Pooling
- **Frontend**: HTML5, Modern CSS, Vanilla JavaScript (or React/Next.js UI) deployed to Vercel's Global Edge CDN
- **Scheduling**: Vercel Cron triggering an authenticated `/api/cron/sync` endpoint with `CRON_SECRET` validation (hourly sync)
- **Auth**: Password hashing (`werkzeug.security` or Supabase Auth) with secure HTTP-only cookies and RLS policies in PostgreSQL

## Functional requirements
FR1. Sync opportunities from Brabble on a schedule (not per-request).
FR2. Normalize Brabble fields into an internal schema decoupled from Brabble's exact shape.
FR3. Serve opportunities via internal REST endpoints with search/filter/sort/pagination.
FR4. Authenticate students (register/login/logout) with hashed passwords.
FR5. Let authenticated students bookmark/un-bookmark opportunities.
FR6. Let authenticated students set and change an application status per opportunity.
FR7. Compute and expose dashboard aggregates (counts, upcoming deadlines).
FR8. Accept user opportunity submissions into a pending queue.
FR9. Let an admin-role user approve/reject/edit/delete submissions and opportunities.
FR10. Never call Brabble from the browser; the API key stays server-side only.

## Non-functional requirements
NFR1. Brabble usage must stay well under 1,000 requests/day (target: a few dozen/day).
NFR2. All timestamps stored in UTC; displayed to the user converted to IST.
NFR3. Responsive layout: desktop, tablet, mobile.
NFR4. No secrets committed to git; `.env` is gitignored, `.env.example` documents the shape.
NFR5. All DB queries parameterized — no string-built SQL.
NFR6. Errors shown to users never leak stack traces or internal paths.
NFR7. Code must stay readable: no framework beyond Flask, no unnecessary abstraction layers.

## External dependency
Brabble API (`brabble.ai`) — see `08-EXTERNAL-API-INTEGRATION.md` for the full, verified
contract. This is a hard dependency; the app has no other opportunity data source in MVP.

## Out of scope (explicitly, per anti-overbuild rule)
React/Vue, microservices, Kubernetes, Redis, WebSockets, AI recommendation engine,
payment processing, real-time notifications.
