# 15 — Development Roadmap (OpportunityOS)

- **Phase 0 — API Verification** ✅ COMPLETE (live authenticated Brabble request confirmed 2026-09-20; see `08-EXTERNAL-API-INTEGRATION.md`)
- **Phase 1 — Documentation & Branding** ✅ COMPLETE (specifications, schemas, and OpportunityOS rebranding)
- **Phase 2 — Project Setup & Security Controls** ✅ COMPLETE (Git initialized, security-hardened `.gitignore`, `.env.example`, and AI handoff context in `/context`)
- **Phase 3 — Supabase Database Architecture**: apply PostgreSQL schema migrations, indexes, and Row Level Security (RLS) policies
- **Phase 4 — Brabble Ingestion Engine**: `brabble_client.py` (pagination, retry, rate limit respect), `normalizer.py` (defensive schema mapping), and `sync.py` (Supabase upsert + `sync_logs`)
- **Phase 5 — Backend REST API**: opportunity search/filter/sort/pagination endpoints (`/api/opportunities`), detail view, and authenticated `/api/cron/sync`
- **Phase 6 — Frontend Discovery Hub**: modern UI layout, fast search & tag filters, rich opportunity cards, deadline badges, responsive mobile layout
- **Phase 7 — Authentication & Student Profiles**: secure signup/login, session handling, password hashing
- **Phase 8 — Personal Career OS Features**: bookmarks, application tracking pipeline (Saved → Applied → Interview → Selected), dashboard aggregates
- **Phase 9 — Submission & Admin Moderation**: community opportunity submissions, admin approval queue
- **Phase 10 — Automated Testing & Verification**: pytest suite for API, sync normalizer, RLS verification, manual QA pass
- **Phase 11 — Security & DevSecOps Audit**: complete security checklist from `10-SECURITY.md` (no leaked keys, anti-IDOR, SQLi checks)
- **Phase 12 — Vercel Deployment & Cron Automation**: Vercel deployment, environment variables setup, Vercel Cron verification
- **Phase 13 — Final Handoff & Portfolio Presentation**: finalize live demo links, repository walkthrough, and interview talking points

Each phase follows the disciplined workflow:
1. Review specification & `context/PROJECT_STATE.md`.
2. Implement cleanly without extraneous abstractions.
3. Test & verify.
4. Git commit after every single logical change.
5. Update `context/PROJECT_STATE.md` to maintain continuity.

