# 18 — Interview Preparation (OpportunityOS)

## Architectural & Tech Stack Choices
- **Why Vercel + Supabase instead of SQLite on Render/Railway?**
  * *First-hand insight*: "Free-tier hosts like Render spin down after 15 minutes of inactivity, causing 50–60 second cold-start delays that hurt the recruiter impression. Vercel runs on a global edge CDN with instant page loads. Furthermore, Vercel serverless functions have ephemeral filesystems, meaning a local SQLite file would wipe user bookmarks and tracking data upon restarts. Supabase provides managed cloud PostgreSQL with persistent storage, connection pooling, and Row Level Security."
- **Why PostgreSQL over SQLite?**
  * PostgreSQL provides strict relational integrity, concurrent write handling, JSONB query capabilities for eligibility filters, and database-level security via Row Level Security (RLS).
- **How do you handle PostgreSQL connection limits in a serverless environment?**
  * "Serverless functions scale dynamically by creating multiple function instances. Direct Postgres connections (port 5432) can quickly exhaust database connection limits. To solve this, OpportunityOS connects through Supabase's transaction pooler (`pgbouncer` on port 6543), reusing connections efficiently."
- **What is Row Level Security (RLS)?**
  * "RLS is a PostgreSQL feature that restricts which rows a user can SELECT, INSERT, UPDATE, or DELETE based on their authenticated user ID. Even if an attacker guessed an ID or manipulated an API call, PostgreSQL itself enforces that users can only touch their own bookmarks and application records."

## Data Ingestion & Security
- **Explain the complete architecture.**
  * Browser ↔ Vercel Edge CDN ↔ Vercel Serverless REST API ↔ Supabase PostgreSQL DB, with an hourly Vercel Cron job triggering `/api/cron/sync` to pull listings from Brabble.ai into Supabase.
- **What happens when a user opens the Discover page?**
  * Frontend calls `GET /api/opportunities`, serverless handler queries Supabase PostgreSQL (never calls Brabble live), returns JSON, and frontend renders opportunity cards.
- **Why don't you call Brabble directly from JavaScript?**
  * "Calling Brabble from the browser would leak our private `BRABBLE_API_KEY` in client-side code and exhaust Brabble's 1,000 requests/day limit. Ingestion happens strictly server-side once an hour."
- **How do you protect the API keys?**
  * "All sensitive secrets (`BRABBLE_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`) live strictly in `.env` for local testing and Vercel Encrypted Environment Variables in production. Only the public `SUPABASE_ANON_KEY` is client-safe, protected by RLS."
- **How do you prevent duplicate opportunities?**
  * "We enforce a UNIQUE index on `external_id` (Brabble's ID) and use `ON CONFLICT (external_id) DO UPDATE` to upsert records cleanly."


## Backend
- **What is a Flask route?** A Python function bound to a URL pattern and HTTP method that
  returns a response.
- **GET/POST/PUT/PATCH/DELETE?** Read / create / full-update / partial-update / remove —
  standard REST verbs mapped to our endpoints (see `07-API-DOCUMENTATION.md`).

## Security
- **Why can't the API key be in frontend JS?** Anything sent to the browser can be read by
  the user (view-source, devtools) — it would no longer be secret.
- **What is SQL injection?** Attacker-supplied input altering a SQL query's meaning because
  it was concatenated into the query string instead of passed as a parameter; we avoid it
  by always using parameterized queries.
- **How do you validate URLs?** Check the submitted `official_url` parses as a well-formed
  `http(s)://` URL before storing it.
- **How do you protect admin routes?** Every admin route checks `session["role"] == 
  "admin"` server-side before doing anything — never trust a hidden frontend button alone.

## Debugging (realistic scenarios)
- Sync job ran but `/api/opportunities` returns stale data → check `sync_logs` for the
  last successful run and its `finished_at`/`error_message`.
- A student can't log in → check whether the password hash comparison is failing vs. the
  email lookup failing; never reveal which to the user, but log the distinction server-side.
- Deadline showing the wrong countdown → check whether that listing's `kind` is `"contest"`
  (deadline = start time) but the UI is treating it like `"competition"` (deadline = close
  time).
