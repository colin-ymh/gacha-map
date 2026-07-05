ALTER TABLE gacha_product_observations
  DROP CONSTRAINT gacha_product_observations_source_type_check,
  ADD CONSTRAINT gacha_product_observations_source_type_check
    CHECK (source_type = ANY (ARRAY['user_photo'::text, 'admin_photo'::text, 'domestic_vendor'::text, 'user_manual'::text]));
