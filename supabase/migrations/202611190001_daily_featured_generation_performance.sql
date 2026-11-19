BEGIN;

SET LOCAL lock_timeout = '3s';

-- Avoid locale-dependent regex scans over every product and long image URL.
CREATE OR REPLACE FUNCTION public.get_daily_featured_gacha(
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
  v_today date := (now() AT TIME ZONE 'Asia/Seoul')::date;
  v_count integer := least(greatest(coalesce(p_count, 10), 0), 50);
  v_target integer := greatest(10, v_count);
  v_popular_count integer := least(greatest(coalesce(p_popular_count, 3), 0), v_target);
  v_window integer := least(greatest(coalesce(p_window_days, 14), 1), 90);
  v_half_life numeric := least(greatest(coalesce(p_half_life_days, 5.0), 0.5), 60.0);
  v_weight_wish numeric := greatest(coalesce(p_weight_wish, 3.0), 0);
  v_weight_roll numeric := greatest(coalesce(p_weight_roll, 1.0), 0);
  v_min_users integer := greatest(coalesce(p_min_distinct_users, 2), 1);
  v_popular_cooldown integer := least(greatest(coalesce(p_popular_cooldown_days, 2), 7), 30);
  v_disallowed_name_chars text := U&'[\3040-\30FF\31F0-\31FF\3400-\9FFF\F900-\FAFF\FF66-\FF9F]';
  v_existing_count integer;
  v_existing_popular integer;
  v_popular_slots integer;
  v_missing integer;
  v_window_start timestamptz;
  v_window_end timestamptz;
BEGIN
  IF v_count = 0 OR p_date IS NULL THEN
    RETURN;
  END IF;

  IF p_date = v_today THEN
    PERFORM pg_advisory_xact_lock(hashtext('daily_featured_gacha:' || p_date::text));

    IF NOT EXISTS (
      SELECT 1 FROM public.daily_featured_gacha d WHERE d.featured_date = p_date
    ) THEN
      DELETE FROM public.daily_featured_gacha WHERE featured_date < p_date - 30;
    END IF;

    DELETE FROM public.daily_featured_gacha d
    WHERE d.featured_date = p_date
      AND NOT EXISTS (
        SELECT 1
        FROM public.gacha_products p
        WHERE p.id = d.product_id
          AND p.status = 'active'
          AND nullif(btrim(p.name_ko, E' \t\n\r\f\013'), '') IS NOT NULL
          AND p.name_ko COLLATE "C" !~ v_disallowed_name_chars
          AND nullif(btrim(p.official_image_url, E' \t\n\r\f\013'), '') IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.gacha_product_variants v
            WHERE v.product_id = p.id
              AND v.status = 'active'
              AND nullif(btrim(v.image_url, E' \t\n\r\f\013'), '') IS NOT NULL
          )
      );

    SELECT count(*), count(*) FILTER (WHERE d.slot_type = 'popular')
    INTO v_existing_count, v_existing_popular
    FROM public.daily_featured_gacha d
    WHERE d.featured_date = p_date AND d.rank <= v_target;

    v_missing := v_target - v_existing_count;
    v_popular_slots := least(v_missing, greatest(0, v_popular_count - v_existing_popular));
    v_window_start := (p_date - (v_window - 1))::timestamp AT TIME ZONE 'Asia/Seoul';
    v_window_end := (p_date + 1)::timestamp AT TIME ZONE 'Asia/Seoul';

    IF v_missing > 0 THEN
      WITH
      existing_today AS (
        SELECT d.product_id, d.rank
        FROM public.daily_featured_gacha d
        WHERE d.featured_date = p_date
      ),
      open_ranks AS (
        SELECT positions.position, row_number() OVER (ORDER BY positions.position) AS ord
        FROM generate_series(1, v_target) AS positions(position)
        WHERE NOT EXISTS (SELECT 1 FROM existing_today d WHERE d.rank = positions.position)
      ),
      history AS (
        SELECT d.product_id, max(d.featured_date) AS last_shown
        FROM public.daily_featured_gacha d
        WHERE d.featured_date >= p_date - v_popular_cooldown
          AND d.featured_date < p_date
        GROUP BY d.product_id
      ),
      eligible AS (
        SELECT p.id AS pid, h.last_shown
        FROM public.gacha_products p
        LEFT JOIN history h ON h.product_id = p.id
        WHERE p.status = 'active'
          AND nullif(btrim(p.name_ko, E' \t\n\r\f\013'), '') IS NOT NULL
          AND p.name_ko COLLATE "C" !~ v_disallowed_name_chars
          AND nullif(btrim(p.official_image_url, E' \t\n\r\f\013'), '') IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.gacha_product_variants v
            WHERE v.product_id = p.id
              AND v.status = 'active'
              AND nullif(btrim(v.image_url, E' \t\n\r\f\013'), '') IS NOT NULL
          )
          AND NOT EXISTS (SELECT 1 FROM existing_today d WHERE d.product_id = p.id)
      ),
      roll_activity AS (
        SELECT DISTINCT r.product_id AS pid, r.user_id AS uid,
          (r.rolled_at AT TIME ZONE 'Asia/Seoul')::date AS activity_date
        FROM public.gacha_roll_results r
        JOIN eligible e ON e.pid = r.product_id AND e.last_shown IS NULL
        WHERE v_popular_slots > 0 AND r.rolled_at >= v_window_start AND r.rolled_at < v_window_end
      ),
      wish_activity AS (
        SELECT w.product_id AS pid, w.user_id AS uid,
          (w.created_at AT TIME ZONE 'Asia/Seoul')::date AS activity_date
        FROM public.product_wishlists w
        JOIN eligible e ON e.pid = w.product_id AND e.last_shown IS NULL
        WHERE v_popular_slots > 0 AND w.created_at >= v_window_start AND w.created_at < v_window_end
      ),
      activity AS (
        SELECT a.*, v_weight_roll AS weight FROM roll_activity a
        UNION ALL
        SELECT a.*, v_weight_wish AS weight FROM wish_activity a
      ),
      scored AS (
        SELECT a.pid,
          sum(a.weight * power(0.5::numeric,
            greatest(0, p_date - a.activity_date)::numeric / v_half_life)) AS score,
          count(DISTINCT a.uid) AS users,
          max(a.activity_date) AS last_activity
        FROM activity a
        GROUP BY a.pid
      ),
      popular AS (
        SELECT s.pid, row_number() OVER (
          ORDER BY s.score DESC, s.users DESC, s.last_activity DESC, s.pid
        ) AS ord
        FROM scored s
        WHERE s.score > 0 AND s.users >= v_min_users
        ORDER BY ord
        LIMIT v_popular_slots
      ),
      random_pick AS (
        SELECT e.pid, row_number() OVER (
          ORDER BY CASE WHEN e.last_shown >= p_date - 7 THEN e.last_shown END NULLS FIRST,
            md5(p_date::text || e.pid::text), e.pid
        ) AS ord
        FROM eligible e
        WHERE NOT EXISTS (SELECT 1 FROM popular p WHERE p.pid = e.pid)
        ORDER BY ord
        LIMIT (v_missing - (SELECT count(*) FROM popular))
      ),
      picked AS (
        SELECT p.pid, 'popular'::text AS slot, p.ord FROM popular p
        UNION ALL
        SELECT r.pid, 'random'::text, r.ord + (SELECT count(*) FROM popular) FROM random_pick r
      )
      INSERT INTO public.daily_featured_gacha (featured_date, product_id, rank, slot_type)
      SELECT p_date, picked.pid, open_ranks.position, picked.slot
      FROM picked
      JOIN open_ranks USING (ord);
    END IF;
  END IF;

  RETURN QUERY
  SELECT p.id, p.manufacturer, p.name, p.name_ja, p.name_ko, p.name_en,
    p.official_image_url, p.types_count, p.release_month::text, d.rank
  FROM public.daily_featured_gacha d
  JOIN public.gacha_products p ON p.id = d.product_id
  WHERE d.featured_date = p_date
  ORDER BY d.rank
  LIMIT v_count;
END;
$fn$;

COMMENT ON FUNCTION public.get_daily_featured_gacha(
  date, integer, integer, integer, numeric, numeric, numeric, integer, integer
) IS '오늘의 가챠. 한국어 대표명이 있는 상품을 최근 7일 전체 슬롯 이력 및 찜·뽑기 점수로 선정한다.';

GRANT EXECUTE ON FUNCTION public.get_daily_featured_gacha(
  date, integer, integer, integer, numeric, numeric, numeric, integer, integer
) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
