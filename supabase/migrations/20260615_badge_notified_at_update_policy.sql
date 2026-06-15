-- Allow users to update notified_at on their own user_badges rows
CREATE POLICY "user_badges: update own notified_at"
  ON user_badges
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
