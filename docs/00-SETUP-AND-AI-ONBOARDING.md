# 00 — Setup, Database Creation & AI Onboarding Guide

> **For Humans & Autonomous AI Agents**  
> Complete post-clone instructions for setting up the environment, provisioning database tables in Supabase, acquiring API keys, and connecting via MCP.

See also the root [`SETUP_GUIDE.md`](../SETUP_GUIDE.md) and SQL schema at [`docs/schema.sql`](schema.sql) / [`supabase_schema.sql`](../supabase_schema.sql).

---

## 1. Post-Clone Setup Checklist
1. **Virtual Environment**:
   ```bash
   python -m venv venv
   # Windows:
   .\venv\Scripts\Activate.ps1
   # Linux/macOS:
   source venv/bin/activate
   ```
2. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```
3. **Configure Environment**:
   ```bash
   cp .env.example .env
   ```
4. **Provision Supabase Database**:
   Run [`docs/schema.sql`](schema.sql) in Supabase SQL Editor.
5. **Run Verification Tests**:
   ```bash
   python -m unittest discover tests
   ```
6. **Launch Dev Server**:
   ```bash
   python api/index.py
   ```

---

## 2. Supabase Tables Provisioning
Running [`docs/schema.sql`](schema.sql) creates all 9 application tables:
- `opp_profiles`
- `opp_opportunities`
- `opp_bookmarks`
- `opp_applications`
- `opp_submissions`
- `opp_banned_emails`
- `opp_sync_logs`
- `opp_system_announcements`
- `opp_admin_audit_logs`

Along with:
- Row-Level Security (RLS) policies.
- Automatic auth trigger (`on_auth_user_created`) syncing Google SSO accounts to `opp_profiles`.
- Initial seed opportunities.

---

## 3. Connecting Supabase as MCP (Model Context Protocol)
To allow an AI assistant to execute migrations or query the database:
- **Cursor**: Command type: `npx -y @supabase/mcp-server-supabase@latest --access-token <PAT> --project-ref <PROJECT_REF>`
- **Claude / Antigravity**: Add `mcpServers.supabase` configuration in MCP config JSON.
- **Postgres MCP**: `npx -y @modelcontextprotocol/server-postgres "postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"`
