# 01 — Product Requirements Document (PRD)

## 1. Problem
College students in India miss out on hackathons, competitions and coding contests because
the information is scattered across many platforms (Unstop, Devpost, MLH, Devfolio, etc.),
listings expire quickly, and there is no personal way to track which ones a student has
saved, applied to, or is waiting to hear back from.

## 2. Solution
OpportunityOS is a discovery + personal-tracking web app ("Student Career Operating System"). It pulls real,
currently-open student opportunities from the Brabble API, lets students search/filter/sort
them, and lets each student maintain a private list of saved opportunities with an
application-progress status (Saved → Applied → Interview → Selected/Rejected, etc.).

## 3. Verified data source
Brabble API (`GET https://brabble.ai/api/listings`) — verified live on 2026-09-20 with an
authenticated request. See `08-EXTERNAL-API-INTEGRATION.md` for the full contract.

Confirmed available `type` values (as actually observed in a live response plus documented
enum): `HACKATHON`, `COMPETITION`, `DESIGN`, `CASE STUDY`, `CONTEST`, `CODING`, `INNOVATION`,
`QUIZ`.

**Scope decision:** Internships are NOT part of MVP. The API's `type` enum has no
`INTERNSHIP` value and none appeared in the verified sample. Internship support is a
post-MVP item, gated on further API verification (see `16-DECISIONS.md`).

## 4. Goals (MVP)
- Show real, current, non-expired opportunities pulled from Brabble.
- Let students search, filter (type, mode, city, fee, eligibility), and sort
  (deadline soonest, newest, alphabetical).
- Show a full detail view per opportunity with a link to the original platform.
- Let authenticated students bookmark opportunities and track an application status.
- Give students a personal dashboard summarizing saved/applied/upcoming deadlines.
- Let students submit an opportunity Brabble doesn't have, subject to admin approval.
- Give an admin a focused review queue for submissions.

## 5. Non-goals (MVP)
- No in-app registration/application flow — registration always happens on the
  organiser's own site (this is a Brabble fair-use requirement, not just a design choice).
- No internships (see scope decision above).
- No AI recommendation engine, notifications infrastructure, payments, or chat.
- No mirroring/republishing of the full Brabble dataset as our own (fair-use requirement).

## 6. Users
- **Primary:** BCA / B.Tech / CS / engineering students, 18–25, looking for hackathons,
  coding contests, case competitions, and similar opportunities in India.
- **Secondary:** Students who want to submit an opportunity they found elsewhere.
- **Admin:** One trusted reviewer account that approves/rejects submissions.

## 7. Success criteria (Definition of Done — see `15-DEVELOPMENT-ROADMAP.md` for phase gating)
- Real Brabble data renders end-to-end (sync → DB → API → UI).
- Search, filter, sort work against real fields only (no fabricated filters).
- Deadline display correctly accounts for `kind` (competition vs contest) and IST.
- Bookmark + application-status tracking works for an authenticated user.
- Submission → pending → admin approve/reject → public visibility workflow works.
- Expired-but-historically-relevant applications are never deleted.
- Responsive on desktop/tablet/mobile.
- Automated tests exist for sync, normalization, filtering, auth, submissions.
- Every `/docs` file in this list exists and is accurate to the real implementation.

## 8. Constraints
- Brabble free tier: 1,000 requests/day, resets midnight IST. Sync design must stay far
  under this (see `08-EXTERNAL-API-INTEGRATION.md`).
- Brabble attribution string must be displayed wherever Brabble data is shown.
- Stack: Python (Flask / Serverless) + Supabase (Managed PostgreSQL) deployed on Vercel — chosen
  for high-impact portfolio presentation, zero cold starts, persistent cloud storage, and robust security.

