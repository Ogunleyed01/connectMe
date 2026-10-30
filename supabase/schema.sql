-- ============================================================================
-- 2027 INTERNSHIP TRACKER BOT — SUPABASE POSTGRESQL SCHEMA
-- ============================================================================

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Custom ENUM Types for strict state management (idempotent creation)
DO $$ BEGIN
  CREATE TYPE location_category_enum AS ENUM (
    'nigeria',
    'africa_remote',
    'overseas_remote',
    'overseas_relocate'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE work_mode_enum AS ENUM (
    'remote',
    'onsite',
    'hybrid'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE application_status_enum AS ENUM (
    'queued',        -- Matched to user, waiting for daily slot
    'sent',          -- Sent in Telegram, awaiting user click (will resend tomorrow if ignored)
    'applied',       -- User clicked "Applied" (triggers follow-up pipeline)
    'not_eligible',  -- User clicked "Not Eligible" (archived permanently)
    'interviewing',  -- Updated via 7-day follow-up check-in
    'offered',       -- Updated via follow-up check-in
    'rejected',      -- Updated via follow-up check-in
    'expired'        -- Deadline passed before user applied
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- TABLE 1: users
-- Stores Telegram user preferences, course of study, and daily digest limits
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id BIGINT UNIQUE NOT NULL,
  username TEXT,
  first_name TEXT,
  
  -- Course & filtering preferences
  course_of_study TEXT NOT NULL DEFAULT 'computer_science',
  preferred_locations location_category_enum[] NOT NULL DEFAULT ARRAY['nigeria', 'africa_remote', 'overseas_remote', 'overseas_relocate']::location_category_enum[],
  preferred_work_modes work_mode_enum[] NOT NULL DEFAULT ARRAY['remote', 'onsite', 'hybrid']::work_mode_enum[],
  prioritize_stipend BOOLEAN NOT NULL DEFAULT TRUE,
  prioritize_no_national_id BOOLEAN NOT NULL DEFAULT TRUE,
  target_intake_year INT NOT NULL DEFAULT 2027,
  
  -- Digest delivery settings
  daily_limit INT NOT NULL DEFAULT 20,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- TABLE 2: internships
-- Normalized, deduplicated internship opportunities
-- ============================================================================
CREATE TABLE IF NOT EXISTS internships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 8-char short ID used inside Telegram's 64-byte callback_data limit
  short_id TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(4), 'hex'),
  
  -- Core Metadata
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  source_name TEXT NOT NULL, -- e.g., 'github_simplify_2027', 'greenhouse', 'workable_ng'
  apply_url TEXT NOT NULL,
  url_hash TEXT UNIQUE NOT NULL, -- MD5/SHA256 of normalized apply_url to prevent duplicates
  
  -- Course & Tech Categorization
  course_tags TEXT[] NOT NULL DEFAULT ARRAY['computer_science'],
  role_category TEXT,
  tech_stack TEXT[] DEFAULT '{}',
  
  -- Location & Eligibility
  location_category location_category_enum NOT NULL,
  work_mode work_mode_enum NOT NULL DEFAULT 'remote',
  city_or_country TEXT NOT NULL DEFAULT 'Remote',
  has_stipend BOOLEAN NOT NULL DEFAULT FALSE,
  stipend_note TEXT,
  requires_national_id BOOLEAN NOT NULL DEFAULT FALSE,
  id_requirement_note TEXT,
  
  -- Timeline (Targeted for 2027 IT/Summer)
  target_year INT NOT NULL DEFAULT 2027,
  start_date DATE,
  deadline DATE,
  
  -- Content & Ranking
  summary_bullets TEXT[] DEFAULT '{}',
  priority_score INT NOT NULL DEFAULT 50,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast daily filtering
CREATE INDEX IF NOT EXISTS idx_internships_course_tags ON internships USING GIN (course_tags);
CREATE INDEX IF NOT EXISTS idx_internships_priority ON internships (priority_score DESC, deadline ASC);
CREATE INDEX IF NOT EXISTS idx_internships_short_id ON internships (short_id);
CREATE INDEX IF NOT EXISTS idx_internships_active_deadline ON internships (is_active, deadline);

-- ============================================================================
-- TABLE 3: user_applications
-- State machine tracking each user's interaction with each internship
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  internship_id UUID NOT NULL REFERENCES internships(id) ON DELETE CASCADE,
  
  status application_status_enum NOT NULL DEFAULT 'queued',
  
  -- Telegram message tracking (allows editing the card in-place on button click)
  telegram_message_id BIGINT,
  
  -- Rollover & dispatch metrics
  sent_count INT NOT NULL DEFAULT 0,
  first_sent_at TIMESTAMPTZ,
  last_sent_at TIMESTAMPTZ,
  
  -- Application & Follow-up lifecycle
  applied_at TIMESTAMPTZ,
  next_followup_at TIMESTAMPTZ,
  followup_count INT NOT NULL DEFAULT 0,
  user_notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(user_id, internship_id)
);

CREATE INDEX IF NOT EXISTS idx_user_apps_status ON user_applications (user_id, status);
CREATE INDEX IF NOT EXISTS idx_user_apps_followup ON user_applications (status, next_followup_at)
  WHERE status IN ('applied', 'interviewing');

-- ============================================================================
-- RPC FUNCTION: get_daily_user_digest(p_telegram_id BIGINT, p_limit INT)
-- Returns up to 20 internships for today:
--   1. Unanswered 'sent' internships from previous days (Rollover)
--   2. Highest priority unseen internships matching user's course & location
-- ============================================================================
CREATE OR REPLACE FUNCTION get_daily_user_digest(
  p_telegram_id BIGINT,
  p_limit INT DEFAULT 20
)
RETURNS TABLE (
  internship_id UUID,
  short_id TEXT,
  title TEXT,
  company TEXT,
  location_category location_category_enum,
  work_mode work_mode_enum,
  city_or_country TEXT,
  has_stipend BOOLEAN,
  stipend_note TEXT,
  requires_national_id BOOLEAN,
  id_requirement_note TEXT,
  tech_stack TEXT[],
  start_date DATE,
  deadline DATE,
  summary_bullets TEXT[],
  apply_url TEXT,
  priority_score INT,
  is_rollover BOOLEAN,
  sent_count INT
) AS $$
DECLARE
  v_user users%ROWTYPE;
BEGIN
  -- Fetch user profile
  SELECT * INTO v_user FROM users WHERE telegram_id = p_telegram_id LIMIT 1;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH rollover_items AS (
    -- 1. Previously sent items not yet marked Applied / Not Eligible
    SELECT
      i.id AS internship_id,
      i.short_id,
      i.title,
      i.company,
      i.location_category,
      i.work_mode,
      i.city_or_country,
      i.has_stipend,
      i.stipend_note,
      i.requires_national_id,
      i.id_requirement_note,
      i.tech_stack,
      i.start_date,
      i.deadline,
      i.summary_bullets,
      i.apply_url,
      i.priority_score,
      TRUE AS is_rollover,
      ua.sent_count,
      1 AS sort_group
    FROM user_applications ua
    JOIN internships i ON i.id = ua.internship_id
    WHERE ua.user_id = v_user.id
      AND ua.status = 'sent'
      AND (ua.last_sent_at IS NULL OR ua.last_sent_at::DATE < CURRENT_DATE)
      AND i.is_active = TRUE
      AND (i.deadline IS NULL OR i.deadline >= CURRENT_DATE)
    ORDER BY
      i.deadline ASC NULLS LAST,
      i.priority_score DESC
    LIMIT p_limit
  ),
  fresh_items AS (
    -- 2. New matching internships not yet acted upon
    SELECT
      i.id AS internship_id,
      i.short_id,
      i.title,
      i.company,
      i.location_category,
      i.work_mode,
      i.city_or_country,
      i.has_stipend,
      i.stipend_note,
      i.requires_national_id,
      i.id_requirement_note,
      i.tech_stack,
      i.start_date,
      i.deadline,
      i.summary_bullets,
      i.apply_url,
      i.priority_score,
      FALSE AS is_rollover,
      0 AS sent_count,
      2 AS sort_group
    FROM internships i
    LEFT JOIN user_applications ua
      ON ua.internship_id = i.id AND ua.user_id = v_user.id
    WHERE (ua.id IS NULL OR ua.status = 'queued')
      AND i.is_active = TRUE
      AND i.target_year = v_user.target_intake_year
      AND (v_user.course_of_study = ANY(i.course_tags))
      AND (i.location_category = ANY(v_user.preferred_locations))
      AND (i.deadline IS NULL OR i.deadline >= CURRENT_DATE)
    ORDER BY
      -- Strictly prioritize No National ID + Stipend first
      CASE WHEN v_user.prioritize_no_national_id AND i.requires_national_id = FALSE THEN 0 ELSE 1 END ASC,
      CASE WHEN v_user.prioritize_stipend AND i.has_stipend = TRUE THEN 0 ELSE 1 END ASC,
      i.priority_score DESC,
      i.deadline ASC NULLS LAST
    LIMIT p_limit
  )
  SELECT
    combined.internship_id,
    combined.short_id,
    combined.title,
    combined.company,
    combined.location_category,
    combined.work_mode,
    combined.city_or_country,
    combined.has_stipend,
    combined.stipend_note,
    combined.requires_national_id,
    combined.id_requirement_note,
    combined.tech_stack,
    combined.start_date,
    combined.deadline,
    combined.summary_bullets,
    combined.apply_url,
    combined.priority_score,
    combined.is_rollover,
    combined.sent_count
  FROM (
    SELECT * FROM rollover_items
    UNION ALL
    SELECT * FROM fresh_items
  ) combined
  ORDER BY combined.sort_group ASC, combined.priority_score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- Protects database tables from public anon access via PostgREST
-- ============================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE internships ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_applications ENABLE ROW LEVEL SECURITY;

-- Deny public anon access to sensitive user data
CREATE POLICY "Deny public access to users"
  ON users FOR ALL
  TO anon
  USING (false);

-- Deny public modifications to internship listings
CREATE POLICY "Deny public modifications to internships"
  ON internships FOR INSERT
  TO anon
  WITH CHECK (false);

CREATE POLICY "Deny public updates to internships"
  ON internships FOR UPDATE
  TO anon
  USING (false);

CREATE POLICY "Deny public deletes to internships"
  ON internships FOR DELETE
  TO anon
  USING (false);

-- Allow public read-only access to active internships (useful if exposing public catalog)
CREATE POLICY "Allow anon read active internships"
  ON internships FOR SELECT
  TO anon
  USING (is_active = true);

-- Deny public anon access to user applications pipeline
CREATE POLICY "Deny public access to user_applications"
  ON user_applications FOR ALL
  TO anon
  USING (false);