-- ============================================================================
-- Supabase Migration: Enable Row Level Security (RLS) & Restrict Anon Access
-- ============================================================================

-- 1. Enable RLS on all core tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE internships ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_applications ENABLE ROW LEVEL SECURITY;

-- 2. Clean up any existing policies
DROP POLICY IF EXISTS "Deny public access to users" ON users;
DROP POLICY IF EXISTS "Deny public modifications to internships" ON internships;
DROP POLICY IF EXISTS "Deny public updates to internships" ON internships;
DROP POLICY IF EXISTS "Deny public deletes to internships" ON internships;
DROP POLICY IF EXISTS "Allow anon read active internships" ON internships;
DROP POLICY IF EXISTS "Deny public access to user_applications" ON user_applications;

-- 3. Apply strict access policies
-- Users table: Fully private to anon; only service_role (backend) can read/write
CREATE POLICY "Deny public access to users"
  ON users FOR ALL
  TO anon
  USING (false);

-- Internships table: Read-only for active items, no modifications from anon
CREATE POLICY "Allow anon read active internships"
  ON internships FOR SELECT
  TO anon
  USING (is_active = true);

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

-- User applications pipeline: Fully private to anon; only service_role can read/write
CREATE POLICY "Deny public access to user_applications"
  ON user_applications FOR ALL
  TO anon
  USING (false);
