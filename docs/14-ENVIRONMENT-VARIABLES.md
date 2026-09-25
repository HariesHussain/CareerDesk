# 14 — Environment Variables Specification

All configuration for OpportunityOS is managed via environment variables.

| Variable | Required | Example | Purpose | Security Tier |
|---|---|---|---|---|
| `BRABBLE_API_KEY` | **Yes** | `brbl_<64 hex chars>` | Authenticates server-side calls to Brabble API listings | **Critical Secret** (Server-only) |
| `SUPABASE_URL` | **Yes** | `https://xyz.supabase.co` | Supabase project API & database gateway | Public / App config |
| `SUPABASE_ANON_KEY` | **Yes** | `eyJhbGciOi...` | Supabase public anonymous key (enforced by RLS) | Client-safe |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | `eyJhbGciOi...` | Supabase privileged admin key for background sync ingestion | **Critical Secret** (Server-only) |
| `DATABASE_URL` | **Yes** | `postgresql://postgres...` | Connection pooler URI (Port 6543) for serverless queries | **Critical Secret** (Server-only) |
| `SECRET_KEY` | **Yes** | 64-char random hex | Session signing & cryptographic hash security | **Critical Secret** (Server-only) |
| `CRON_SECRET` | **Yes** | 32-char random string | Authorizes Vercel Cron requests to `/api/cron/sync` | **Critical Secret** (Server-only) |
| `FLASK_ENV` | No | `development` / `production` | Debug mode toggle (`production` in deployed environments) | Configuration |
| `SYNC_INTERVAL_MINUTES` | No | `60` | Ingestion cadence (matches Brabble's hourly updates) | Configuration |

See `.env.example` in the project root for the literal file template. `.env` itself is strictly git-ignored and must never be committed.

