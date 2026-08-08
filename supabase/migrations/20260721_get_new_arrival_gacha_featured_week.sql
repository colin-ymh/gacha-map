-- Rewrite get_new_arrival_gacha() to use the collector-normalized
-- featured_week_start (see 20260721_add_gacha_product_release_schedule.sql)
-- instead of a created_at-based rolling window. The collector already
-- distributes month-precision releases across weeks for stable volume, so
-- the 7/14-day expansion heuristic from the previous version is no longer
-- needed -- this is just "everything scheduled for this week".
-- Expected impact: replaces public.get_new_arrival_gacha() (SECURITY
-- DEFINER), drops the superseded 3-arg overload from
-- 20260720_get_new_arrival_gacha.sql. No table changes, DDL is idempotent.

BEGIN;

-- Superseded by the 2-arg version below; drop first so PostgREST never has
-- to resolve between two overloads of the same RPC name.
DROP FUNCTION IF EXISTS public.get_new_arrival_gacha(date, integer, integer);

CREATE OR REPLACE FUNCTION public.get_new_arrival_gacha(
  p_date date DEFAULT ((now() AT TIME ZONE 'Asia/Seoul')::date),
  p_count integer DEFAULT 15
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
  release_start_date date,
  release_end_date date,
  release_precision text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
    gp.release_start_date,
    gp.release_end_date,
    gp.release_precision,
    gp.created_at
  FROM public.gacha_products gp
  WHERE gp.status = 'active'
    AND gp.source_type = 'official'
    AND gp.official_image_url IS NOT NULL
    AND btrim(gp.official_image_url) <> ''
    AND gp.featured_week_start = date_trunc(
      'week',
      p_date
    )::date
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
  -- Deterministic per-day shuffle, not a release_start_date sort: a real
  -- week's eligible pool mixes 'week'-precision items (real mid-week dates)
  -- with 'month'-precision items (release_start_date pinned to the 1st of
  -- the month for display purposes, even though their featured_week_start
  -- is this week). Sorting by release_start_date would always rank 'week'
  -- items first and silently starve 'month' items out of the LIMIT --
  -- exactly the volume-stability problem featured_week_start exists to fix.
  ORDER BY md5(p_date::text || gp.id::text)
  LIMIT p_count;
$$;

GRANT EXECUTE ON FUNCTION public.get_new_arrival_gacha(date, integer) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
