-- Restrict follows table to approved users only
DROP POLICY IF EXISTS "Follows are viewable by everyone" ON follows;
DROP POLICY IF EXISTS "Users can follow others"          ON follows;
DROP POLICY IF EXISTS "Users can unfollow"               ON follows;

CREATE POLICY "Approved users can view follows"
  ON follows FOR SELECT
  USING (is_approved());

CREATE POLICY "Approved users can follow others"
  ON follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id AND is_approved());

CREATE POLICY "Approved users can unfollow"
  ON follows FOR DELETE
  USING (auth.uid() = follower_id AND is_approved());
