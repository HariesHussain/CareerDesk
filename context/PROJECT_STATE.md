# 🚀 OpportunityOS — AI Master Context & Handoff Document

> **NOTE FOR ANY AI ASSISTANT (Claude, GPT, etc.):**  
> Read this document first before generating or modifying any code. It contains the single source of truth for **OpportunityOS**, current implementation status, architectural rules, and exact next steps. Do not hallucinate external packages or deviate from this specification.

---

## 1. Project Overview & Identity
* **Project Name**: **OpportunityOS** *(formerly "Campus Opportunity Hub" in early drafts)*
* **Target Audience**: College students & graduates in India looking for hackathons, coding contests, case competitions, and innovation challenges.
* **Core Value Proposition**: An all-in-one "student career OS" that aggregates live verified opportunities from multiple platforms via Brabble API, lets students search/filter with zero lag, and personalizes tracking (bookmarking, application status tracking, reminders).
* **Target Outcome**: A stellar portfolio project that demonstrates production-ready full-stack architecture, clean API integration, secure database design, and 100% uptime for recruiters.

---

## 2. Locked Production Tech Stack
* **Frontend**: Responsive UI (HTML5 / Modern CSS / Vanilla JS or React) deployed to **Vercel Edge CDN** (0s spin-up, instant global caching).
* **Backend**: Python (Flask / Serverless Functions) deployed on **Vercel**.
* **Database**: **Supabase (Managed PostgreSQL 15+)**:
  * Persistent cloud storage with Connection Pooling (`pgbouncer` on port 6543 for serverless).
  * Row Level Security (RLS) protecting student bookmarks, applications, and profile records.
* **External Ingestion Source**: **Brabble API** (`GET https://brabble.ai/api/listings`):
  * Refreshed hourly on Brabble's end.
  * Free tier: 1,000 requests/day.
  * Server-side authentication only (`BRABBLE_API_KEY`), never sent to the browser.
* **Sync Mechanism**: **Vercel Cron** hitting `/api/cron/sync` (protected with `CRON_SECRET`) hourly.

---

## 3. Current Implementation Status
* **Phase 0 (API Verification)**: ✅ Complete (Brabble API live test verified).
* **Phase 1 (Documentation & Rebranding)**: ✅ Complete (OpportunityOS branding updated across all docs).
* **Phase 2 (Repo & Security Hardening)**: ✅ Complete (Git initialized, security-hardened `.gitignore`, `.env.example` created, commit-per-change protocol established).
* **Phase 3 (Database Schema)**: ✅ Complete (7 Supabase migrations: 6 tables + RLS policies via MCP).
* **Phase 4 (Project Scaffold)**: ✅ Complete (Flask app factory, `vercel.json`, Supabase client).
* **Phase 5 (Brabble Sync Engine)**: ✅ Complete (BrabbleClient, normalizer, sync orchestrator).
* **Phase 6 (REST API)**: ✅ Complete (12 endpoints: opportunities, auth, bookmarks, applications, dashboard, submissi* **Phase 7 (Middleware & Security)**: ✅ Complete (auth decorators, rate limiter, input validators).
* **Phase 7.5 (Supabase Auth Migration & DB Cleanup)**: ✅ Complete (Dropped 26 legacy hospital tables, migrated from Flask sessions to Supabase Auth Google SSO only, created `opp_profiles` linked to `auth.users(id)` with automated trigger, Bearer JWT validation in middleware).
* **Frontend**: ⏳ **NOT STARTED YET** (Phase 8 is next).

---

## 4. Master Development Roadmap

| Phase | Milestone | Description | Status |
| :---: | :--- | :--- | :--- |
| **0** | **API Verification** | Verified Brabble API endpoints, parameters, and live data | ✅ Done |
| **1** | **Spec Documentation** | Requirements, schemas, and security documented in `/docs` | ✅ Done |
| **2** | **Project Setup & Handoff** | Renamed to OpportunityOS, created context handoff system, git init | ✅ Done |
| **3** | **Database Schema (Supabase)** | Initial tables + RLS policies | ✅ Done |
| **4** | **Backend Scaffold** | Flask app factory, `vercel.json`, Supabase client factory (service_role + anon) | ✅ Done |
| **5** | **Brabble Sync Engine** | `brabble_client.py` (paginated, rate-limited), `normalizer.py`, `sync.py` (upsert + expire) | ✅ Done |
| **6** | **REST API (12 endpoints)** | Opportunities search/filter, auth, bookmarks, applications, dashboard, submissions, admin CRUD, cron sync | ✅ Done |
| **7** | **Security Middleware** | `login_required`/`admin_required` decorators, per-IP rate limiter, URL/input validators | ✅ Done |
| **7.5** | **Supabase Auth & DB Cleanup** | Dropped 26 legacy tables, Google SSO only, `opp_profiles` with `auth.users` trigger, Bearer JWT middleware | ✅ Done |
| **8** | **Frontend Discovery UI** | Next.js / Vite UI, Supabase Google sign-in, opportunity search & filter, bookmarks & Kanban tracker | ⏳ Next |
| **9** | **Vercel Deployment & Cron** | Live URL, Vercel Cron setup for automated sync | ⏳ Upcoming |

---

## 5. Critical Technical Constraints & Security Rules
1. **Zero Keys in Code**: All API keys, connection strings, and tokens must ONLY exist in `.env` (locally) and Vercel Environment Variables (in production). Never hardcode secrets.
2. **Never Expose `BRABBLE_API_KEY` or `SUPABASE_SERVICE_ROLE_KEY` to the browser**: Ingestion and privileged operations happen strictly server-side.
3. **Commit After Every Change**: Run atomic git commits after completing each discrete unit of work.
4. **Zero Live Ingestion Queries on User Search**: Frontend search queries our indexed Supabase database, not the external Brabble API. Brabble is only hit by the hourly sync job.
5. **Anti-IDOR & Parameterized SQL**: Every user query is scoped to `user_id = authenticated_user_id` and executed via parameterized queries.
6. **Authentication Pattern**: Supabase Auth with Google OAuth Only. No passwords stored on OpportunityOS. API expects `Authorization: Bearer <supabase_access_token>`.

---

## 6. How to Resume This Session in Any AI Assistant (Claude / GPT)
When starting a new session or switching accounts, give the AI this prompt:

```markdown
I am building "OpportunityOS" — a student discovery & tracking platform for hackathons and coding contests.
Please read `context/PROJECT_STATE.md` and `docs/` in the project root to understand the complete architecture, stack, and current progress.
Follow all security rules: no hardcoded keys, commit after every single change, and do not hallucinate external dependencies.
Backend and Database are COMPLETE (Phases 3–7.5). The Supabase database contains only `opp_*` tables (`opp_opportunities`, `opp_profiles`, `opp_bookmarks`, `opp_applications`, `opp_submissions`, `opp_sync_logs`).
Authentication is Supabase Auth with Google Single Sign-On ONLY. Protected endpoints require `Authorization: Bearer <access_token>`.
Next step: Phase 8 (Frontend Discovery UI).
```

---

## 7. Session Activity Log
* **2026-09-20**: 
  * Workspace reviewed. Identified 20 documentation files.
  * Project officially renamed to **OpportunityOS**.
  * User confirmed stack choice: **Vercel + Supabase (PostgreSQL)**.
  * Security-hardened `.gitignore` and `.env.example` created with Supabase pooler credentials and `CRON_SECRET`.
  * Git initialized; staged `.agents/` skills and initial configuration.
  * First commit created: `chore: initialize repository with security rules, environment templates, and AI context`.
  * Updated entire documentation suite in `/docs`.
  * Enforced zero-application-code policy until user explicitly requested "build backend".
  * **Backend Built** (user command: "Build backend"):
    * Applied Supabase migrations via MCP: `opp_opportunities`, `opp_users`, `opp_bookmarks`, `opp_applications`, `opp_submissions`, `opp_sync_logs` + RLS policies.
    * Created Flask app factory (`api/index.py`) with CORS, error handlers.
    * Built Brabble sync engine: `brabble_client.py` (paginated fetch, rate limit tracking, retry), `normalizer.py` (Brabble→DB transform), `sync.py` (orchestrator).
    * Implemented 12 REST API endpoints across 8 blueprint files.
    * Security middleware: `auth_middleware.py`, `rate_limiter.py`, `validators.py`.
    * Commit: `b8e6a62` — 22 files, 2,187 insertions.
  * **Database Cleanup & Supabase Auth Migration (Google SSO Only)**:
    * Executed `drop_legacy_hospital_tables` migration: dropped all 26 tables from old hospital project (`orders`, `audit_events`, `patients`, `appointments`, `doctors`, `medicines`, etc.).
    * Executed `refactor_auth_to_opp_profiles` migration: removed `opp_users`, created `opp_profiles` linked 1-to-1 with `auth.users(id) ON DELETE CASCADE`.
    * Created automated trigger `handle_new_user` on `auth.users` to automatically populate `opp_profiles` with Google user metadata upon OAuth sign-in.
    * Re-linked foreign keys on `opp_bookmarks`, `opp_applications`, `opp_submissions` to `opp_profiles(id)`.
    * Updated `api/middleware/auth_middleware.py` to validate Supabase JWT access tokens from `Authorization: Bearer <token>` and inject `g.user_id` and `g.current_user`.
    * Updated `api/routes/auth.py` for Google-only auth (`GET /api/auth/me`, `PUT /api/auth/profile`, `POST /api/auth/forgot-password`, `POST /api/auth/logout`).
    * Updated `api/routes/admin.py` to join on `opp_profiles`.
    * Cleaned `api/index.py` session cookies for stateless JWT runtime and configured preflight OPTIONS handling.
    * Commit: `f7cb956`. All tests passed.
