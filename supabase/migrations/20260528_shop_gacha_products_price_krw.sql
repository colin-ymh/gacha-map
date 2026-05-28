-- 기존 UNIQUE 제약 제거 (partial index로 교체)
ALTER TABLE shop_gacha_products
  DROP CONSTRAINT shop_gacha_products_shop_id_gacha_product_id_key;

-- price_krw 컬럼 추가
ALTER TABLE shop_gacha_products ADD COLUMN price_krw INTEGER;

-- partial unique index: 샵 오너는 상품당 1건
CREATE UNIQUE INDEX sgp_shop_owner_unique
  ON shop_gacha_products(shop_id, gacha_product_id)
  WHERE source = 'shop_owner';

-- partial unique index: 사용자는 샵+상품당 1건
CREATE UNIQUE INDEX sgp_user_report_unique
  ON shop_gacha_products(shop_id, gacha_product_id, reported_by)
  WHERE source = 'user_report';

-- RLS INSERT 정책 교체: 일반 유저는 user_report만 생성 가능
DROP POLICY IF EXISTS "users can insert own shop_gacha_products" ON shop_gacha_products;
CREATE POLICY "users can insert own shop_gacha_products"
  ON shop_gacha_products FOR INSERT
  WITH CHECK (
    auth.uid() = reported_by
    AND source = 'user_report'
    AND verified_by IS NULL
    AND verified_at IS NULL
  );

-- RLS UPDATE 정책 교체: user_report만 수정 가능
DROP POLICY IF EXISTS "users can update own shop_gacha_products" ON shop_gacha_products;
CREATE POLICY "users can update own shop_gacha_products"
  ON shop_gacha_products FOR UPDATE
  USING (auth.uid() = reported_by AND source = 'user_report')
  WITH CHECK (
    auth.uid() = reported_by
    AND source = 'user_report'
    AND verified_by IS NULL
    AND verified_at IS NULL
  );

-- DELETE RLS 정책 추가 (user_report 본인 미검증 레코드만)
DROP POLICY IF EXISTS "users can delete own shop_gacha_products" ON shop_gacha_products;
CREATE POLICY "users can delete own shop_gacha_products"
  ON shop_gacha_products FOR DELETE
  USING (
    auth.uid() = reported_by
    AND source = 'user_report'
    AND verified_by IS NULL
    AND verified_at IS NULL
  );
