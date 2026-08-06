-- Require at least one active variant with an image before a product is
-- eligible for "오늘의 가챠" (daily featured gacha). Previously only
-- gacha_products.official_image_url and "has an active variant" were
-- checked, so products whose variants (detail-page images) were all
-- imageless could still be picked, showing broken/empty images on the
-- product detail screen.
-- Expected impact: replaces public.get_daily_featured_gacha() (SECURITY
-- DEFINER). No table changes, DDL is idempotent. Existing rows in
-- daily_featured_gacha are untouched by this migration; a separate
-- one-off DELETE is needed to force regeneration of already-picked dates.

BEGIN;

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

NOTIFY pgrst, 'reload schema';

COMMIT;
