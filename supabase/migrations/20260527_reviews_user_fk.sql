-- reviews.user_id FK를 auth.users → user_profiles 로 변경
-- PostgREST embedded resource join을 위해 필요
-- NOT VALID: 기존 데이터 스캔 없이 즉시 적용 (lock 시간 최소화)
ALTER TABLE public.reviews
  DROP CONSTRAINT IF EXISTS reviews_user_id_fkey;

ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.user_profiles(id)
  ON DELETE CASCADE
  NOT VALID;

ALTER TABLE public.reviews
  VALIDATE CONSTRAINT reviews_user_id_fkey;
