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
* **Application Code**: ⏳ **NOT STARTED YET** (User instruction: Waiting for explicit "build backend" command).

---

## 4. Master Development Roadmap

| Phase | Milestone | Description | Status |
| :---: | :--- | :--- | :---: |
| **0** | **API Verification** | Verified Brabble API endpoints, parameters, and live data | ✅ Done |
| **1** | **Spec Documentation** | Requirements, schemas, and security documented in `/docs` | ✅ Done |
| **2** | **Project Setup & Handoff** | Renamed to OpportunityOS, created context handoff system, git init | ✅ Done |
| **3** | **Database Schema (Supabase)** | Create Postgres tables (`opportunities`, `users`, `bookmarks`, `applications`, `sync_logs`) & RLS | ⏳ Next |
| **4** | **Brabble Ingestion Engine** | `brabble_client.py`, normalizer, and upsert logic into Supabase | ⏳ Upcoming |
| **5** | **Public REST API** | `/api/opportunities` (filtering by type, city, platform, search, sort, pagination) | ⏳ Upcoming |
| **6** | **Frontend Discovery UI** | Responsive search/filter UI, opportunity cards, detail modal | ⏳ Upcoming |
| **7** | **Auth & Personal OS** | User accounts, saved bookmarks, Kanban-style application tracker | ⏳ Upcoming |
| **8** | **Vercel Deployment & Cron** | Live URL, Vercel Cron setup for automated sync | ⏳ Upcoming |

---

## 5. Critical Technical Constraints & Security Rules
1. **Zero Keys in Code**: All API keys, connection strings, and tokens must ONLY exist in `.env` (locally) and Vercel Environment Variables (in production). Never hardcode secrets.
2. **Never Expose `BRABBLE_API_KEY` or `SUPABASE_SERVICE_ROLE_KEY` to the browser**: Ingestion and privileged operations happen strictly server-side.
3. **Commit After Every Change**: Run atomic git commits after completing each discrete unit of work.
4. **Zero Live Ingestion Queries on User Search**: Frontend search queries our indexed Supabase database, not the external Brabble API. Brabble is only hit by the hourly sync job.
5. **Anti-IDOR & Parameterized SQL**: Every user query is scoped to `user_id = authenticated_user_id` and executed via parameterized queries.
6. **No Unapproved Code**: Do not write application code until the user explicitly prompts "build backend".

---

## 6. How to Resume This Session in Any AI Assistant (Claude / GPT)
When starting a new session or switching accounts, give the AI this prompt:

```markdown
I am building "OpportunityOS" — a student discovery & tracking platform for hackathons and coding contests.
Please read `context/PROJECT_STATE.md` and `docs/` in the project root to understand the complete architecture, stack, and current progress.
Follow all security rules: no hardcoded keys, commit after every single change, and do not hallucinate external dependencies.
We are currently starting Phase 3 (Supabase Database Schema).
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
  * Updated entire documentation suite in `/docs` (`01-PRD`, `02-TRD`, `03-Architecture`, `06-Database`, `07-API`, `10-Security`, `13-Deployment`, `14-Env`, `15-Roadmap`, `16-Decisions`, `17-Explanation`, `18-Interview-Prep`, `19-Troubleshooting`, `20-Changelog`).
  * Enforced zero-application-code policy until user explicitly requests "build backend".

