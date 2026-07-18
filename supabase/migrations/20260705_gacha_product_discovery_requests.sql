-- gacha_product_observations에 스캔 이미지 URL 저장용 컬럼 추가
ALTER TABLE gacha_product_observations
  ADD COLUMN IF NOT EXISTS image_url text;

-- 공식 상품 조사 큐 (gacha-collector가 처리)
CREATE TABLE IF NOT EXISTS gacha_product_discovery_requests (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  observation_id          uuid REFERENCES gacha_product_observations(id),
  shop_id                 uuid,
  user_manual_product_id  uuid REFERENCES gacha_products(id),
  image_url               text,
  extracted_title_ko      text,
  extracted_title_ja      text,
  manufacturer_hint       text,
  jan_code                text,
  price_krw               integer,
  raw_ocr                 jsonb,
  raw_vision              jsonb,
  status                  text NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','searching','imported','needs_review','no_match','failed')),
  matched_product_id      uuid REFERENCES gacha_products(id),
  candidate_urls          jsonb,
  error_message           text,
  attempt_count           integer NOT NULL DEFAULT 0,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gacha_product_discovery_requests_status_idx
  ON gacha_product_discovery_requests (status, created_at);

CREATE INDEX IF NOT EXISTS gacha_product_discovery_requests_observation_idx
  ON gacha_product_discovery_requests (observation_id);
