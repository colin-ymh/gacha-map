-- shops 테이블에서 사용하지 않는 이미지 컬럼 제거
ALTER TABLE public.shops DROP COLUMN IF EXISTS image_urls;
ALTER TABLE public.shops DROP COLUMN IF EXISTS image_thumbnails;
