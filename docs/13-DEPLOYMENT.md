# 13 — Deployment Guide (Vercel + Supabase)

OpportunityOS is deployed on **Vercel** (Global Edge CDN + Serverless Functions) with **Supabase** (Managed Cloud PostgreSQL 15+).

---

## 1. Production Architecture Overview
- **Frontend & Serverless API**: Hosted on Vercel. Fast global edge routing with 0-second cold start times.
- **Database**: Hosted on Supabase (AWS region, e.g. `ap-south-1` Mumbai or `eu-central-1`).
- **Scheduled Brabble Ingestion**: Configured via **Vercel Cron** in `vercel.json`, pinging `/api/cron/sync` once every hour.

---

## 2. Environment Variables Required on Vercel
Set these in **Vercel Dashboard → Project Settings → Environment Variables**:

| Variable | Environment | Description |
|---|---|---|
| `BRABBLE_API_KEY` | Production, Preview | Verified Brabble API authentication key |
| `SUPABASE_URL` | Production, Preview | `https://<project-id>.supabase.co` |
| `SUPABASE_ANON_KEY` | Production, Preview | Public client key (governed by RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Production, Preview | Secret admin key (server-side only, for cron sync) |
| `DATABASE_URL` | Production, Preview | Supabase connection pooler URL (port 6543) |
| `SECRET_KEY` | Production, Preview | Cryptographically secure random secret string |
| `CRON_SECRET` | Production, Preview | Secure secret token authenticating Vercel Cron requests |
| `FLASK_ENV` | Production | `production` |

---

## 3. Vercel Configuration (`vercel.json`)
The repo includes a `vercel.json` configuring API routing and hourly cron sync:

```json
{
  "crons": [
    {
      "path": "/api/cron/sync",
      "schedule": "0 * * * *"
    }
  ]
}
```

---

## 4. Deployment Steps

### Step 1: Provision Supabase Database
1. Go to [supabase.com](https://supabase.com) and create a free project named `opportunity-os`.
2. Open the **SQL Editor** in Supabase and execute the DDL schema script from `docs/06-DATABASE-DESIGN.md`.
3. Verify tables (`opportunities`, `users`, `bookmarks`, `applications`, `submissions`, `sync_logs`) and indexes are created.
4. Copy the API keys and database pooler connection string from **Project Settings → API / Database**.

### Step 2: Deploy to Vercel
1. Push repository to GitHub.
2. Go to [vercel.com](https://vercel.com) and click **"Add New Project"**.
3. Import the `OpportunityOS` GitHub repository.
4. Add all environment variables listed in Section 2 above into the Vercel dashboard.
5. Click **Deploy**.

### Step 3: Trigger Initial Ingestion & Verify
1. Once deployed, trigger an initial sync by making an authenticated request:
   ```bash
   curl -X GET "https://your-opportunity-os.vercel.app/api/cron/sync" \
     -H "Authorization: Bearer YOUR_CRON_SECRET"
   ```
2. Verify in Supabase table editor that 500–900+ real opportunity listings are populated.
3. Open `https://your-opportunity-os.vercel.app` in your browser and verify live cards render.

---

## 5. Rollback Strategy
Vercel keeps immutable deployment artifacts for every Git commit. In the event of a breaking regression:
1. Navigate to **Vercel Dashboard → Deployments**.
2. Locate the previous healthy deployment and click **"Promote to Production"**.
3. Instant rollback completes in under 5 seconds with zero server restart delay.

