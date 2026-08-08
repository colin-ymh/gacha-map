-- 가챠 일일 뽑기 쿼터 + 친구 초대 보상
--
-- 정책:
--   - 기본 하루 N회 (KST 0시 리셋, 이월 없음)
--   - 공유 링크를 친구가 열면 초대자에게 +1회. 한 친구당 하루 1회, 하루 상한 M회
--   - N/M 값은 앱 상수(apps/web/src/constants/gacha-roll.ts)가 소유하고 여기로 넘긴다.
--     SQL에 하드코딩하면 이중 관리가 되므로 파라미터로만 받는다.

-- ---------------------------------------------------------------------------
-- 1. user_profiles.referral_code
-- ---------------------------------------------------------------------------

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS referral_code text;

-- 혼동되는 글자(I, O, 0, 1)를 뺀 32자 알파벳. 10자리 = 약 1e15 조합.
CREATE OR REPLACE FUNCTION public.gen_referral_code()
RETURNS text
LANGUAGE sql
VOLATILE
AS $$
  SELECT string_agg(
    substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (floor(random() * 32) + 1)::int, 1),
    ''
  )
  FROM generate_series(1, 10);
$$;

-- UNIQUE 충돌은 재시도로 흡수한다. 단순 UPDATE는 충돌 시 문장 전체가 실패한다.
CREATE OR REPLACE FUNCTION public.assign_referral_code(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing text;
  v_code text;
BEGIN
  SELECT referral_code INTO v_existing FROM public.user_profiles WHERE id = p_user_id;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  FOR i IN 1..10 LOOP
    v_code := public.gen_referral_code();
    BEGIN
      UPDATE public.user_profiles
        SET referral_code = v_code
        WHERE id = p_user_id AND referral_code IS NULL;
      IF FOUND THEN
        RETURN v_code;
      END IF;
      -- 경쟁 트랜잭션이 먼저 채운 경우
      SELECT referral_code INTO v_existing FROM public.user_profiles WHERE id = p_user_id;
      RETURN v_existing;
    EXCEPTION WHEN unique_violation THEN
      -- 코드 충돌. 다음 루프에서 재시도한다.
    END;
  END LOOP;

  RAISE EXCEPTION 'failed to assign referral_code for %', p_user_id;
END;
$$;

-- 기존 행 백필
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.user_profiles WHERE referral_code IS NULL LOOP
    PERFORM public.assign_referral_code(r.id);
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_referral_code_key'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_referral_code_key UNIQUE (referral_code);
  END IF;
END $$;

-- 신규 가입 시 자동 발급.
-- 기존 handle_new_user는 프로필 insert만 했다. insert 이후에 코드를 붙인다.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
begin
  insert into public.user_profiles (id, email, name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      null
    ),
    coalesce(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture',
      null
    )
  );

  perform public.assign_referral_code(new.id);

  return new;
end;
$$;

-- user_profiles에는 "users can update own profile" (auth.uid() = id) UPDATE 정책이 열려 있어
-- 클라이언트가 자기 referral_code를 임의 값으로 바꿔 남의 코드를 선점할 수 있다.
-- PostgREST 요청(role = authenticated/anon)에서 오는 변경만 거부한다.
-- service_role 및 마이그레이션/서버 직접 실행은 통과시킨다.
CREATE OR REPLACE FUNCTION public.protect_referral_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_role text;
BEGIN
  IF NEW.referral_code IS DISTINCT FROM OLD.referral_code THEN
    v_role := coalesce(
      current_setting('request.jwt.claim.role', true),
      (nullif(current_setting('request.jwt.claims', true), '')::json->>'role')
    );
    IF v_role IN ('authenticated', 'anon') THEN
      RAISE EXCEPTION 'referral_code is read-only';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_referral_code_trigger ON public.user_profiles;
CREATE TRIGGER protect_referral_code_trigger
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_referral_code();

-- ---------------------------------------------------------------------------
-- 2. gacha_referral_clicks
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.gacha_referral_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  visitor_id uuid NOT NULL,
  variant_id uuid REFERENCES public.gacha_product_variants(id) ON DELETE SET NULL,
  clicked_at timestamptz NOT NULL DEFAULT now()
);

-- 한 친구(브라우저 프로필)당 하루 1회만 인정.
-- date(timestamptz AT TIME ZONE '<상수>')는 IMMUTABLE이라 인덱스 식으로 쓸 수 있다.
CREATE UNIQUE INDEX IF NOT EXISTS gacha_referral_clicks_daily_uniq
  ON public.gacha_referral_clicks
     (inviter_id, visitor_id, (date(clicked_at AT TIME ZONE 'Asia/Seoul')));

-- 쿼터 계산이 초대자+오늘로 조회한다.
CREATE INDEX IF NOT EXISTS gacha_referral_clicks_inviter_clicked_at_idx
  ON public.gacha_referral_clicks (inviter_id, clicked_at);

ALTER TABLE public.gacha_referral_clicks ENABLE ROW LEVEL SECURITY;

-- INSERT는 service_role만 (정책 부재 = 거부). 초대자는 자기 유입 기록만 읽는다.
CREATE POLICY "inviters can read own referral clicks"
  ON public.gacha_referral_clicks FOR SELECT
  USING (auth.uid() = inviter_id);

-- ---------------------------------------------------------------------------
-- 3. 쿼터 함수
-- ---------------------------------------------------------------------------

-- KST 오늘 자정을 timestamptz로. rolled_at 인덱스를 그대로 탄다.
CREATE OR REPLACE FUNCTION public.kst_today_start()
RETURNS timestamptz
LANGUAGE sql
STABLE
AS $$
  SELECT date_trunc('day', now() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul';
$$;

CREATE OR REPLACE FUNCTION public.get_daily_roll_quota(
  p_user_id uuid,
  p_base int,
  p_bonus_max int
)
RETURNS TABLE(base int, bonus int, used int, remaining int)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_day_start timestamptz := public.kst_today_start();
  v_bonus int;
  v_used int;
BEGIN
  SELECT least(p_bonus_max, count(*))::int INTO v_bonus
  FROM public.gacha_referral_clicks
  WHERE inviter_id = p_user_id
    AND clicked_at >= v_day_start;

  SELECT count(*)::int INTO v_used
  FROM public.gacha_roll_results
  WHERE user_id = p_user_id
    AND roll_type = 'free_daily'
    AND rolled_at >= v_day_start;

  RETURN QUERY SELECT
    p_base,
    v_bonus,
    v_used,
    greatest(0, p_base + v_bonus - v_used);
END;
$$;

-- 쿼터 확인과 INSERT를 한 트랜잭션 안에서 처리한다.
-- PostgREST는 요청당 단일 트랜잭션이므로 advisory lock이 요청 끝까지 유지된다.
-- 반환하는 used_after/remaining_after는 이번 INSERT를 포함한 값이다.
-- 호출자는 절대 재계산하지 않는다 (off-by-one 방지).
CREATE OR REPLACE FUNCTION public.consume_daily_roll(
  p_user_id uuid,
  p_product_id uuid,
  p_variant_id uuid,
  p_base int,
  p_bonus_max int
)
RETURNS TABLE(roll_id uuid, base int, bonus int, used_after int, remaining_after int)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_day_start timestamptz := public.kst_today_start();
  v_bonus int;
  v_used int;
  v_roll uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));

  SELECT least(p_bonus_max, count(*))::int INTO v_bonus
  FROM public.gacha_referral_clicks
  WHERE inviter_id = p_user_id
    AND clicked_at >= v_day_start;

  SELECT count(*)::int INTO v_used
  FROM public.gacha_roll_results
  WHERE user_id = p_user_id
    AND roll_type = 'free_daily'
    AND rolled_at >= v_day_start;

  IF v_used >= p_base + v_bonus THEN
    -- 소진. 예외 대신 roll_id NULL로 알린다.
    RETURN QUERY SELECT NULL::uuid, p_base, v_bonus, v_used, 0;
    RETURN;
  END IF;

  INSERT INTO public.gacha_roll_results (user_id, product_id, variant_id, roll_type)
  VALUES (p_user_id, p_product_id, p_variant_id, 'free_daily')
  RETURNING id INTO v_roll;

  v_used := v_used + 1;

  RETURN QUERY SELECT
    v_roll,
    p_base,
    v_bonus,
    v_used,
    greatest(0, p_base + v_bonus - v_used);
END;
$$;

-- p_base를 인자로 받는 SECURITY DEFINER 함수다. 클라이언트가 직접 호출해
-- p_base=9999를 넘기면 제한이 무의미해진다. 서버(service_role) 전용으로 잠근다.
REVOKE ALL ON FUNCTION public.get_daily_roll_quota(uuid, int, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_daily_roll(uuid, uuid, uuid, int, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assign_referral_code(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_daily_roll_quota(uuid, int, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_daily_roll(uuid, uuid, uuid, int, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.assign_referral_code(uuid) TO service_role;
