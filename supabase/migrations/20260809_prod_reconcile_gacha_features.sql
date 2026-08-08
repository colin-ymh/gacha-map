-- prod 수렴 마이그레이션 — 가챠 쿼터/초대보상/액션보너스/리뷰신고/realtime 푸시
--
-- 배경: prod에는 20260808_gacha_referral_push만 순서를 건너뛰고 먼저 적용돼 있다.
-- plpgsql 함수 본문은 생성 시점에 참조 객체를 검증하지 않으므로
-- record_referral_click / grant_gacha_bonus_event는 "존재하지만 호출하면 죽는"
-- 상태로 남았다. 아래 6개 마이그레이션이 prod에 빠져 있다:
--
--   20260720_review_reports
--   20260806_gacha_referral_rewards
--   20260806_require_variant_image_in_daily_featured_gacha
--   20260807_realtime_push_trigger
--   20260808_gacha_action_bonus
--   20260808_gacha_bonus_push
--
-- 이 파일은 위 6개 + referral_push의 최종 상태를 하나로 합친 것이다.
-- 원본을 그대로 순서대로 적용하면 안 되는 이유:
--
--   1. gacha_bonus_push의 `create function grant_gacha_bonus_event`가 bare CREATE라
--      prod에 이미 있는 동일 시그니처와 충돌한다.
--   2. gacha_bonus_push가 pending_notifications category 제약에서
--      gacha_referral_bonus를 일시적으로 빼고, referral_push가 다시 넣는다.
--      그 사이 초대 클릭이 들어오면 constraint violation이 난다.
--   3. gacha_referral_rewards가 referral_code 백필을 UNIQUE 제약보다 먼저 한다.
--      그래서 assign_referral_code의 unique_violation 재시도가 백필 중엔 무의미하고,
--      중복이 생기면 뒤따르는 ADD CONSTRAINT가 실패해 전체가 롤백된다.
--   4. bare CREATE POLICY / CREATE INDEX / CREATE FUNCTION이 다수 있어
--      중간 실패 후 재시도하면 충돌한다.
--
-- 그래서 이 파일은 **완전 idempotent**하게 작성했다. 모든 객체가 이미 있는
-- dev에 돌려도 에러 없이 통과해야 하며, 그 통과 자체가 멱등성 검증이다.
-- 적용 순서: dev 먼저 → 확인 → prod.

-- ---------------------------------------------------------------------------
-- 1. review_reports (from 20260720_review_reports)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.review_reports (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id                   uuid        REFERENCES public.reviews(id) ON DELETE SET NULL,
  shop_id                     uuid        NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  -- 리뷰가 나중에 삭제돼도 신고 당시 내용을 볼 수 있도록 스냅샷 보관
  review_content_snapshot     text,
  review_image_urls_snapshot  text[]      NOT NULL DEFAULT '{}',
  reason                      text        NOT NULL
                                          CHECK (reason IN ('spam', 'abusive', 'irrelevant', 'fake', 'other')),
  reason_detail                text,
  status                       text        NOT NULL DEFAULT 'pending'
                                          CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_by                 uuid        NOT NULL REFERENCES public.user_profiles(id),
  reviewed_by                  uuid        REFERENCES auth.users(id),
  reviewed_at                  timestamptz,
  created_at                   timestamptz NOT NULL DEFAULT now(),
  CHECK (reason <> 'other' OR char_length(trim(coalesce(reason_detail, ''))) BETWEEN 10 AND 500)
);

ALTER TABLE public.review_reports ENABLE ROW LEVEL SECURITY;

-- 어드민: 전체 권한
DROP POLICY IF EXISTS "admins can manage review_reports" ON public.review_reports;
CREATE POLICY "admins can manage review_reports"
  ON public.review_reports
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 샵 사장님: review_id가 실제로 자기 shop_id 소속일 때만 INSERT 허용
DROP POLICY IF EXISTS "shop owners can report own shop reviews" ON public.review_reports;
CREATE POLICY "shop owners can report own shop reviews"
  ON public.review_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = submitted_by
    AND EXISTS (
      SELECT 1 FROM public.reviews r
      JOIN public.shops s ON s.id = r.shop_id
      WHERE r.id = review_id AND r.shop_id = shop_id AND s.owner_id = auth.uid()
    )
  );

-- 샵 사장님: 자기가 제출한 신고만 SELECT 허용
DROP POLICY IF EXISTS "shop owners can view own review reports" ON public.review_reports;
CREATE POLICY "shop owners can view own review reports"
  ON public.review_reports
  FOR SELECT
  TO authenticated
  USING (auth.uid() = submitted_by);

CREATE INDEX IF NOT EXISTS review_reports_status_idx ON public.review_reports(status);
CREATE INDEX IF NOT EXISTS review_reports_review_id_idx ON public.review_reports(review_id);

-- ---------------------------------------------------------------------------
-- 2. user_profiles.referral_code (from 20260806_gacha_referral_rewards)
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

-- ⚠️ 원본과 순서가 다르다. UNIQUE 제약을 백필보다 **먼저** 건다.
-- 원본은 백필 후에 제약을 걸어서, 백필 중 발생한 코드 충돌을
-- assign_referral_code의 unique_violation 핸들러가 잡을 수 없었다
-- (제약이 없으면 중복 UPDATE가 그냥 성공한다). 그 결과 중복이 남으면
-- 뒤따르는 ADD CONSTRAINT가 실패해 마이그레이션 전체가 롤백된다.
-- 제약을 먼저 걸면 재시도 로직이 실제로 동작한다. referral_code가
-- 전부 NULL인 상태에서 UNIQUE를 걸어도 NULL끼리는 충돌하지 않는다.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_profiles_referral_code_key'
      AND conrelid = 'public.user_profiles'::regclass
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_referral_code_key UNIQUE (referral_code);
  END IF;
END $$;

-- 기존 행 백필. WHERE referral_code IS NULL이라 재실행해도 이미 채운 행은 건드리지 않는다.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.user_profiles WHERE referral_code IS NULL LOOP
    PERFORM public.assign_referral_code(r.id);
  END LOOP;
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

REVOKE ALL ON FUNCTION public.assign_referral_code(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_referral_code(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 3. gacha_referral_clicks (from 20260806_gacha_referral_rewards)
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
DROP POLICY IF EXISTS "inviters can read own referral clicks" ON public.gacha_referral_clicks;
CREATE POLICY "inviters can read own referral clicks"
  ON public.gacha_referral_clicks FOR SELECT
  USING (auth.uid() = inviter_id);

-- ---------------------------------------------------------------------------
-- 4. gacha_bonus_events (from 20260808_gacha_action_bonus)
-- ---------------------------------------------------------------------------

create table if not exists public.gacha_bonus_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null check (source_type in ('review', 'shop_report', 'gacha_report')),
  source_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, source_type, source_id)
);

create index if not exists gacha_bonus_events_user_created_idx
  on public.gacha_bonus_events (user_id, created_at);

alter table public.gacha_bonus_events enable row level security;

-- INSERT는 service_role만 (정책 부재 = 거부). 본인은 자기 적립 내역만 읽는다.
drop policy if exists "users can read own bonus events" on public.gacha_bonus_events;
create policy "users can read own bonus events"
  on public.gacha_bonus_events for select
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 5. 쿼터 함수 (from 20260806_gacha_referral_rewards + 20260808_gacha_action_bonus)
--
-- 원본은 3/5인자 버전을 먼저 만들고 action_bonus에서 DROP 후 4/6인자로
-- 다시 만든다. 중간 산물이므로 여기서는 최종 4/6인자만 만든다.
-- 구 오버로드(3/5인자) DROP은 유지한다 — prod에는 없지만 dev에는 과거에
-- 있었고, 어느 환경에서든 잔재가 남아 PostgREST 오버로드 모호성
-- (PGRST203)을 유발하는 것을 확실히 막는다.
-- 최종 시그니처도 선행 DROP한다 — 원본이 bare CREATE FUNCTION이라
-- 재시도 시 "already exists with same argument types"로 실패한다.
-- ---------------------------------------------------------------------------

-- KST 오늘 자정을 timestamptz로. rolled_at 인덱스를 그대로 탄다.
CREATE OR REPLACE FUNCTION public.kst_today_start()
RETURNS timestamptz
LANGUAGE sql
STABLE
AS $$
  SELECT date_trunc('day', now() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul';
$$;

-- 구 오버로드 제거
drop function if exists public.get_daily_roll_quota(uuid, int, int);
drop function if exists public.consume_daily_roll(uuid, uuid, uuid, int, int);
-- 최종 시그니처도 제거 (재시도 안전)
drop function if exists public.get_daily_roll_quota(uuid, int, int, int);
drop function if exists public.consume_daily_roll(uuid, uuid, uuid, int, int, int);

create function public.get_daily_roll_quota(
  p_user_id uuid,
  p_base int,
  p_bonus_max int,
  p_action_bonus_max int
)
returns table(base int, bonus int, used int, remaining int)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_day_start timestamptz := public.kst_today_start();
  v_referral_bonus int;
  v_action_bonus int;
  v_used int;
begin
  select least(p_bonus_max, count(*))::int into v_referral_bonus
  from public.gacha_referral_clicks
  where inviter_id = p_user_id
    and clicked_at >= v_day_start;

  select least(p_action_bonus_max, count(*))::int into v_action_bonus
  from public.gacha_bonus_events
  where user_id = p_user_id
    and created_at >= v_day_start;

  select count(*)::int into v_used
  from public.gacha_roll_results
  where user_id = p_user_id
    and roll_type = 'free_daily'
    and rolled_at >= v_day_start;

  return query select
    p_base,
    v_referral_bonus + v_action_bonus,
    v_used,
    greatest(0, p_base + v_referral_bonus + v_action_bonus - v_used);
end;
$$;

-- 쿼터 확인과 INSERT를 한 트랜잭션 안에서 처리한다.
-- PostgREST는 요청당 단일 트랜잭션이므로 advisory lock이 요청 끝까지 유지된다.
-- 반환하는 used_after/remaining_after는 이번 INSERT를 포함한 값이다.
-- 호출자는 절대 재계산하지 않는다 (off-by-one 방지).
create function public.consume_daily_roll(
  p_user_id uuid,
  p_product_id uuid,
  p_variant_id uuid,
  p_base int,
  p_bonus_max int,
  p_action_bonus_max int
)
returns table(roll_id uuid, base int, bonus int, used_after int, remaining_after int)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_day_start timestamptz := public.kst_today_start();
  v_referral_bonus int;
  v_action_bonus int;
  v_bonus int;
  v_used int;
  v_roll uuid;
begin
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  select least(p_bonus_max, count(*))::int into v_referral_bonus
  from public.gacha_referral_clicks
  where inviter_id = p_user_id
    and clicked_at >= v_day_start;

  select least(p_action_bonus_max, count(*))::int into v_action_bonus
  from public.gacha_bonus_events
  where user_id = p_user_id
    and created_at >= v_day_start;

  v_bonus := v_referral_bonus + v_action_bonus;

  select count(*)::int into v_used
  from public.gacha_roll_results
  where user_id = p_user_id
    and roll_type = 'free_daily'
    and rolled_at >= v_day_start;

  if v_used >= p_base + v_bonus then
    -- 소진. 예외 대신 roll_id NULL로 알린다.
    return query select null::uuid, p_base, v_bonus, v_used, 0;
    return;
  end if;

  insert into public.gacha_roll_results (user_id, product_id, variant_id, roll_type)
  values (p_user_id, p_product_id, p_variant_id, 'free_daily')
  returning id into v_roll;

  v_used := v_used + 1;

  return query select
    v_roll,
    p_base,
    v_bonus,
    v_used,
    greatest(0, p_base + v_bonus - v_used);
end;
$$;

-- p_base를 인자로 받는 SECURITY DEFINER 함수다. 클라이언트가 직접 호출해
-- p_base=9999를 넘기면 제한이 무의미해진다. 서버(service_role) 전용으로 잠근다.
revoke all on function public.get_daily_roll_quota(uuid, int, int, int) from public, anon, authenticated;
revoke all on function public.consume_daily_roll(uuid, uuid, uuid, int, int, int) from public, anon, authenticated;

grant execute on function public.get_daily_roll_quota(uuid, int, int, int) to service_role;
grant execute on function public.consume_daily_roll(uuid, uuid, uuid, int, int, int) to service_role;

-- ---------------------------------------------------------------------------
-- 6. get_daily_featured_gacha — 이미지 있는 variant 필수
--    (from 20260806_require_variant_image_in_daily_featured_gacha)
--
-- 원본의 BEGIN/COMMIT은 제거했다. apply_migration이 파일 전체를 한
-- 트랜잭션으로 감싸므로 중첩 트랜잭션 블록이 되면 안 된다.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_daily_featured_gacha(
  p_date date DEFAULT ((now() AT TIME ZONE 'Asia/Seoul')::date),
  p_count integer DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  manufacturer text,
  name text,
  name_ja text,
  name_ko text,
  name_en text,
  official_image_url text,
  types_count integer,
  release_month text,
  rank integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing_count integer;
BEGIN
  -- Serialize per-date generation so concurrent first-requests of the day
  -- can't race and produce two different picks for the same date.
  PERFORM pg_advisory_xact_lock(hashtext('daily_featured_gacha:' || p_date::text));

  SELECT count(*) INTO v_existing_count
  FROM public.daily_featured_gacha dfg
  WHERE dfg.featured_date = p_date;

  IF v_existing_count = 0 THEN
    -- Retention: this only runs once per day (guarded by v_existing_count),
    -- so there's no need for a separate pg_cron job just to keep this
    -- table from growing forever.
    DELETE FROM public.daily_featured_gacha
    WHERE featured_date < p_date - INTERVAL '30 days';

    -- Column aliases avoid clashing with this function's own OUT
    -- parameter names (e.g. "id"), which PL/pgSQL treats as ambiguous.
    WITH excluded AS (
      SELECT dfg.product_id AS pid, max(dfg.featured_date) AS last_shown
      FROM public.daily_featured_gacha dfg
      WHERE dfg.featured_date >= p_date - INTERVAL '7 days'
        AND dfg.featured_date < p_date
      GROUP BY dfg.product_id
    ),
    eligible AS (
      SELECT p.id AS pid
      FROM public.gacha_products p
      WHERE p.status = 'active'
        AND p.official_image_url IS NOT NULL
        AND btrim(p.official_image_url) <> ''
        AND EXISTS (
          SELECT 1
          FROM public.gacha_product_variants v
          WHERE v.product_id = p.id
            AND v.status = 'active'
            AND v.image_url IS NOT NULL
            AND btrim(v.image_url) <> ''
        )
    ),
    fresh AS (
      SELECT e.pid
      FROM eligible e
      LEFT JOIN excluded x ON x.pid = e.pid
      WHERE x.pid IS NULL
      ORDER BY md5(p_date::text || e.pid::text)
    ),
    stale AS (
      SELECT e.pid, x.last_shown
      FROM eligible e
      JOIN excluded x ON x.pid = e.pid
      ORDER BY x.last_shown ASC, md5(p_date::text || e.pid::text)
    ),
    picked AS (
      SELECT u.pid, row_number() OVER () AS rn
      FROM (
        SELECT pid FROM fresh
        UNION ALL
        SELECT pid FROM stale
      ) u
      LIMIT p_count
    )
    INSERT INTO public.daily_featured_gacha (featured_date, product_id, rank)
    SELECT p_date, picked.pid, picked.rn FROM picked
    ON CONFLICT (featured_date, product_id) DO NOTHING;
  END IF;

  RETURN QUERY
  SELECT
    gp.id,
    gp.manufacturer,
    gp.name,
    gp.name_ja,
    gp.name_ko,
    gp.name_en,
    gp.official_image_url,
    gp.types_count,
    gp.release_month::text,
    dfg.rank
  FROM public.daily_featured_gacha dfg
  JOIN public.gacha_products gp ON gp.id = dfg.product_id
  WHERE dfg.featured_date = p_date
  ORDER BY dfg.rank;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_featured_gacha(date, integer) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. realtime push dispatch (from 20260807_realtime_push_trigger)
--
-- 실제 URL/secret 값은 이 파일에 없음 — dev/prod 프로젝트마다 다르므로
-- 적용 후 별도 execute_sql로 vault.create_secret 호출해 수동 주입한다.
-- (secret 이름: push_trigger_url, db_cron_secret)
--
-- ⚠️ prod 주입 순서 주의: main 브랜치의 cron route는 CRON_SECRET만 검증한다.
-- DB_CRON_SECRET을 받는 것은 develop 버전뿐이므로, 웹을 prod에 배포하기 전에
-- db_cron_secret을 넣으면 트리거가 401을 받고 조용히 실패한다.
-- ---------------------------------------------------------------------------

create extension if not exists supabase_vault;
create extension if not exists pg_net;
create extension if not exists pg_cron;

-- 트리거 debounce용 단일 row 상태 테이블. 짧은 시간에 여러 INSERT 문이
-- 연달아 와도 dispatch 호출을 과도하게 하지 않기 위함 (statement-level
-- 트리거라 위시리스트 fan-out처럼 한 INSERT 문에 수천 row가 들어가도
-- 애초에 트리거는 1번만 도는데, 이건 짧은 간격의 "여러 번의 INSERT 문"을
-- 추가로 제어하기 위한 것).
create table if not exists public.notification_dispatch_state (
  id boolean primary key default true,
  last_dispatched_at timestamptz,
  constraint notification_dispatch_state_single_row check (id)
);
insert into public.notification_dispatch_state (id) values (true) on conflict do nothing;

-- ⚠️ 원본에 없던 보강. 이 테이블은 public 스키마에 있어 Supabase 기본 grant로
-- PostgREST에 노출된다. dispatch debounce 내부 상태라 클라이언트가 볼 이유가
-- 없다. RLS를 켜고 정책을 두지 않으면 anon/authenticated는 전부 거부되고,
-- SECURITY DEFINER인 트리거 함수와 service_role은 그대로 통과한다.
alter table public.notification_dispatch_state enable row level security;
revoke all on table public.notification_dispatch_state from anon, authenticated;

create or replace function public.trigger_dispatch_pending_notifications()
returns trigger
language plpgsql
security definer
set search_path = public, vault, net
as $$
declare
  v_should_dispatch boolean;
  v_url text;
  v_secret text;
begin
  -- 예외가 나도 원본 INSERT는 항상 성공해야 한다.
  begin
    update notification_dispatch_state
      set last_dispatched_at = now()
      where id = true
        and (last_dispatched_at is null or last_dispatched_at < now() - interval '3 seconds')
    returning true into v_should_dispatch;

    if not coalesce(v_should_dispatch, false) then
      return null;
    end if;

    select decrypted_secret into v_url
      from vault.decrypted_secrets where name = 'push_trigger_url';
    select decrypted_secret into v_secret
      from vault.decrypted_secrets where name = 'db_cron_secret';

    if v_url is null or v_secret is null then
      return null;
    end if;

    perform net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || v_secret,
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    );
  exception when others then
    null;
  end;

  return null;
end;
$$;

drop trigger if exists pending_notifications_dispatch on public.pending_notifications;
create trigger pending_notifications_dispatch
after insert on public.pending_notifications
for each statement
execute function public.trigger_dispatch_pending_notifications();

-- Phase A 안전망(트리거가 놓친 row) + Phase B(영수증 확인) 5분 주기.
-- URL/secret은 vault에서 읽으므로 여기도 값 자체는 노출되지 않는다.
-- cron.schedule은 동일 jobname을 upsert하므로 재실행해도 job이 중복되지 않는다.
-- job 등록 자체는 무조건 이뤄지고, secret 존재 검사는 job command 안에 있다 —
-- 즉 secret 주입 전에도 job은 등록되며 아무 일도 하지 않는다.
select cron.schedule(
  'send-pending-notifications',
  '*/5 * * * *',
  $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'push_trigger_url'),
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'db_cron_secret'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'push_trigger_url');
  $cron$
);

-- ---------------------------------------------------------------------------
-- 8. 알림 설정 + category 제약
--    (from 20260808_gacha_bonus_push + 20260808_gacha_referral_push)
--
-- ⚠️ 원본은 bonus_push가 gacha_referral_bonus를 뺀 집합으로 제약을 다시 걸고
-- referral_push가 다시 넣는다. 그 사이 초대 클릭이 들어오면
-- (api/referral/click이 gacha_referral_bonus를 enqueue) constraint violation이
-- 난다. 여기서는 중간 단계를 없애고 최종 집합을 한 번만 적용한다.
-- ---------------------------------------------------------------------------

alter table public.notification_preferences
  add column if not exists gacha_bonus boolean not null default true;

alter table public.notification_preferences
  add column if not exists gacha_referral_bonus boolean not null default true;

alter table public.pending_notifications
  drop constraint if exists pending_notifications_category_check;

alter table public.pending_notifications
  add constraint pending_notifications_category_check
  check (category in (
    'report_result', 'shop_owner_activity', 'wishlist_news', 'badge',
    'shop_owner_update', 'wishlist_product_update', 'product_wishlist_restock',
    'gacha_bonus', 'gacha_referral_bonus'
  ));

-- ---------------------------------------------------------------------------
-- 9. 초대 클릭 / 액션 보너스 적립 함수 (최종본, from 20260808_gacha_referral_push)
--
-- record_referral_click은 gacha_referral_clicks INSERT + "오늘 몇 번째 클릭인지"
-- + notification_preferences 확인을 한 함수에서 원자적으로 처리한다.
-- consume_daily_roll/grant_gacha_bonus_event와 동일하게 advisory lock으로
-- 초대자별 직렬화한다(락 키는 따로 둬서 롤 소비/액션 보너스 로직과 안 얽히게 한다).
--
-- 중복 클릭(같은 inviter+visitor+오늘)은 gacha_referral_clicks_daily_uniq
-- 유니크 인덱스가 막는다. 이 인덱스는 함수형 인덱스라 ON CONFLICT (...) 타겟
-- 매칭이 까다로워, assign_referral_code가 이미 쓰는 예외 처리 패턴
-- (BEGIN ... EXCEPTION WHEN unique_violation)을 그대로 따른다.
--
-- ⚠️ grant_gacha_bonus_event는 bonus_push의 중간 버전(푸시 확인 포함)을 건너뛰고
-- referral_push의 최종 버전(토스트 전용, 상한 판단만)만 만든다. prod에 이미
-- 동일 시그니처가 존재하므로 bare CREATE는 충돌한다 — 선행 DROP이 필수다.
-- ---------------------------------------------------------------------------

create or replace function public.record_referral_click(
  p_inviter_id uuid,
  p_visitor_id uuid,
  p_variant_id uuid,
  p_bonus_max int
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_click_id uuid;
  v_count int;
  v_pref_on boolean;
begin
  perform pg_advisory_xact_lock(hashtext(p_inviter_id::text || ':referral_click'));

  begin
    insert into public.gacha_referral_clicks (inviter_id, visitor_id, variant_id)
    values (p_inviter_id, p_visitor_id, p_variant_id)
    returning id into v_click_id;
  exception when unique_violation then
    -- 오늘 이미 인정된 (초대자, 방문자) 조합 — 새로 적립된 게 아니므로 알릴 것 없음
    return false;
  end;

  select count(*)::int into v_count
  from public.gacha_referral_clicks
  where inviter_id = p_inviter_id
    and clicked_at >= public.kst_today_start();

  select np.gacha_referral_bonus into v_pref_on
  from public.notification_preferences np
  where np.user_id = p_inviter_id;

  -- 오늘 상한 이내에 든 클릭이라 실제로 뽑기 기회가 늘었고, 알림 설정도 켜져
  -- 있을 때만 true. 상한을 넘긴 클릭은 행은 쌓이지만(집계용) 알리지 않는다 —
  -- consume_daily_roll이 least(p_bonus_max, count(*))로 상한을 적용하는 것과
  -- 동일한 의미.
  return v_count <= p_bonus_max and coalesce(v_pref_on, true);
end;
$$;

revoke all on function public.record_referral_click(uuid, uuid, uuid, int) from public, anon, authenticated;
grant execute on function public.record_referral_click(uuid, uuid, uuid, int) to service_role;

-- 리뷰/제보 보너스는 토스트로만 알린다. notification_preferences 확인은
-- 의미가 없으므로(푸시가 없으니) 제거하고, "오늘 상한 이내에 든
-- 이벤트인지"(= 실제로 뽑기 기회가 늘었는지)만 반환한다.
drop function if exists public.grant_gacha_bonus_event(uuid, text, uuid, int);

create function public.grant_gacha_bonus_event(
  p_user_id uuid,
  p_source_type text,
  p_source_id uuid,
  p_action_bonus_max int
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_count int;
begin
  perform pg_advisory_xact_lock(hashtext(p_user_id::text || ':gacha_bonus_grant'));

  insert into public.gacha_bonus_events (user_id, source_type, source_id)
  values (p_user_id, p_source_type, p_source_id)
  on conflict (user_id, source_type, source_id) do nothing
  returning id into v_id;

  -- 중복 제출(이미 적립된 액션 재시도) — 새로 적립된 게 아니므로 false
  if v_id is null then
    return false;
  end if;

  select count(*)::int into v_count
  from public.gacha_bonus_events
  where user_id = p_user_id
    and created_at >= public.kst_today_start();

  return v_count <= p_action_bonus_max;
end;
$$;

revoke all on function public.grant_gacha_bonus_event(uuid, text, uuid, int) from public, anon, authenticated;
grant execute on function public.grant_gacha_bonus_event(uuid, text, uuid, int) to service_role;

NOTIFY pgrst, 'reload schema';
