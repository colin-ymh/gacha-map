CREATE TABLE shop_quick_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('gacha_present', 'gacha_absent')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(shop_id, user_id)
);

CREATE INDEX shop_quick_reports_shop_idx ON shop_quick_reports(shop_id);
CREATE INDEX shop_quick_reports_user_idx ON shop_quick_reports(user_id);

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS contribution_count int NOT NULL DEFAULT 0;

ALTER TABLE shop_quick_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role full access" ON shop_quick_reports
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "authenticated insert own" ON shop_quick_reports
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "authenticated read own" ON shop_quick_reports
  FOR SELECT TO authenticated USING (user_id = auth.uid());
