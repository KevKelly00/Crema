-- Add approval flag to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_approved boolean NOT NULL DEFAULT false;

-- Approve all existing accounts (i.e. you)
UPDATE profiles SET is_approved = true;

-- Helper function used by RLS policies
CREATE OR REPLACE FUNCTION public.is_approved()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_approved = true
  )
$$;

-- coffee_logs: only approved users can read/write
DROP POLICY IF EXISTS "Users can view own logs"     ON coffee_logs;
DROP POLICY IF EXISTS "Users can insert own logs"   ON coffee_logs;
DROP POLICY IF EXISTS "Users can update own logs"   ON coffee_logs;
DROP POLICY IF EXISTS "Users can delete own logs"   ON coffee_logs;
DROP POLICY IF EXISTS "Authenticated users can view all logs" ON coffee_logs;

CREATE POLICY "Approved users can view all logs"
  ON coffee_logs FOR SELECT
  USING (is_approved());

CREATE POLICY "Approved users can insert own logs"
  ON coffee_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id AND is_approved());

CREATE POLICY "Approved users can update own logs"
  ON coffee_logs FOR UPDATE
  USING (auth.uid() = user_id AND is_approved());

CREATE POLICY "Approved users can delete own logs"
  ON coffee_logs FOR DELETE
  USING (auth.uid() = user_id AND is_approved());

-- beans: only approved users can read/write
DROP POLICY IF EXISTS "Users can view own beans"   ON beans;
DROP POLICY IF EXISTS "Users can insert own beans" ON beans;
DROP POLICY IF EXISTS "Users can update own beans" ON beans;
DROP POLICY IF EXISTS "Users can delete own beans" ON beans;

CREATE POLICY "Approved users can view own beans"
  ON beans FOR SELECT
  USING (auth.uid() = user_id AND is_approved());

CREATE POLICY "Approved users can insert own beans"
  ON beans FOR INSERT
  WITH CHECK (auth.uid() = user_id AND is_approved());

CREATE POLICY "Approved users can update own beans"
  ON beans FOR UPDATE
  USING (auth.uid() = user_id AND is_approved());

CREATE POLICY "Approved users can delete own beans"
  ON beans FOR DELETE
  USING (auth.uid() = user_id AND is_approved());

-- profiles: users can always read their OWN profile (needed for approval check)
-- but can only read others if approved
DROP POLICY IF EXISTS "Users can view own profile"        ON profiles;
DROP POLICY IF EXISTS "Users can view all profiles"       ON profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON profiles;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Approved users can view all profiles"
  ON profiles FOR SELECT
  USING (is_approved());
