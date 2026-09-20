# OpportunityOS

A student-focused discovery and personal-tracking platform ("Student Career Operating System") for hackathons, coding contests, case competitions, and innovation challenges open to college students in India. Built as a high-impact, production-grade portfolio project.

## Status
- **Phase 1 Complete**: API verification, comprehensive architecture & technical documentation in `/docs`.
- **Phase 2 Complete**: Repository initialized, security hardening (`.gitignore`, `.env.example`), and AI handoff context setup in `/context`.
- **Next Phase**: Supabase Database Schema creation and Brabble Ingestion pipeline.

## Data Source
- **[Brabble API](https://brabble.ai/developers)** — Verified live and documented in `docs/08-EXTERNAL-API-INTEGRATION.md`.
- 1,000 requests/day, single endpoint (`GET /api/listings`), hourly-refreshed.
- Ingestion occurs strictly server-side via scheduled sync into Supabase; browser clients never query Brabble or touch API credentials.

## Tech Stack
- **Frontend**: HTML5 / Modern CSS / Vanilla JavaScript (or React/Next.js UI) deployed to **Vercel Edge Network**.
- **Backend**: Python (Flask / Serverless Functions) deployed on **Vercel**.
- **Database**: **Supabase (Managed PostgreSQL)** with Row Level Security (RLS) and connection pooling.
- **Automation / Sync**: **Vercel Cron** invoking `/api/cron/sync` hourly to ingest new opportunities.

## Security Rules
- All secret keys (`BRABBLE_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SECRET_KEY`, `CRON_SECRET`) are stored strictly in `.env` (locally) and Vercel Environment Variables (in production).
- Browser clients only ever receive `SUPABASE_ANON_KEY`, protected by Row Level Security policies.
- Parameterized SQL queries prevent SQL injection.

## Documentation
See `/docs` for the complete engineering specifications:
- `01-PRODUCT-REQUIREMENTS.md` & `02-TECHNICAL-REQUIREMENTS.md`
- `03-SYSTEM-ARCHITECTURE.md`
- `06-DATABASE-DESIGN.md` (PostgreSQL schemas & RLS policies)
- `08-EXTERNAL-API-INTEGRATION.md` (Brabble API details)
- `10-SECURITY.md` (DevSecOps, key isolation, OWASP)
- `13-DEPLOYMENT.md` (Vercel + Supabase deployment guide)
- `14-ENVIRONMENT-VARIABLES.md`
- `15-DEVELOPMENT-ROADMAP.md`
- `context/PROJECT_STATE.md` (Master AI handoff & session continuity)

## Setup (Local Development)
1. Copy `.env.example` to `.env` and fill in:
   - `BRABBLE_API_KEY` (from [brabble.ai/dashboard](https://brabble.ai/dashboard))
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` (from Supabase dashboard)
   - `SECRET_KEY` and `CRON_SECRET`
2. `pip install -r requirements.txt` (once backend implementation begins).
3. Apply Supabase database migrations (`docs/06-DATABASE-DESIGN.md`).
4. Run manual sync to populate initial opportunities: `python sync.py`.
5. Run the development server.

## License
Student portfolio project — not affiliated with Brabble.ai or any listed platform.

