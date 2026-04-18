CREATE POLICY "users can view their own reports"
ON reports
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
