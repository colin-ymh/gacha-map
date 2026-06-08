-- Allow users to re-report once per week per shop (previously: once ever)

ALTER TABLE shop_quick_reports
  ADD COLUMN IF NOT EXISTS week_start date NOT NULL DEFAULT date_trunc('week', now())::date;

-- Backfill existing rows with the week_start of their created_at
UPDATE shop_quick_reports
  SET week_start = date_trunc('week', created_at)::date
  WHERE week_start = date_trunc('week', now())::date;

-- Drop old unique constraint (one per user per shop ever)
ALTER TABLE shop_quick_reports
  DROP CONSTRAINT IF EXISTS shop_quick_reports_shop_id_user_id_key;

-- New constraint: one per user per shop per week
ALTER TABLE shop_quick_reports
  ADD CONSTRAINT shop_quick_reports_shop_user_week_key
  UNIQUE(shop_id, user_id, week_start);
