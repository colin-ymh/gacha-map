-- Remove per-product-per-user unique constraint on gacha_roll_results
-- to allow unlimited rolls of the same product.
-- DAILY_LIMIT infrastructure kept for future re-enablement.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'gacha_roll_results'
      AND c.contype = 'u'
      AND EXISTS (
        SELECT 1 FROM pg_attribute a
        WHERE a.attrelid = t.oid
          AND a.attname = 'product_id'
          AND a.attnum = ANY(c.conkey)
      )
  LOOP
    EXECUTE format('ALTER TABLE gacha_roll_results DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;
