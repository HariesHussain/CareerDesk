# 06 — Database Design (Supabase PostgreSQL)

Every table below satisfies a specific requirement from the PRD and user stories, optimized for **Supabase PostgreSQL 15+** with strong type safety, index optimization, and Row Level Security (RLS).

---

## 1. Tables Specification

### `opportunities`
Stores normalized listings ingested from the Brabble API, plus community-submitted opportunities once approved.
*Frontend and search endpoints read exclusively from this table (FR3, NFR1) — never directly from Brabble.*

| Column | PostgreSQL Type | Constraints & Notes |
|---|---|---|
| `id` | `BIGSERIAL PRIMARY KEY` | Internal ID |
| `external_id` | `TEXT UNIQUE` | Brabble's listing ID (e.g. `unstop-1752029`); NULL for user submissions |
| `source` | `VARCHAR(32) NOT NULL` | `'brabble'` or `'user_submission'` |
| `title` | `TEXT NOT NULL` | Opportunity title |
| `organiser` | `TEXT` | Hosting college, company, or platform |
| `category` | `VARCHAR(64) NOT NULL` | Normalized type (`HACKATHON`, `COMPETITION`, `CODING`, etc.) |
| `kind` | `VARCHAR(32)` | `'competition'` or `'contest'` — governs deadline meaning |
| `platform` | `VARCHAR(64)` | Host platform (`Unstop`, `Devfolio`, `MLH`, etc.) |
| `official_url` | `TEXT NOT NULL` | External registration URL |
| `share_url` | `TEXT` | Brabble share link (or NULL) |
| `deadline_utc` | `TIMESTAMPTZ` | Normalized UTC timestamp |
| `mode` | `VARCHAR(16) NOT NULL` | `'ONLINE'`, `'OFFLINE'`, or `'HYBRID'` |
| `city` | `VARCHAR(64)` | City name (e.g. `'Bengaluru'`, `'Delhi-NCR'`) or NULL |
| `prize_label` | `TEXT` | Formatted prize string (e.g. `"₹1,00,000"`) |
| `prize_inr` | `BIGINT` | Clean numeric prize for range queries |
| `team_size` | `VARCHAR(32)` | Display string (e.g. `"1 - 4"`) |
| `fee` | `VARCHAR(32)` | Display fee string (e.g. `"Free"`) |
| `eligibility` | `JSONB DEFAULT '[]'::jsonb` | JSON array of eligibility tags |
| `registered_count` | `INTEGER` | Platform-reported registrations |
| `description` | `TEXT` | Markdown/text description |
| `is_expired` | `BOOLEAN DEFAULT false` | Automatically flagged when deadline passes or sync drops |
| `status` | `VARCHAR(32) DEFAULT 'approved'` | `'approved'`, `'pending'`, `'rejected'` |
| `first_seen_at` | `TIMESTAMPTZ DEFAULT NOW()` | First ingested timestamp |
| `last_synced_at` | `TIMESTAMPTZ DEFAULT NOW()` | Last update timestamp |

**Indexes:**
```sql
CREATE INDEX idx_opp_query ON opportunities (status, is_expired, deadline_utc ASC);
CREATE INDEX idx_opp_filter ON opportunities (category, mode, city);
CREATE INDEX idx_opp_platform ON opportunities (platform);
CREATE INDEX idx_opp_search ON opportunities USING gin(to_tsvector('english', title || ' ' || coalesce(organiser, '')));
```

---

### `users`
Student and Administrator user accounts (FR4).

| Column | PostgreSQL Type | Constraints & Notes |
|---|---|---|
| `id` | `UUID PRIMARY KEY DEFAULT gen_random_uuid()` | Unique user identifier |
| `email` | `TEXT UNIQUE NOT NULL` | Lowercase student email |
| `password_hash` | `TEXT NOT NULL` | Bcrypt / Argon2 / Werkzeug hash (never plaintext) |
| `full_name` | `TEXT` | Display name |
| `college_name` | `TEXT` | College / University name |
| `role` | `VARCHAR(16) DEFAULT 'student'` | `'student'` or `'admin'` |
| `created_at` | `TIMESTAMPTZ DEFAULT NOW()` | Account creation time |
| `updated_at` | `TIMESTAMPTZ DEFAULT NOW()` | Last profile update |

---

### `bookmarks`
Saved opportunities for quick student reference (FR5).

| Column | PostgreSQL Type | Constraints & Notes |
|---|---|---|
| `id` | `BIGSERIAL PRIMARY KEY` | Internal bookmark ID |
| `user_id` | `UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE` | Owner user |
| `opportunity_id` | `BIGINT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE` | Bookmarked opportunity |
| `created_at` | `TIMESTAMPTZ DEFAULT NOW()` | Saved timestamp |

*Constraint:* `UNIQUE (user_id, opportunity_id)`.

---

### `applications`
Application tracking pipeline (Saved → Interested → Applied → Shortlisted → Interview → Selected / Rejected) (FR6).

| Column | PostgreSQL Type | Constraints & Notes |
|---|---|---|
| `id` | `BIGSERIAL PRIMARY KEY` | Internal tracking ID |
| `user_id` | `UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE` | Student tracking this |
| `opportunity_id` | `BIGINT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE` | Target opportunity |
| `status` | `VARCHAR(32) NOT NULL` | Pipeline stage |
| `notes` | `TEXT` | Private student notes & submission links |
| `applied_at` | `TIMESTAMPTZ` | Timestamp when user marked as applied |
| `updated_at` | `TIMESTAMPTZ DEFAULT NOW()` | Status change timestamp |

*Constraint:* `UNIQUE (user_id, opportunity_id)`. Applications persist even if opportunities expire so student records remain intact.

---

### `submissions`
Community-submitted opportunities submitted by students for admin review (FR8).

| Column | PostgreSQL Type | Constraints & Notes |
|---|---|---|
| `id` | `BIGSERIAL PRIMARY KEY` | Internal submission ID |
| `submitted_by_user_id` | `UUID REFERENCES users(id) ON DELETE SET NULL` | Student submitter |
| `title` | `TEXT NOT NULL` | |
| `organiser` | `TEXT` | |
| `category` | `VARCHAR(64) NOT NULL` | |
| `official_url` | `TEXT NOT NULL` | Outbound registration link |
| `deadline_utc` | `TIMESTAMPTZ` | Target deadline |
| `mode` | `VARCHAR(16)` | `'ONLINE'`, `'OFFLINE'`, `'HYBRID'` |
| `city` | `VARCHAR(64)` | |
| `fee` | `VARCHAR(32)` | |
| `prize_label` | `TEXT` | |
| `description` | `TEXT` | |
| `status` | `VARCHAR(32) DEFAULT 'pending'` | `'pending'`, `'approved'`, `'rejected'` |
| `reviewed_by_user_id` | `UUID REFERENCES users(id)` | Admin reviewer |
| `reviewed_at` | `TIMESTAMPTZ` | |
| `rejection_reason` | `TEXT` | |
| `created_at` | `TIMESTAMPTZ DEFAULT NOW()` | |

---

### `sync_logs`
Observability log recording health and statistics of every Brabble API sync execution (NFR1).

| Column | PostgreSQL Type | Constraints & Notes |
|---|---|---|
| `id` | `BIGSERIAL PRIMARY KEY` | Execution ID |
| `started_at` | `TIMESTAMPTZ NOT NULL` | Sync start time |
| `finished_at` | `TIMESTAMPTZ` | Sync completion time |
| `status` | `VARCHAR(16) NOT NULL` | `'success'` or `'failure'` |
| `records_fetched` | `INTEGER DEFAULT 0` | Total listings received from Brabble |
| `records_inserted` | `INTEGER DEFAULT 0` | New opportunities added |
| `records_updated` | `INTEGER DEFAULT 0` | Existing listings updated |
| `records_skipped` | `INTEGER DEFAULT 0` | Unchanged or invalid records |
| `error_message` | `TEXT` | Error trace if status is failure |

---

## 2. Row Level Security (RLS) Policies

Supabase enforces PostgreSQL RLS to safeguard student data:

```sql
-- Enable RLS on user-specific tables
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- 1. Opportunities: Publicly viewable for approved opportunities
CREATE POLICY "Public read for approved opportunities" 
ON opportunities FOR SELECT 
USING (status = 'approved');

-- 2. Bookmarks: Users can manage only their own bookmarks
CREATE POLICY "Users can manage own bookmarks" 
ON bookmarks FOR ALL 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- 3. Applications: Users can manage only their own application stages
CREATE POLICY "Users can manage own applications" 
ON applications FOR ALL 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- 4. Submissions: Users can view their own submissions; Admins can view all
CREATE POLICY "Users view own submissions" 
ON submissions FOR SELECT 
USING (auth.uid() = submitted_by_user_id);
```

