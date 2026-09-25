# CareerDesk / OpportunityOS — Setup, Database & AI Onboarding Guide

> **For Humans & AI Coding Assistants (Claude Code, Cursor, Copilot, Antigravity)**  
> Follow this complete guide after cloning the repository to set up the project, provision your Supabase database tables, configure Google OAuth, set environment variables, and connect Supabase via MCP.

---

## 🚀 Quick Start (What to do after cloning this project)

```bash
# 1. Clone the repository (if not already done)
git clone https://github.com/HariesHussain/CareerDesk.git
cd CareerDesk

# 2. Create Python virtual environment and activate it
python -m venv venv
# Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# macOS / Linux:
source venv/bin/activate

# 3. Install backend dependencies
pip install -r requirements.txt

# 4. Copy environment template
cp .env.example .env

# 5. Create your database tables in Supabase (See Step 2 below)

# 6. Fill in your .env values (See Step 3 below)

# 7. Run unit test suite to verify everything passes
python -m unittest discover tests

# 8. Start local development server
python api/index.py
# Open your browser at http://localhost:3000
```

---

## 🗄️ Step 2: How Database Tables Are Created in Supabase

When you or someone else clones this project with a brand-new Supabase account, your Supabase database starts empty.

We have provided a turnkey SQL script: [`supabase_schema.sql`](supabase_schema.sql) (also located at [`docs/schema.sql`](docs/schema.sql)).

### Method A — Supabase Web Dashboard (Easiest & Fastest, 1 Minute)
1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard) and create a **New Project**.
2. Click **SQL Editor** in the left sidebar (icon with `>_`).
3. Click **New query**.
4. Open [`supabase_schema.sql`](supabase_schema.sql) in this repo, copy its entire contents, paste it into the SQL Editor, and click **Run**.
5. **Done!** This automatically creates:
   - All 9 application tables:
     - `opp_profiles` (user profiles synced with Supabase Auth)
     - `opp_opportunities` (hackathons, internships, contests)
     - `opp_bookmarks` (saved student opportunities)
     - `opp_applications` (application tracking pipeline)
     - `opp_submissions` (community submitted opportunities)
     - `opp_banned_emails` (moderation & abuse prevention)
     - `opp_sync_logs` (API sync history)
     - `opp_system_announcements` (broadcast banner)
     - `opp_admin_audit_logs` (security audit logs)
   - PostgreSQL indexes for search and performance.
   - Row-Level Security (RLS) policies.
   - Auth trigger (`on_auth_user_created`) that automatically creates a student profile in `opp_profiles` whenever a user signs up or signs in with Google.
   - Starter seed data featuring top verified opportunities (Smart India Hackathon, GSoC, ETHIndia, Imagine Cup, TCS CodeVita, MLH).

### Method B — Via Supabase MCP (For AI Agents)
If your AI assistant is connected to Supabase MCP, ask it:
> *"Run the SQL commands from `supabase_schema.sql` on my Supabase project."*  
The AI agent will call `execute_sql` via MCP and create all tables and triggers automatically.

---

## 🔑 Step 3: Clear Step-by-Step Guide to Getting All `.env` API Keys

Open `.env` in the root folder. You need 5 key sections:

```env
# 1. External Listings Ingestion API
BRABBLE_API_KEY=...

# 2. Supabase Cloud Database & Auth
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# 3. Security & Automation Tokens
SECRET_KEY=...
CRON_SECRET=...

# 4. Administrator Permissions
ADMIN_EMAILS=...
```

Here is exactly where to get each one:

### 1. `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`
1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard).
2. Select your project.
3. Click the **Project Settings** (gear icon at the bottom of the left sidebar).
4. Click on **API** (under Configuration).
5. You will see:
   - **Project URL**: Copy this $\rightarrow$ paste into `SUPABASE_URL`. Example: `https://your-ref-id.supabase.co`
   - **Project API Keys**:
     - `anon` `public`: Click **Copy** $\rightarrow$ paste into `SUPABASE_ANON_KEY`.
     - `service_role` `secret`: Click **Reveal** then **Copy** $\rightarrow$ paste into `SUPABASE_SERVICE_ROLE_KEY`.  
       *(Note: Never expose the service role key to frontend code or commit to GitHub).*

---

### 2. Configure Google OAuth in Supabase (For Sign-In / Sign-Up)
CareerDesk uses Google Single Sign-On via Supabase Auth:
1. In your Supabase Dashboard, go to **Authentication** $\rightarrow$ **Providers**.
2. Find **Google** and toggle it **Enabled**.
3. Go to [Google Cloud Console](https://console.cloud.google.com/) $\rightarrow$ **APIs & Services** $\rightarrow$ **Credentials**.
4. Click **Create Credentials** $\rightarrow$ **OAuth Client ID** $\rightarrow$ Application type: **Web application**.
5. Under **Authorized redirect URIs**, copy and paste the **Callback URL** shown in your Supabase Google Provider settings:
   `https://<your-project-id>.supabase.co/auth/v1/callback`
6. Click **Create** $\rightarrow$ Copy the **Client ID** and **Client Secret**.
7. Paste them into Supabase under the Google provider settings and click **Save**.
8. In Supabase Dashboard $\rightarrow$ **Authentication** $\rightarrow$ **URL Configuration**:
   - Set **Site URL** to: `http://localhost:3000` (for local dev) or `https://your-app.vercel.app` (for production).
   - Under **Redirect URLs**, add: `http://localhost:3000/*` and `https://your-app.vercel.app/*`.

---

### 3. `BRABBLE_API_KEY` (External Listings Sync)
Brabble provides the live feed of verified hackathons and student opportunities.
1. Visit [https://brabble.ai](https://brabble.ai) (or [https://brabble.ai/developers](https://brabble.ai/developers)).
2. Log in and navigate to **Dashboard** $\rightarrow$ **Developer Settings** / **API Keys**.
3. Generate or copy your API key (format: `brbl_<64 hex characters>`).
4. Paste into `BRABBLE_API_KEY`.
*(Note: If you do not have a Brabble key yet, the app works seamlessly with the bundled starter opportunities from `supabase_schema.sql`)*.

---

### 4. `SECRET_KEY` & `CRON_SECRET`
These are random cryptographic tokens generated by you:
- `SECRET_KEY`: Used by Flask for secure session management.
- `CRON_SECRET`: Used as a bearer authorization token for triggering `/api/cron/sync` (e.g. from Vercel Cron or GitHub Actions).

Generate them instantly in PowerShell:
```powershell
# In PowerShell:
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```
Or in Python:
```python
python -c "import secrets; print(secrets.token_hex(32))"
```
Paste one output into `SECRET_KEY` and another into `CRON_SECRET`.

---

### 5. `ADMIN_EMAILS`
Comma-separated list of Google email addresses that should automatically have platform administrator privileges:
```env
ADMIN_EMAILS=yourname@gmail.com,co-admin@college.edu
```

---

## 🔌 Step 4: How to Connect Supabase as an MCP Server

The **Model Context Protocol (MCP)** enables AI agents (Cursor, Claude Desktop, Antigravity, VS Code) to query your Supabase database, execute SQL migrations, inspect table schemas, and diagnose issues autonomously.

### 1. Get a Supabase Personal Access Token (PAT)
1. Go to [https://supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens).
2. Click **Generate new token**.
3. Name it `mcp-assistant-token` and copy the generated token (`sbp_...`).
4. Note your **Project Reference ID** (found in your project dashboard URL, e.g. `https://supabase.com/dashboard/project/<project-ref>`).

### 2. Configuration for Cursor
In Cursor, go to **Settings** $\rightarrow$ **Features** $\rightarrow$ **MCP Servers** $\rightarrow$ **Add New MCP Server**:
- **Name**: `supabase`
- **Type**: `command`
- **Command**:
  ```bash
  npx -y @supabase/mcp-server-supabase@latest --access-token sbp_your_personal_access_token --project-ref your_project_ref
  ```

### 3. Configuration for Claude Desktop / Antigravity (`claude_desktop_config.json` or `mcp_config.json`)
Add this under `"mcpServers"`:
```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": [
        "-y",
        "@supabase/mcp-server-supabase@latest",
        "--access-token",
        "sbp_your_personal_access_token_here",
        "--project-ref",
        "your_project_ref_here"
      ]
    }
  }
}
```

### Alternatively: Direct PostgreSQL Connection via Postgres MCP
If using the PostgreSQL MCP server:
```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-postgres",
        "postgresql://postgres.[project-ref]:[db-password]@aws-0-[region].pooler.supabase.com:6543/postgres"
      ]
    }
  }
}
```
*(Find your connection string in Supabase Dashboard $\rightarrow$ Project Settings $\rightarrow$ Database $\rightarrow$ Connection string $\rightarrow$ URI).*

---

## 🧪 Step 5: Verification & Testing

Verify that everything is wired correctly:

```bash
# Run the automated test suite
python -m unittest discover tests
```
Output should be:
```
Ran 6 tests in X.XXs
OK
```

Start the application:
```bash
python api/index.py
```
Visit `http://localhost:3000`:
- Sign in with Google $\rightarrow$ You should be immediately welcomed into the **App Workspace** (`#appWorkspace`).
- Click bookmarking on any opportunity $\rightarrow$ verify it appears under **Saved Bookmarks**.
- Verify no errors in the browser console.

---

## 🚢 Step 6: Deploying to Vercel

1. Push your repository to GitHub.
2. In [Vercel Dashboard](https://vercel.com/), click **Add New Project** $\rightarrow$ select your GitHub repo.
3. In **Environment Variables**, add the exact same variables from `.env`:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `BRABBLE_API_KEY`
   - `SECRET_KEY`
   - `CRON_SECRET`
   - `ADMIN_EMAILS`
4. Click **Deploy**. Vercel will automatically configure the Python serverless function at `/api` and serve static files from `/public`.
