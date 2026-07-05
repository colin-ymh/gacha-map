-- gacha_products.source_type에 'user_manual' 추가
ALTER TABLE gacha_products
  DROP CONSTRAINT gacha_products_source_type_check,
  ADD CONSTRAINT gacha_products_source_type_check
    CHECK (source_type = ANY (ARRAY['official'::text, 'user_manual'::text]));

-- source_url nullable (user_manual은 출처 URL 없음)
ALTER TABLE gacha_products
  ALTER COLUMN source_url DROP NOT NULL;
