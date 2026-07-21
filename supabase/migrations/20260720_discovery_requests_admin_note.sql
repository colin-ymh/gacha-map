-- 관리자가 콜렉터 재조사 요청 시 남기는 노트
ALTER TABLE gacha_product_discovery_requests
  ADD COLUMN IF NOT EXISTS admin_note text;
