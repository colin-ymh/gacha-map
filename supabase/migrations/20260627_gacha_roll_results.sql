CREATE TABLE gacha_roll_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  product_id uuid NOT NULL REFERENCES gacha_products(id),
  variant_id uuid NOT NULL REFERENCES gacha_product_variants(id),
  roll_type text NOT NULL DEFAULT 'free_daily',
  rolled_at timestamptz NOT NULL DEFAULT now()
);

-- 상품별 하루 1회 제한 (free_daily 기준, 한국 시간 자정 리셋)
CREATE UNIQUE INDEX gacha_roll_results_user_product_day_free_idx
  ON gacha_roll_results (user_id, product_id, date(rolled_at AT TIME ZONE 'Asia/Seoul'))
  WHERE roll_type = 'free_daily';

-- RLS: INSERT는 service_role만 가능 (클라이언트 INSERT 금지)
ALTER TABLE gacha_roll_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can read own rolls"
  ON gacha_roll_results FOR SELECT
  USING (auth.uid() = user_id);
