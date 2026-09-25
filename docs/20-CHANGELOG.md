# 20 — Changelog

## 2026-09-20
- **branding**: Officially renamed project to **OpportunityOS** ("Student Career Operating System").
- **arch**: Upgraded production stack architecture from local SQLite to **Supabase (Managed PostgreSQL 15+)** and **Vercel Edge & Serverless Functions** with **Vercel Cron**.
- **security**: Hardened `.gitignore` to prevent any `.env`, `.pem`, or credentials leak; created comprehensive `.env.example` with Supabase pooler credentials and `CRON_SECRET`.
- **context**: Created living AI handoff guide (`context/PROJECT_STATE.md`) ensuring seamless session continuity across AI assistants and limit refreshes.
- **git**: Initialized Git repository and established commit-per-change protocol.
- **docs**: Updated documentation suite (`01-PRD`, `02-TRD`, `03-Architecture`, `06-Database`, `07-API`, `10-Security`, `13-Deployment`, `14-Env`, `15-Roadmap`, `16-Decisions`, `17-Explanation`, `18-Interview-Prep`, `19-Troubleshooting`).

## Previous
- Phase 0 (API verification) complete: Brabble API confirmed live via authenticated request on 2026-09-20; total 909 listings observed.
- Scope decision recorded: internships excluded from MVP pending further API verification.

