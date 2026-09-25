# 17 — Project Explanation (OpportunityOS)

## 1. What it does
OpportunityOS is a "Student Career Operating System" where students browse real, currently-open hackathons, coding contests, case competitions, and challenges. Students can search/filter with zero lag, click through to official registration platforms (Unstop, Devpost, Devfolio, MLH), and track their progress through a personal Kanban-style pipeline (Saved → Applied → Interview → Selected/Rejected).

## 2. Why it exists
Opportunity information is scattered across dozens of disconnected websites and expires rapidly. OpportunityOS unifies discovery through a single ingestion engine and provides a personal management dashboard so students never miss a deadline.

## 3. Architecture (Plain Terms)
- **Browser**: OpportunityOS web app loaded instantly via **Vercel's Edge Network**.
- **Serverless API**: Vercel Serverless Functions handle requests (`/api/opportunities`, `/api/bookmarks`, etc.).
- **Database**: Cloud-hosted **Supabase PostgreSQL** holds all listings, user accounts, and pipeline statuses permanently.
- **Scheduled Ingestion**: Once an hour, **Vercel Cron** asks Brabble.ai for the latest listings and upserts them into Supabase. The browser never touches Brabble directly or sees secret keys.

## 4. Frontend
Responsive web app: Discover Hub (instant search + filters), Opportunity Detail modal/page, Auth (Login/Register), Personal Dashboard (pipeline metrics + upcoming deadlines), Community Submit, and Admin Moderation.

## 5. Backend
Serverless API endpoints that execute parameterized SQL against Supabase PostgreSQL and return clean JSON payloads.

## 6. Database
Supabase PostgreSQL with Row Level Security (RLS) protecting user records across `opportunities`, `users`, `bookmarks`, `applications`, `submissions`, `admin_actions`, and `sync_logs`.


## 7. External API
Brabble.ai — one endpoint, `GET /api/listings`, needs a free API key, returns JSON. Full
verified contract in `08-EXTERNAL-API-INTEGRATION.md`.

## 8. Authentication
Email + password. Password is hashed (never stored as typed) before saving. Logging in
sets a signed cookie so Flask knows who's asking on future requests.

## 9. Opportunity synchronization
A scheduled script runs every hour: fetch from Brabble → clean up/rename fields into our
own shape → save/update rows in SQLite → write a log entry saying what happened.

## 10. Search
Typing in the search box sends `?q=...` to `/api/opportunities`, which does a substring
match on title/organiser in the database — debounced client-side so it doesn't fire on
every keystroke.

## 11. Filtering
Dropdowns/checkboxes for category, mode, city, fee map directly to query parameters our
Flask route turns into a `WHERE` clause.

## 12. Bookmarking
"Save" button → `POST /api/bookmarks` with the opportunity id → a row appears in the
`bookmarks` table linked to the logged-in user.

## 13. Application tracking
Changing a status dropdown → `POST /api/applications` → upserts a row in `applications`
recording the chosen status for that (user, opportunity) pair.

## 14. Submission workflow
Form submit → `POST /api/submissions` → saved as `pending`, invisible to other students →
an admin later approves or rejects it.

## 15. Admin workflow
Admin logs in (same login, but their user row has `role="admin"`) → sees the pending queue
→ approve creates a real public opportunity row, reject just marks it rejected.

## 16. Security
API key never leaves the server. Passwords hashed. All database queries use placeholders
(`?`) instead of building SQL strings, which blocks SQL injection. Admin routes check the
user's role before doing anything.

## 17. Deployment
One Flask app serving both the API and the static files, plus a scheduled task for syncing
— see `13-DEPLOYMENT.md` for the actual host once chosen.

## 18. Important technical decisions
See `16-DECISIONS.md` — most importantly: Brabble is the sole data source, internships are
deliberately excluded from MVP because the data doesn't clearly support them, and we sync
on a schedule rather than live per-request to respect Brabble's rate limit and stay fast.

## 19. Common failure scenarios
- Brabble is down → the site keeps working off the last successful sync; only new
  opportunities stop appearing until sync recovers.
- A user's saved opportunity expires → it stays in their tracker with its status intact
  (we don't delete history).
- Someone hits `/api/admin/*` without being an admin → 403, nothing happens.
