-- Add server-side "오늘의 가챠" (daily featured gacha) selection.
-- Goal: same picks for every user/device on a given day, image-less
-- products excluded, and products shown in the last 7 days deprioritized.
-- Expected impact before first execution:
--   - Creates public.daily_featured_gacha if it does not already exist.
--   - Creates public.get_daily_featured_gacha() RPC (SECURITY DEFINER).
-- Expected impact after successful execution / rerun:
--   - 0 data rows changed.
--   - DDL is idempotent.

BEGIN;

CREATE TABLE IF NOT EXISTS public.daily_featured_gacha (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  featured_date date NOT NULL,
  product_id uuid NOT NULL REFERENCES public.gacha_products(id) ON DELETE CASCADE,
  rank integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_featured_gacha
  ADD COLUMN IF NOT EXISTS featured_date date,
  ADD COLUMN IF NOT EXISTS product_id uuid,
  ADD COLUMN IF NOT EXISTS rank integer,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

ALTER TABLE public.daily_featured_gacha
  ALTER COLUMN featured_date SET NOT NULL,
  ALTER COLUMN rank SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'daily_featured_gacha_product_id_fkey'
      AND conrelid = 'public.daily_featured_gacha'::regclass
  ) THEN
    ALTER TABLE public.daily_featured_gacha
      ADD CONSTRAINT daily_featured_gacha_product_id_fkey
      FOREIGN KEY (product_id)
      REFERENCES public.gacha_products(id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'daily_featured_gacha_rank_positive'
      AND conrelid = 'public.daily_featured_gacha'::regclass
  ) THEN
    ALTER TABLE public.daily_featured_gacha
      ADD CONSTRAINT daily_featured_gacha_rank_positive
      CHECK (rank > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'daily_featured_gacha_date_product_key'
      AND conrelid = 'public.daily_featured_gacha'::regclass
  ) THEN
    ALTER TABLE public.daily_featured_gacha
      ADD CONSTRAINT daily_featured_gacha_date_product_key
      UNIQUE (featured_date, product_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'daily_featured_gacha_date_rank_key'
      AND conrelid = 'public.daily_featured_gacha'::regclass
  ) THEN
    ALTER TABLE public.daily_featured_gacha
      ADD CONSTRAINT daily_featured_gacha_date_rank_key
      UNIQUE (featured_date, rank);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS daily_featured_gacha_date_idx
  ON public.daily_featured_gacha (featured_date);

ALTER TABLE public.daily_featured_gacha ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'daily_featured_gacha'
      AND policyname = 'public can view daily_featured_gacha'
  ) THEN
    CREATE POLICY "public can view daily_featured_gacha"
      ON public.daily_featured_gacha
      FOR SELECT
      TO public
      USING (true);
  END IF;
END $$;

-- No insert/update/delete policy for anon/authenticated on purpose:
-- rows are only ever written by get_daily_featured_gacha() below,
-- which runs SECURITY DEFINER and bypasses RLS as the function owner.

GRANT SELECT ON public.daily_featured_gacha TO anon, authenticated;

-- Returns (and lazily generates, once per day) the featured product list.
-- Same result for every caller on a given p_date: eligible pool is
-- image-required + has an active variant, products featured within the
-- last 7 days are deprioritized (used only to backfill if not enough
-- fresh items remain), and ordering is deterministic per date.
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
