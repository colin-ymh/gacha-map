-- Add server-side "신상 가챠" (new arrival gacha) selection for the home
-- screen. Unlike get_daily_featured_gacha, this is not a random daily pick
-- and needs no persistence table -- it deterministically reflects the most
-- recent collector batch (by created_at), windowed to the last 7 KST days,
-- expanding to 14 days when the 7-day window has too few eligible items.
-- Expected impact: creates public.get_new_arrival_gacha() RPC (SECURITY
-- DEFINER). No table changes, DDL is idempotent.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_new_arrival_gacha(
  p_date date DEFAULT ((now() AT TIME ZONE 'Asia/Seoul')::date),
  p_count integer DEFAULT 15,
  p_min_items integer DEFAULT 6
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
  created_at timestamptz,
  window_start date
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_latest_ts timestamptz;
  v_latest_date date;
  v_window_start_7 date;
  v_window_start_14 date;
  v_count_7 integer;
  v_window_start date;
  v_cutoff_ts timestamptz;
BEGIN
  -- Same eligibility as the final SELECT below (active/official/image/variant
  -- + not already shown in today's 오늘의 가챠), so "latest" and the 7-day
  -- count reflect exactly what this function can actually return.
  WITH eligible AS (
    SELECT p.id AS pid, p.created_at AS c_created_at
    FROM public.gacha_products p
    WHERE p.status = 'active'
      AND p.source_type = 'official'
      AND p.official_image_url IS NOT NULL
      AND btrim(p.official_image_url) <> ''
      AND EXISTS (
        SELECT 1
        FROM public.gacha_product_variants v
        WHERE v.product_id = p.id
          AND v.status = 'active'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.daily_featured_gacha dfg
        WHERE dfg.product_id = p.id
          AND dfg.featured_date = p_date
      )
  )
  SELECT max(c_created_at) INTO v_latest_ts FROM eligible;

  IF v_latest_ts IS NULL THEN
    RETURN;
  END IF;

  v_latest_date := (v_latest_ts AT TIME ZONE 'Asia/Seoul')::date;
  v_window_start_7 := v_latest_date - 6;
  v_window_start_14 := v_latest_date - 13;

  SELECT count(*) INTO v_count_7
  FROM public.gacha_products p
  WHERE p.status = 'active'
    AND p.source_type = 'official'
    AND p.official_image_url IS NOT NULL
    AND btrim(p.official_image_url) <> ''
    AND p.created_at >= (v_window_start_7::timestamp AT TIME ZONE 'Asia/Seoul')
    AND EXISTS (
      SELECT 1
      FROM public.gacha_product_variants v
      WHERE v.product_id = p.id
        AND v.status = 'active'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.daily_featured_gacha dfg
      WHERE dfg.product_id = p.id
        AND dfg.featured_date = p_date
    );

  IF v_count_7 >= p_min_items THEN
    v_window_start := v_window_start_7;
  ELSE
    v_window_start := v_window_start_14;
  END IF;

  v_cutoff_ts := (v_window_start::timestamp AT TIME ZONE 'Asia/Seoul');

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
    gp.created_at,
    v_window_start AS window_start
  FROM public.gacha_products gp
  WHERE gp.status = 'active'
    AND gp.source_type = 'official'
    AND gp.official_image_url IS NOT NULL
    AND btrim(gp.official_image_url) <> ''
    AND gp.created_at >= v_cutoff_ts
    AND EXISTS (
      SELECT 1
      FROM public.gacha_product_variants v
      WHERE v.product_id = gp.id
        AND v.status = 'active'
    )
    -- exclude products already shown in today's "오늘의 가챠"
    AND NOT EXISTS (
      SELECT 1
      FROM public.daily_featured_gacha dfg
      WHERE dfg.product_id = gp.id
        AND dfg.featured_date = p_date
    )
  ORDER BY gp.created_at DESC
  LIMIT p_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_new_arrival_gacha(date, integer, integer) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
