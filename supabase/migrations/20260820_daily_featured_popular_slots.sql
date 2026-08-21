-- 오늘의 가챠 — 인기 슬롯 도입
--
-- 배경: get_daily_featured_gacha()는 순수 랜덤이었다. 후보 풀에서
-- md5(날짜 + 상품id) 순으로 섞어 10개를 뽑고 7일 내 재등장만 막았다.
-- 사용자 행동(찜·뽑기)이 선정에 전혀 반영되지 않았다.
--
-- 변경: 10칸 중 앞 3칸을 "인기 슬롯"으로 떼고, 나머지 7칸은 기존 랜덤 로직을
-- 그대로 유지한다. 인기 점수 = 찜 + 뽑기에 시간 감쇠를 적용한 값.
--
-- 왜 윈도우가 14일인가 (prod 실측, 2026-08-20):
--   eligible + 최소 2명 조건을 통과하는 후보 수
--     7일 → 1개    14일 → 14개    30일 → 14개    60일 → 18개
--   7일로는 후보가 1개뿐이라 3칸 중 2칸이 항상 랜덤 폴백된다. 즉 기능이
--   동작하지 않으면서 복잡도만 늘어난다. 30일 이상으로 늘려도 후보가 더
--   늘지 않으므로 14일이 최적점이다.
--   최근성은 윈도우가 아니라 시간 감쇠가 담당한다(반감기 5일 → 14일 전
--   활동은 오늘 활동의 약 14% 가중치).
--
-- 실행 전 예상 영향:
--   - daily_featured_gacha에 slot_type 컬럼 추가 (기존 행은 전부 'random',
--     과거엔 랜덤만 존재했으므로 사실과 일치).
--   - 인덱스 2개 추가.
--   - get_daily_featured_gacha() DROP 후 재생성.
--   - 이미 뽑힌 날짜의 행은 건드리지 않는다. 즉 오늘 목록은 바뀌지 않고,
--     내일 첫 호출부터 새 로직이 적용된다.
--
-- 반환 컬럼은 현행과 100% 동일하다. slot_type / 점수를 반환에 넣지 않으므로
-- apps/web·apps/mobile·packages/shared 수정이 전혀 필요 없다. DB만 배포하면 된다.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) 스키마
-- ---------------------------------------------------------------------------
-- slot_type은 인기 슬롯에만 다른 쿨다운을 적용하기 위해 저장이 필요하다.
-- (랜덤은 7일 재등장 후순위, 인기는 2일 쿨다운으로 규칙이 다르다)
ALTER TABLE public.daily_featured_gacha
  ADD COLUMN IF NOT EXISTS slot_type text NOT NULL DEFAULT 'random';

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.daily_featured_gacha'::regclass
       AND conname = 'daily_featured_gacha_slot_type_check'
  ) THEN
    ALTER TABLE public.daily_featured_gacha
      ADD CONSTRAINT daily_featured_gacha_slot_type_check
      CHECK (slot_type IN ('popular', 'random'));
  END IF;
END $do$;

COMMENT ON COLUMN public.daily_featured_gacha.slot_type IS
  '이 행이 인기 점수로 뽑혔는지(popular) 랜덤으로 뽑혔는지(random). 쿨다운 규칙이 다르다.';

-- 인기 점수 집계는 시간 윈도우 스캔이다. 지금은 행이 적어 seq scan으로도
-- 충분하지만 증가에 대비해 미리 깔아둔다.
CREATE INDEX IF NOT EXISTS gacha_roll_results_rolled_at_idx
  ON public.gacha_roll_results (rolled_at DESC) INCLUDE (product_id, user_id);

CREATE INDEX IF NOT EXISTS product_wishlists_created_at_idx
  ON public.product_wishlists (created_at DESC) INCLUDE (product_id, user_id);

-- ---------------------------------------------------------------------------
-- 2) RPC 교체
-- ---------------------------------------------------------------------------
-- 파라미터를 추가하면 기존 2-인자 함수와 오버로드가 되어 route.ts의
-- 명명 인자 호출({ p_count })이 "function is not unique" 로 실패한다.
-- 따라서 CREATE OR REPLACE가 아니라 DROP 후 재생성해야 한다.
DROP FUNCTION IF EXISTS public.get_daily_featured_gacha(date, integer);

CREATE FUNCTION public.get_daily_featured_gacha(
  p_date                  date    DEFAULT ((now() AT TIME ZONE 'Asia/Seoul')::date),
  p_count                 integer DEFAULT 10,
  p_popular_count         integer DEFAULT 3,
  p_window_days           integer DEFAULT 14,
  p_half_life_days        numeric DEFAULT 5.0,
  p_weight_wish           numeric DEFAULT 3.0,
  p_weight_roll           numeric DEFAULT 1.0,
  p_min_distinct_users    integer DEFAULT 2,
  p_popular_cooldown_days integer DEFAULT 2
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
AS $fn$
DECLARE
  v_existing_count integer;
  v_today          date := (now() AT TIME ZONE 'Asia/Seoul')::date;
  v_count          integer;
  v_popular_count  integer;
  v_window         integer;
  v_half_life      numeric;
  v_w_wish         numeric;
  v_w_roll         numeric;
  v_min_users      integer;
  v_cooldown       integer;
BEGIN
  -- 이 함수는 anon 실행이 가능하다(비로그인도 오늘의 가챠를 본다).
  -- 따라서 내부 API가 넘기는 값만 믿으면 안 되고, 여기서 직접 clamp한다.
  -- 방어가 없으면 음수 LIMIT, 0 나눗셈, 역감쇠(과거일수록 높은 점수)가 가능하다.
  v_count         := least(greatest(coalesce(p_count, 10), 0), 50);
  v_popular_count := least(greatest(coalesce(p_popular_count, 3), 0), v_count);
  v_window        := least(greatest(coalesce(p_window_days, 14), 1), 90);
  v_half_life     := least(greatest(coalesce(p_half_life_days, 5.0), 0.5), 60.0);
  v_w_wish        := greatest(coalesce(p_weight_wish, 3.0), 0);
  v_w_roll        := greatest(coalesce(p_weight_roll, 1.0), 0);
  v_min_users     := greatest(coalesce(p_min_distinct_users, 2), 1);
  v_cooldown      := least(greatest(coalesce(p_popular_cooldown_days, 2), 0), 30);

  -- 같은 날짜의 첫 요청들이 경쟁해 서로 다른 목록을 만들지 않도록 직렬화한다.
  PERFORM pg_advisory_xact_lock(hashtext('daily_featured_gacha:' || p_date::text));

  SELECT count(*) INTO v_existing_count
  FROM public.daily_featured_gacha dfg
  WHERE dfg.featured_date = p_date;

  -- 생성은 "오늘"에 대해서만 한다.
  --
  -- 이 함수는 anon이 임의 날짜로 호출할 수 있다. 미래 날짜로 호출해 행이
  -- 생성되면 그 날짜가 실제로 왔을 때 v_existing_count > 0 이라 추첨이
  -- 스킵되고, retention DELETE 범위(p_date 기준)도 왜곡된다.
  -- 오늘이 아닌 날짜는 이미 저장된 행을 읽기만 한다.
  IF v_existing_count = 0 AND p_date = v_today THEN
    -- Retention: 하루 한 번만 도는 경로라 별도 pg_cron이 필요 없다.
    DELETE FROM public.daily_featured_gacha
    WHERE featured_date < p_date - INTERVAL '30 days';

    -- 컬럼 별칭(pid 등)은 이 함수의 OUT 파라미터명(id 등)과의 모호성을 피하기 위함이다.
    WITH
    -- 뽑기: prod에 (user_id, product_id, 일자) 유니크 제약이 없다
    -- (20260706에서 제거됨). 한 명이 같은 상품을 무제한 반복할 수 있으므로
    -- DISTINCT로 접는 게 순위 조작에 대한 유일한 방어선이다.
    -- ⚠️ dedup 키에 product_id가 반드시 들어가야 한다. (user_id, 일자)만으로
    --    접으면 한 유저가 같은 날 여러 상품을 뽑았을 때 하나만 남는다.
    act_roll AS (
      SELECT DISTINCT
        r.product_id AS pid,
        r.user_id    AS uid,
        (r.rolled_at AT TIME ZONE 'Asia/Seoul')::date AS adate
      FROM public.gacha_roll_results r
      WHERE (r.rolled_at AT TIME ZONE 'Asia/Seoul')::date
              BETWEEN p_date - (v_window - 1) AND p_date
    ),
    -- 찜: (user_id, product_id)가 이미 유니크라 추가 dedup이 필요 없다.
    act_wish AS (
      SELECT
        w.product_id AS pid,
        w.user_id    AS uid,
        (w.created_at AT TIME ZONE 'Asia/Seoul')::date AS adate
      FROM public.product_wishlists w
      WHERE (w.created_at AT TIME ZONE 'Asia/Seoul')::date
              BETWEEN p_date - (v_window - 1) AND p_date
    ),
    acts AS (
      SELECT pid, adate, v_w_roll AS wgt FROM act_roll
      UNION ALL
      SELECT pid, adate, v_w_wish AS wgt FROM act_wish
    ),
    scored AS (
      SELECT
        a.pid,
        -- greatest(0, ...)로 음수 age를 막는다. 음수면 decay가 1을 넘어
        -- 미래 타임스탬프가 비정상적으로 높은 점수를 받는다.
        sum(a.wgt * power(0.5::numeric,
              greatest(0, p_date - a.adate)::numeric / v_half_life)) AS score,
        max(a.adate) AS last_adate
      FROM acts a
      GROUP BY a.pid
    ),
    -- 최소 유저 수. 찜 유저 수 + 뽑기 유저 수를 더하면 둘 다 한 유저가
    -- 중복 계산되므로, (pid, uid) 쌍을 UNION(집합 연산)한 뒤 센다.
    users AS (
      SELECT y.pid, count(*) AS uu
      FROM (
        SELECT pid, uid FROM act_roll
        UNION
        SELECT pid, uid FROM act_wish
      ) y
      GROUP BY y.pid
    ),
    -- 인기 슬롯 쿨다운: 직전 v_cooldown개 날짜에 인기로 나온 상품 제외.
    -- 인기 슬롯에 7일 금지를 걸지 않는 이유 — 지금 인기인 걸 보여주는 칸인데
    -- 일주일 막으면 목적과 모순된다. 활동이 끊기면 감쇠로 알아서 빠진다.
    popular_cooldown AS (
      SELECT DISTINCT dfg.product_id AS pid
      FROM public.daily_featured_gacha dfg
      WHERE dfg.slot_type = 'popular'
        AND v_cooldown > 0
        AND dfg.featured_date BETWEEN p_date - v_cooldown AND p_date - 1
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
    -- 동점이 흔하므로(같은 날 1회 롤한 상품들) tie-breaker를 명시해
    -- 실행계획에 따라 순서가 흔들리지 않게 한다.
    popular AS (
      SELECT s.pid,
             row_number() OVER (
               ORDER BY s.score DESC, u.uu DESC, s.last_adate DESC, s.pid
             ) AS rn
      FROM scored s
      JOIN users u    ON u.pid = s.pid
      JOIN eligible e ON e.pid = s.pid
      LEFT JOIN popular_cooldown c ON c.pid = s.pid
      WHERE s.score > 0
        AND u.uu >= v_min_users
        AND c.pid IS NULL
      LIMIT v_popular_count
    ),
    -- 아래부터는 기존 랜덤 로직 그대로. 단 인기로 확정된 상품은 제외한다.
    excluded AS (
      SELECT dfg.product_id AS pid, max(dfg.featured_date) AS last_shown
      FROM public.daily_featured_gacha dfg
      WHERE dfg.featured_date >= p_date - INTERVAL '7 days'
        AND dfg.featured_date < p_date
      GROUP BY dfg.product_id
    ),
    rand_pool AS (
      SELECT
        e.pid,
        CASE WHEN x.pid IS NULL THEN 0 ELSE 1 END AS is_stale,
        x.last_shown
      FROM eligible e
      LEFT JOIN excluded x ON x.pid = e.pid
      WHERE NOT EXISTS (SELECT 1 FROM popular pp WHERE pp.pid = e.pid)
    ),
    rand_pick AS (
      SELECT r.pid,
             row_number() OVER (
               ORDER BY r.is_stale,
                        r.last_shown NULLS FIRST,
                        md5(p_date::text || r.pid::text)
             ) AS rn
      FROM rand_pool r
      LIMIT greatest(0, v_count - (SELECT count(*) FROM popular))
    ),
    -- 최종 목록을 먼저 확정한 뒤 rank를 연속 부여한다.
    -- ON CONFLICT DO NOTHING에 중복 제거를 맡기면 조용히 누락되고,
    -- 다음 호출은 v_existing_count > 0 때문에 재생성하지 않아
    -- 10칸 미만 / rank 구멍 상태가 하루 종일 고정된다.
    final AS (
      SELECT pid, 'popular'::text AS st, rn            AS ord FROM popular
      UNION ALL
      SELECT pid, 'random'::text  AS st, 1000000 + rn  AS ord FROM rand_pick
    )
    INSERT INTO public.daily_featured_gacha (featured_date, product_id, rank, slot_type)
    SELECT
      p_date,
      f.pid,
      (row_number() OVER (ORDER BY f.ord))::integer,
      f.st
    FROM final f
    -- 정상 경로에서는 발동하지 않는다. 동시성 안전망으로만 남긴다.
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
$fn$;

COMMENT ON FUNCTION public.get_daily_featured_gacha(
  date, integer, integer, integer, numeric, numeric, numeric, integer, integer) IS
  '오늘의 가챠. 앞 p_popular_count칸은 찜·뽑기 기반 인기 점수, 나머지는 기존 랜덤. 생성은 오늘 KST만.';

-- DROP했으므로 권한을 다시 부여해야 한다.
GRANT EXECUTE ON FUNCTION public.get_daily_featured_gacha(
  date, integer, integer, integer, numeric, numeric, numeric, integer, integer)
  TO anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
