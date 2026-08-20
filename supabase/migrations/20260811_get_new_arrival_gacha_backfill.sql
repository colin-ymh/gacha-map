-- get_new_arrival_gacha(): keep this KST week's picks first, but backfill with
-- the most recent earlier weeks when this week's eligible pool is smaller than
-- p_count.
--
-- Why: the collector's featured_week_start distribution is not actually flat.
-- On 2026-08-11 prod had 1 eligible product for week 2026-08-10 while
-- 2026-08-03 had 46 and 2026-07-27 had 36, so the strict `= this week` filter
-- rendered a 1-card carousel. Backfilling by featured_week_start DESC keeps the
-- section at a usable size ("최신 출시순") without changing what "this week"
-- means -- current-week items still rank first.
--
-- Future weeks stay excluded (featured_week_start <= this week): those products
-- are not released yet and must not be shown as new arrivals.
--
-- Within one week the deterministic md5 shuffle from
-- 20260721_get_new_arrival_gacha_featured_week.sql is preserved, so
-- 'month'-precision items (release_start_date pinned to the 1st) are not
-- starved by 'week'-precision items.
--
-- Expected impact: replaces public.get_new_arrival_gacha(date, integer)
-- (SECURITY DEFINER). No table changes, DDL is idempotent.

BEGIN;

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
    AND gp.featured_week_start IS NOT NULL
    AND gp.featured_week_start <= date_trunc('week', p_date)::date
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
  ORDER BY
    gp.featured_week_start DESC,
    md5(p_date::text || gp.id::text)
  LIMIT p_count;
$$;

GRANT EXECUTE ON FUNCTION public.get_new_arrival_gacha(date, integer) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
