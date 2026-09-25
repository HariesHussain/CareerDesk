# 03 — System Architecture (OpportunityOS)

## High-level diagram (text form)

```
Brabble API (brabble.ai/api/listings)
        │  hourly-refreshed JSON, key server-side only
        ▼
Vercel Serverless / Backend Sync Worker
  ├── brabble_client.py      (HTTP calls, auth headers, error handling)
  ├── normalizer.py          (Brabble shape -> internal Opportunity shape)
  ├── sync.py                (fetch -> normalize -> upsert -> sync_logs write)
  └── triggered by: Vercel Cron (/api/cron/sync?token=CRON_SECRET)
        │
        ▼
Supabase PostgreSQL Database (Cloud Hosted)
  ├── Connection Pooler (Port 6543, transaction mode for serverless)
  ├── Tables: opportunities, users, bookmarks, applications, submissions, admin_actions, sync_logs
  └── Row Level Security (RLS) policies protecting user data
        │
        ▼
Internal REST API (Vercel Serverless Functions /api/...)
  ├── /api/opportunities       (search, filters, sorting, pagination)
  ├── /api/opportunities/<id>  (full details)
  ├── /api/auth/*              (secure session / token auth)
  ├── /api/bookmarks           (user saved opportunities)
  ├── /api/applications        (Kanban pipeline tracking)
  ├── /api/submissions         (community opportunity submissions)
  └── /api/admin/*             (reviewer moderation queue)
        │
        ▼
OpportunityOS Frontend (Vercel Global Edge CDN)
  ├── HTML5 / Modern Responsive CSS / Vanilla JS (or React/Next.js)
  └── Views: Discover Hub, Opportunity Details, Personal Tracking Dashboard, Submit, Admin
```

## Why this shape
- **Zero Exposure of Brabble Credentials**: The browser never communicates with Brabble. `BRABBLE_API_KEY` lives exclusively in secure server-side environment variables.
- **Persistent Cloud Database (Supabase PostgreSQL)**: Solves the serverless ephemeral filesystem issue. Database writes (user accounts, bookmarks, synced opportunities) persist permanently in Supabase without disk wipe risks.
- **High-Performance Edge Delivery**: Static frontend assets are cached globally on Vercel's Edge Network for 0ms cold-start latency to impress recruiters.
- **Defensive Normalization Layer**: `normalizer.py` isolates Brabble schema fluctuations. If Brabble alters a field name, only the normalizer changes—frontend and database consumers remain insulated.
- **Serverless Resilience with Connection Pooling**: Connecting via Supabase transaction pooler (port 6543) prevents serverless connection exhaustion when traffic spikes.

## Request lifecycle example — student opens Discover page
1. Browser requests OpportunityOS Discover page via Vercel CDN.
2. Frontend JS executes `GET /api/opportunities?type=HACKATHON&sort=deadline`.
3. Vercel serverless function executes parameterized SQL against Supabase PostgreSQL (never calls Brabble on user search).
4. Response: JSON listing payload + pagination metadata.
5. Frontend renders Opportunity Cards with instant filtering.

## Request lifecycle example — scheduled sync
1. **Vercel Cron** triggers `GET /api/cron/sync` hourly, passing `Authorization: Bearer <CRON_SECRET>`.
2. Backend validates `CRON_SECRET` to prevent unauthorized sync triggers.
3. `brabble_client.py` pages through Brabble listings (`GET /api/listings`).
4. `normalizer.py` sanitizes each listing into the internal Opportunity schema and calculates deadlines.
5. `sync.py` upserts listings into Supabase `opportunities` and records summary stats to `sync_logs`.

## Deployment shape
Frontend and backend API routes deploy cohesively on **Vercel**, backed by **Supabase PostgreSQL**.

