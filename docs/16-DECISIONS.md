# 16 — Architecture Decisions (ADR-style log)

## D1: Use Brabble as sole external data source
**Why:** Verified real, free, documented, commercially-usable API that already aggregates
and deduplicates across 16–22 platforms, with expired listings pre-filtered. Building our
own scraper across Unstop/Devpost/Devfolio (none of which have official public APIs) would
be slower, fragile, and likely against their ToS.
**Trade-off:** single point of failure; no internships confirmed.

## D2: Exclude internships from MVP
**Why:** Brabble's `type` enum has no `INTERNSHIP` value and none appeared in the verified
live sample, despite Internshala being a listed platform. Building UI/filters for a
category we can't confirm exists in the data would violate the anti-fabrication rule.
**Revisit when:** a live query confirms internship-type rows actually exist.

## D3: Normalize Brabble data instead of using its shape directly as our schema
**Why:** Brabble's docs explicitly warn the contract can change without a version bump.
A normalization layer isolates that risk to one file (`normalizer.py`).

## D4: Supabase (Managed Cloud PostgreSQL) over local SQLite
**Decision Updated 2026-09-20:**
**Why:** Deploying to modern serverless infrastructure like Vercel means backend instances have ephemeral, read-only filesystems (disks wipe on cold starts and redeployments). Storing student data (bookmarks, accounts, application tracking) in a local `.sqlite` file would cause catastrophic data loss on Vercel. 
Supabase provides a persistent, free-tier managed PostgreSQL 15+ database with Row Level Security (RLS) and transaction connection pooling (port 6543). Demonstrating PostgreSQL and RLS significantly elevates the technical depth for software engineering interviews and recruiters.

## D5: Session-based / Secure Token auth
**Why:** Straightforward to reason about, secure HTTP-only cookie storage, and directly interfaces with PostgreSQL user records.

## D6: Vanilla JS / Modern Frontend
**Why:** Ensures foundational web standards, fast load times, and zero bundle bloat while deployed on Vercel Edge.

## D7: Scheduled hourly sync over per-request live calls
**Why:** Matches Brabble's own hourly refresh cadence (their own docs call more-frequent
polling "wasteful"), keeps us at ~120 requests/day vs. the 1,000/day cap, and means student
traffic never depends on Brabble's live availability.

## D8: Keep application-tracking history even after an opportunity expires
**Why:** Explicit spec requirement (§38) — a student's record of having applied somewhere
shouldn't vanish because the opportunity's deadline passed.

## D9: Vercel + Edge CDN over traditional free hosts (Render/Railway)
**Why:** Free tiers on traditional container hosts (Render) shut down after 15 minutes of inactivity, inflicting 50–60 second cold-start delays when recruiters click the portfolio link. Vercel's global CDN and serverless architecture guarantees instant, zero-wait page loads and automatic preview deployments.

## D10: Vercel Cron over in-process daemons
**Why:** Serverless environments cannot run perpetual background daemons like `APScheduler`. Vercel Cron triggers `/api/cron/sync` once hourly using an authenticated `CRON_SECRET` bearer token.

