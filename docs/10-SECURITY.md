# 10 — Security & DevSecOps Specification

Security is a primary architectural pillar for OpportunityOS. In alignment with OWASP Top 10 and enterprise DevSecOps standards, every layer strictly adheres to the principle of least privilege and zero trust.

---

## 1. Secrets Management & Isolation
- **Local Development**: All secrets live in `.env`.
  - `.env`, `.env.*` (except `.env.example`), `*.pem`, and `*.key` are strictly ignored by `.gitignore`.
  - **No secrets in repository**: Pre-commit discipline prevents any credential commits.
- **Production (Vercel)**: Configured in the Vercel Dashboard under **Environment Variables** (encrypted at rest).
- **Key Hierarchy & Isolation**:
  - `BRABBLE_API_KEY`: **Server-Side Only**. Used exclusively by the sync worker. Never exposed to browser.
  - `SUPABASE_SERVICE_ROLE_KEY`: **Server-Side Only**. Grants admin bypass of RLS for background ingestion. **NEVER bundled in frontend code.**
  - `SUPABASE_ANON_KEY`: **Client-Safe**. Public key bound to PostgreSQL Row Level Security (RLS).
  - `CRON_SECRET`: **Server-Side Only**. Cryptographic token required to invoke `/api/cron/sync`.
  - `SECRET_KEY`: **Server-Side Only**. Used to sign session tokens and cookies.
- **Log Masking**: API keys and tokens are never logged in plaintext. Only masked suffixes (e.g. `brbl_...9f2a`) may appear in server debug logs.

---

## 2. Database Protection & Row Level Security (RLS)
- **Supabase Row Level Security**: Enabled on all student tables (`bookmarks`, `applications`, `submissions`).
- **Anti-IDOR (Insecure Direct Object Reference)**:
  - Database queries and API handlers enforce `user_id = authenticated_user_id`.
  - A student cannot view, modify, or delete another student's bookmarks or application tracking rows, even if they guess internal IDs.
- **SQL Injection Elimination**:
  - All database interactions use parameterized queries (`$1, $2` placeholders or Supabase SDK query builders).
  - Zero raw string concatenations or f-strings in SQL execution.
- **Connection Pooler Security**:
  - Vercel serverless connections connect to Supabase Transaction Pooler (port 6543 via `pgbouncer`) to prevent connection pool exhaustion attacks.

---

## 3. Serverless Endpoint Security
- **Cron Protection**:
  - `/api/cron/sync` requires header `Authorization: Bearer <CRON_SECRET>` or `?token=<CRON_SECRET>`.
  - Unauthenticated requests are rejected immediately with `401 Unauthorized` before executing any Brabble calls or DB transactions.
- **Rate Limiting**:
  - Auth endpoints (`/api/auth/register`, `/api/auth/login`) and community submission endpoints (`/api/submissions`) are rate-limited per IP to mitigate credential stuffing and spam.
- **CORS Configuration**:
  - In production, CORS is restricted explicitly to the OpportunityOS production domain (`https://opportunity-os.vercel.app`). Wildcard `*` origins are prohibited.

---

## 4. Input Sanitization & XSS Defense
- **Server-Side Validation**:
  - All payload fields (types, strings, integers) are validated with strict allow-lists and schemas before database insertion.
- **XSS & URL Injection Prevention**:
  - `official_url` submitted by users must match a strict `https?://` regex, explicitly rejecting `javascript:`, `data:`, or `vbscript:` schemes.
  - User-submitted text fields (titles, descriptions, organisers) are escaped before rendering in the DOM.
- **Outbound Link Hardening**:
  - All outbound opportunity links render with `target="_blank" rel="noopener noreferrer"` to prevent tab-nabbing and origin leakage.

---

## 5. Authentication & Passwords
- Passwords are encrypted using salted hashes (Argon2 / PBKDF2 / Bcrypt) with adequate work factors. Plaintext passwords are never stored, transmitted, or logged.
- Session tokens use `HttpOnly`, `Secure` (HTTPS-enforced), and `SameSite=Lax` cookies to prevent token theft via JavaScript.

