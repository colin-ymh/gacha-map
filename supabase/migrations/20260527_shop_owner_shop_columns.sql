-- shops 테이블에 사업자가 관리할 수 있는 필드 추가
ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS opening_hours text;
