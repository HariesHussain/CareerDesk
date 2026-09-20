# CareerDesk

> **An aggregator and career operating system for Indian students and developers to discover verified hackathons, coding contests, hiring challenges, and tech fellowships.**

CareerDesk is a high-impact, production-grade opportunity platform and application tracking terminal. It connects students across Indian colleges with 900+ national competitions, hackathons, and innovation challenges with live prize pools, verified direct links, and zero spam.

---

## ✨ Key Features

- **🎯 Opportunity Explorer**: Browse 900+ verified hackathons and coding contests with multi-dimensional filtering (category, mode, deadline, prize pool) and instant keyword search.
- **📊 Kanban Application Tracker**: Personal pipeline (Saved, Applied, In Progress, Shortlisted, Won) to track contest milestones.
- **⭐ Optimistic Bookmarks**: Instant client-side bookmarking with seamless Supabase synchronization.
- **🔒 Secure Google Authentication**: Native Supabase Auth with Google OAuth SSO and profile provisioning.
- **👑 Enterprise Admin Console**:
  - **Live Telemetry & KPIs**: Real-time active users (24h/7d), institutions represented, volume stats, and sync status.
  - **User Governance & Permanent Bans**: Moderation directory with hard-delete and permanent Gmail blacklisting (`opp_banned_emails`) enforced at the API middleware layer.
  - **Live Ingestion Engine**: On-demand Brabble catalog sync trigger with execution history logs.
  - **Global Broadcast Banner**: High-visibility site-wide announcements with customizable themes and action buttons.
  - **Audit Trail**: Immutable compliance logs tracking every administrative action.

---

## 🛠️ Tech Stack

- **Frontend**: Vanilla JavaScript (ES6+), Modern Vanilla CSS Design System, Responsive Layout, Google Fonts (Inter & Outfit).
- **Backend**: Python 3.12, Flask Serverless Application Factory, `auth_middleware` with JWT Bearer validation.
- **Database**: **Supabase (Managed PostgreSQL)** with Row Level Security (RLS), connection pooling, and automated profile triggers.
- **External Ingestion**: **Brabble API** developer integration with automated upsert synchronization.
- **Deployment**: Configured for **Vercel Edge & Serverless Functions**.

---

## 🔐 Security Architecture

- **Zero Hardcoded Secrets**: All keys (`SUPABASE_SERVICE_ROLE_KEY`, `BRABBLE_API_KEY`, `SECRET_KEY`) reside strictly in environment variables.
- **Blacklist Enforcement**: Banned users are intercepted at the middleware layer (`auth_middleware.py`) with `HTTP 403 Forbidden` even if Supabase issues a valid OAuth token.
- **Admin Immunity**: Root admin configured in `ADMIN_EMAILS` is protected from accidental deletion, ban, or demotion.

---

## 🚀 Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/HariesHussain/CareerDesk.git
   cd CareerDesk
   ```
2. Copy environment template:
   ```bash
   cp .env.example .env
   ```
3. Configure `.env` with your Supabase credentials, Brabble API key, and admin email.
4. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
5. Run the local development server:
   ```bash
   python api/index.py
   ```
6. Open `http://127.0.0.1:3000` in your browser.

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.


