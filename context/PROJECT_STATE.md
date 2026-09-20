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

## 2. Recommended Tech Stack (Optimized for Portfolio & Vercel)
* **Frontend**: Vanilla HTML/CSS/JavaScript *(or Next.js/React)* deployed on **Vercel** (instant global CDN, 0-second spin-up).
* **Backend**: Python (Flask / Serverless WSGI) or Node.js running on **Vercel Serverless Functions** (`/api`).
* **Database**: **Supabase (Managed PostgreSQL)**:
  * Persistent cloud storage (replaces ephemeral local SQLite).
  * Never gets wiped on deployment restarts.
  * Real relational database (Postgres) — looks significantly better on resumes.
* **External Ingestion Source**: **Brabble API** (`GET https://brabble.ai/api/listings`):
  * Refreshed hourly on Brabble's side.
  * Free tier: 1,000 requests/day.
  * Server-side authentication only (`BRABBLE_API_KEY`), never exposed to frontend.
* **Sync Mechanism**: **Vercel Cron** hitting `/api/cron/sync` (or scheduled task) to refresh opportunities in the database periodically.

---

## 3. Current Implementation Status
* **Phase 0 (API Verification)**: ✅ Complete (Brabble API live test verified).
* **Phase 1 (Documentation & Planning)**: ✅ Complete (Full 20-file spec suite in `/docs`).
* **Phase 2 (Handoff & Architecture Lock)**: ✅ In progress (Choosing Vercel + Supabase, preparing backend foundation).
* **Application Code**: ⏳ **NOT STARTED YET** (User instruction: Do not write code until explicitly told).

---

## 4. Master Development Roadmap

| Phase | Milestone | Description | Status |
| :---: | :--- | :--- | :---: |
| **0** | **API Verification** | Verified Brabble API endpoints, parameters, and live data | ✅ Done |
| **1** | **Spec Documentation** | Requirements, schemas, and security documented in `/docs` | ✅ Done |
| **2** | **Project Setup & Handoff** | Renamed to OpportunityOS, created context handoff system | 🔄 Current |
| **3** | **Database Schema (Supabase)** | Create Postgres tables (`opportunities`, `users`, `bookmarks`, `applications`, `sync_logs`) | ⏳ Upcoming |
| **4** | **Brabble Ingestion Engine** | `brabble_client.py`, normalizer, and upsert logic into Supabase | ⏳ Upcoming |
| **5** | **Public REST API** | `/api/opportunities` (filtering by type, city, platform, search, sort, pagination) | ⏳ Upcoming |
| **6** | **Frontend Discovery UI** | Responsive search/filter UI, opportunity cards, detail modal | ⏳ Upcoming |
| **7** | **Auth & Personal OS** | User accounts, saved bookmarks, Kanban-style application tracker | ⏳ Upcoming |
| **8** | **Vercel Deployment & Cron** | Live URL, Vercel Cron setup for automated sync | ⏳ Upcoming |

---

## 5. Critical Technical Constraints & Rules
1. **Never expose `BRABBLE_API_KEY` to the browser**: All Brabble calls happen server-side.
2. **Never query Brabble on user search**: The user searches our Supabase database, not the Brabble API. Brabble is only queried by our scheduled background sync worker.
3. **Handle Serverless Ephemerality**: Backend runs stateless. All persistent states (sessions, bookmarks, opportunities) must live in Supabase PostgreSQL, not on the server disk.
4. **Resilient Data Ingestion**: Brabble may change data fields or omit optional fields (`prize`, `fee`, `eligibility`). The normalizer must have robust fallback defaults and never crash the sync process on a missing field.

---

## 6. How to Resume This Session in Any AI Assistant (Claude / GPT)
When starting a new session or switching accounts, give the AI this prompt:

```markdown
I am building "OpportunityOS" — a student discovery & tracking platform for hackathons and coding contests.
Please read `context/PROJECT_STATE.md` and `docs/` in the project root to understand the complete architecture, stack, and current progress.
Do not hallucinate external packages. We are currently at Phase [INSERT CURRENT PHASE NUMBER].
```

---

## 7. Session Activity Log
* **2026-09-20**: 
  * Workspace reviewed. Identified 20 documentation files.
  * Project officially renamed to **OpportunityOS**.
  * Evaluated hosting constraints for Vercel: recommended **Vercel + Supabase** over local SQLite to prevent data loss on serverless restarts and eliminate cold-start delays.
  * Created `context/PROJECT_STATE.md` as the living AI handoff document.
  * User instruction enforced: Zero code written until backend is explicitly initiated.
