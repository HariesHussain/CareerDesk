-- ============================================================================
-- CareerDesk / OpportunityOS — Complete PostgreSQL Database Schema
-- Compatible with Supabase PostgreSQL 15+
-- ============================================================================
-- Run this script in your Supabase project's SQL Editor (Dashboard -> SQL Editor -> New Query)
-- It creates all required tables, triggers, indexes, RLS policies, and starter seed data.
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. PROFILES TABLE (Linked to Supabase Auth)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.opp_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    college_name TEXT,
    degree TEXT,
    graduation_year TEXT,
    bio TEXT,
    skills JSONB DEFAULT '[]'::jsonb,
    github_url TEXT,
    linkedin_url TEXT,
    portfolio_url TEXT,
    role VARCHAR(16) NOT NULL DEFAULT 'student',
    is_banned BOOLEAN NOT NULL DEFAULT false,
    banned_reason TEXT,
    banned_at TIMESTAMPTZ,
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index on email & role for quick lookups
CREATE INDEX IF NOT EXISTS idx_opp_profiles_email ON public.opp_profiles(email);
CREATE INDEX IF NOT EXISTS idx_opp_profiles_role ON public.opp_profiles(role);

-- ============================================================================
-- 2. OPPORTUNITIES TABLE (Listings, Hackathons, Internships, Contests)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.opp_opportunities (
    id BIGSERIAL PRIMARY KEY,
    external_id TEXT UNIQUE,
    source VARCHAR(32) NOT NULL DEFAULT 'brabble',
    title TEXT NOT NULL,
    organiser TEXT,
    category VARCHAR(64) NOT NULL,
    kind VARCHAR(32),
    platform VARCHAR(64),
    official_url TEXT NOT NULL,
    share_url TEXT,
    deadline_utc TIMESTAMPTZ,
    mode VARCHAR(16) NOT NULL DEFAULT 'ONLINE',
    city VARCHAR(64),
    prize_label TEXT,
    prize_inr BIGINT,
    team_size VARCHAR(32),
    fee VARCHAR(32),
    eligibility JSONB DEFAULT '[]'::jsonb,
    registered_count INTEGER DEFAULT 0,
    description TEXT,
    is_expired BOOLEAN NOT NULL DEFAULT false,
    status VARCHAR(32) NOT NULL DEFAULT 'approved',
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance Indexes for search, filtering, and sorting
CREATE INDEX IF NOT EXISTS idx_opp_opportunities_status_exp ON public.opp_opportunities (status, is_expired, deadline_utc ASC);
CREATE INDEX IF NOT EXISTS idx_opp_opportunities_filter ON public.opp_opportunities (category, mode, city);
CREATE INDEX IF NOT EXISTS idx_opp_opportunities_platform ON public.opp_opportunities (platform);
CREATE INDEX IF NOT EXISTS idx_opp_opportunities_deadline ON public.opp_opportunities (deadline_utc ASC);

-- ============================================================================
-- 3. BOOKMARKS TABLE (Saved Opportunities per Student)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.opp_bookmarks (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    opportunity_id BIGINT NOT NULL REFERENCES public.opp_opportunities(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, opportunity_id)
);

CREATE INDEX IF NOT EXISTS idx_opp_bookmarks_user ON public.opp_bookmarks(user_id);

-- ============================================================================
-- 4. APPLICATIONS TABLE (Student Application Tracking Pipeline)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.opp_applications (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    opportunity_id BIGINT NOT NULL REFERENCES public.opp_opportunities(id) ON DELETE CASCADE,
    status VARCHAR(32) NOT NULL DEFAULT 'saved',
    notes TEXT,
    applied_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, opportunity_id)
);

CREATE INDEX IF NOT EXISTS idx_opp_applications_user ON public.opp_applications(user_id);

-- ============================================================================
-- 5. SUBMISSIONS TABLE (Community Submitted Opportunities)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.opp_submissions (
    id BIGSERIAL PRIMARY KEY,
    submitted_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    organiser TEXT NOT NULL,
    category VARCHAR(64) NOT NULL,
    mode VARCHAR(16) NOT NULL DEFAULT 'ONLINE',
    city VARCHAR(64),
    official_url TEXT NOT NULL,
    deadline_utc TIMESTAMPTZ NOT NULL,
    prize_label TEXT,
    prize_inr BIGINT,
    fee VARCHAR(32),
    eligibility JSONB DEFAULT '[]'::jsonb,
    description TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    reviewer_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_opp_submissions_status ON public.opp_submissions(status);

-- ============================================================================
-- 6. BANNED EMAILS TABLE (Platform Governance & Moderation)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.opp_banned_emails (
    email TEXT PRIMARY KEY,
    reason TEXT,
    banned_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 7. SYNC LOGS TABLE (Brabble API Ingestion History)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.opp_sync_logs (
    id BIGSERIAL PRIMARY KEY,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status VARCHAR(32) NOT NULL DEFAULT 'running',
    records_fetched INTEGER DEFAULT 0,
    records_inserted INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0,
    records_skipped INTEGER DEFAULT 0,
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_opp_sync_logs_started ON public.opp_sync_logs(started_at DESC);

-- ============================================================================
-- 8. SYSTEM ANNOUNCEMENTS TABLE (Global Broadcast Banner)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.opp_system_announcements (
    id INTEGER PRIMARY KEY DEFAULT 1,
    message TEXT,
    type VARCHAR(32) DEFAULT 'info',
    active BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 9. ADMIN AUDIT LOGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.opp_admin_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    admin_id UUID,
    action VARCHAR(64) NOT NULL,
    target_type VARCHAR(64),
    target_id TEXT,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opp_audit_created ON public.opp_admin_audit_logs(created_at DESC);

-- ============================================================================
-- 10. AUTH TRIGGER: Auto-provision opp_profiles on user signup via Google SSO
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
    v_full_name TEXT;
    v_avatar_url TEXT;
BEGIN
    v_full_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        SPLIT_PART(NEW.email, '@', 1)
    );
    v_avatar_url := COALESCE(
        NEW.raw_user_meta_data->>'avatar_url',
        NEW.raw_user_meta_data->>'picture',
        ''
    );

    INSERT INTO public.opp_profiles (id, email, full_name, avatar_url, role)
    VALUES (NEW.id, NEW.email, v_full_name, v_avatar_url, 'student')
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = COALESCE(public.opp_profiles.full_name, EXCLUDED.full_name),
        avatar_url = COALESCE(public.opp_profiles.avatar_url, EXCLUDED.avatar_url),
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind trigger to auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ============================================================================
-- 11. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE public.opp_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opp_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opp_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opp_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opp_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opp_system_announcements ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can view & update their own profile; Service role has all permissions
DROP POLICY IF EXISTS "Public profiles read" ON public.opp_profiles;
CREATE POLICY "Public profiles read" ON public.opp_profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users update own profile" ON public.opp_profiles;
CREATE POLICY "Users update own profile" ON public.opp_profiles FOR UPDATE USING (auth.uid() = id);

-- Opportunities: Anyone can view approved opportunities
DROP POLICY IF EXISTS "Anyone can view approved opportunities" ON public.opp_opportunities;
CREATE POLICY "Anyone can view approved opportunities" ON public.opp_opportunities
    FOR SELECT USING (status = 'approved');

-- Bookmarks: Users can only manage their own bookmarks
DROP POLICY IF EXISTS "Users view own bookmarks" ON public.opp_bookmarks;
CREATE POLICY "Users view own bookmarks" ON public.opp_bookmarks
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own bookmarks" ON public.opp_bookmarks;
CREATE POLICY "Users insert own bookmarks" ON public.opp_bookmarks
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own bookmarks" ON public.opp_bookmarks;
CREATE POLICY "Users delete own bookmarks" ON public.opp_bookmarks
    FOR DELETE USING (auth.uid() = user_id);

-- Applications: Users can only manage their own applications
DROP POLICY IF EXISTS "Users view own applications" ON public.opp_applications;
CREATE POLICY "Users view own applications" ON public.opp_applications
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own applications" ON public.opp_applications;
CREATE POLICY "Users insert own applications" ON public.opp_applications
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own applications" ON public.opp_applications;
CREATE POLICY "Users update own applications" ON public.opp_applications
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own applications" ON public.opp_applications;
CREATE POLICY "Users delete own applications" ON public.opp_applications
    FOR DELETE USING (auth.uid() = user_id);

-- Submissions: Users view their own, insert new
DROP POLICY IF EXISTS "Users view own submissions" ON public.opp_submissions;
CREATE POLICY "Users view own submissions" ON public.opp_submissions
    FOR SELECT USING (auth.uid() = submitted_by_user_id);

DROP POLICY IF EXISTS "Users insert submissions" ON public.opp_submissions;
CREATE POLICY "Users insert submissions" ON public.opp_submissions
    FOR INSERT WITH CHECK (auth.uid() = submitted_by_user_id);

-- System Announcements: Anyone can view
DROP POLICY IF EXISTS "Anyone can view announcements" ON public.opp_system_announcements;
CREATE POLICY "Anyone can view announcements" ON public.opp_system_announcements
    FOR SELECT USING (true);

-- ============================================================================
-- 12. STARTER SEED DATA (Immediately populates opportunities on fresh clone)
-- ============================================================================
INSERT INTO public.opp_system_announcements (id, message, type, active)
VALUES (1, 'Welcome to CareerDesk! Discover premier student hackathons, coding contests, and fellowships.', 'info', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.opp_opportunities (
    external_id, source, title, organiser, category, kind, platform,
    official_url, deadline_utc, mode, city, prize_label, prize_inr, team_size, fee, eligibility, registered_count, description
) VALUES
(
    'seed-sih-2026',
    'seed',
    'Smart India Hackathon 2026',
    'Ministry of Education & AICTE',
    'HACKATHON',
    'competition',
    'Govt of India',
    'https://www.sih.gov.in',
    NOW() + INTERVAL '45 days',
    'HYBRID',
    'New Delhi',
    '₹1,00,000 per problem statement',
    100000,
    '6 Members',
    'Free',
    '["College Students", "B.Tech", "MCA", "B.Sc"]'::jsonb,
    15420,
    'World''s largest open innovation model to provide students with a platform to solve some of the pressing problems we face in our daily lives.'
),
(
    'seed-gsoc-2026',
    'seed',
    'Google Summer of Code (GSoC) 2026',
    'Google Open Source',
    'FELLOWSHIP',
    'contest',
    'Google',
    'https://summerofcode.withgoogle.com',
    NOW() + INTERVAL '60 days',
    'ONLINE',
    'Remote',
    '$3,000 - $6,600 Stipend',
    300000,
    'Individual',
    'Free',
    '["Students", "Beginner Contributors", "Open Source"]'::jsonb,
    8920,
    'Google Summer of Code is a global, online mentoring program focused on introducing new contributors to open source software development.'
),
(
    'seed-devfolio-ethindia',
    'seed',
    'ETHIndia 2026 — Asia''s Biggest Ethereum Hackathon',
    'Devfolio & ETHGlobal',
    'HACKATHON',
    'competition',
    'Devfolio',
    'https://devfolio.co',
    NOW() + INTERVAL '30 days',
    'OFFLINE',
    'Bengaluru',
    '₹25,00,000 Total Prize Pool',
    2500000,
    '2 - 4 Members',
    'Free',
    '["All Developers", "Web3 Enthusiasts", "College Students"]'::jsonb,
    4200,
    'Build decentralized applications and smart contracts alongside top builders and venture funds across the global ecosystem.'
),
(
    'seed-microsoft-imagine',
    'seed',
    'Microsoft Imagine Cup 2026',
    'Microsoft Corporation',
    'COMPETITION',
    'competition',
    'Microsoft',
    'https://imaginecup.microsoft.com',
    NOW() + INTERVAL '75 days',
    'ONLINE',
    'Remote',
    '$100,000 + Azure Credits',
    8300000,
    '1 - 4 Members',
    'Free',
    '["Students 16+", "Founders", "Tech Enthusiasts"]'::jsonb,
    11500,
    'Global student competition empowering the next generation of founders to build AI-driven solutions using Microsoft Cloud.'
),
(
    'seed-tcs-codevita',
    'seed',
    'TCS CodeVita Season 14',
    'Tata Consultancy Services',
    'CODING',
    'contest',
    'TCS iON',
    'https://tcscodevita.com',
    NOW() + INTERVAL '20 days',
    'ONLINE',
    'Remote',
    '₹5,00,000 + Global Job Offers',
    500000,
    'Individual',
    'Free',
    '["Graduating Batch", "Engineering", "Science"]'::jsonb,
    28900,
    'Guinness World Records certified largest computer programming contest offering career opportunities to top performers.'
),
(
    'seed-mlh-hackcon',
    'seed',
    'Major League Hacking Global Hackathon',
    'Major League Hacking (MLH)',
    'HACKATHON',
    'competition',
    'MLH',
    'https://mlh.io',
    NOW() + INTERVAL '15 days',
    'ONLINE',
    'Remote',
    '$10,000 Hardware & Software Prizes',
    820000,
    '1 - 4 Members',
    'Free',
    '["High School", "University Students", "Self-Taught"]'::jsonb,
    3100,
    'Join thousands of hackers worldwide for a weekend of rapid prototyping, workshops, and mentorship from industry engineers.'
)
ON CONFLICT (external_id) DO NOTHING;
