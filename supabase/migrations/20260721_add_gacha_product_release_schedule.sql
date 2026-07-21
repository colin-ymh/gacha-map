-- Add normalized release schedule fields for weekly "new gacha" surfaces.
-- Source release text is kept in release_week_text; these fields are service-facing.

BEGIN;

ALTER TABLE public.gacha_products
  ADD COLUMN IF NOT EXISTS release_start_date date,
  ADD COLUMN IF NOT EXISTS release_end_date date,
  ADD COLUMN IF NOT EXISTS release_precision text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS featured_week_start date;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'gacha_products_release_precision_check'
      AND conrelid = 'public.gacha_products'::regclass
  ) THEN
    ALTER TABLE public.gacha_products
      ADD CONSTRAINT gacha_products_release_precision_check
      CHECK (
        release_precision IN (
          'exact',
          'week',
          'early',
          'mid',
          'late',
          'month',
          'unknown'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'gacha_products_release_date_range_check'
      AND conrelid = 'public.gacha_products'::regclass
  ) THEN
    ALTER TABLE public.gacha_products
      ADD CONSTRAINT gacha_products_release_date_range_check
      CHECK (
        release_start_date IS NULL
        OR release_end_date IS NULL
        OR release_start_date <= release_end_date
      );
  END IF;
END $$;

WITH parsed AS (
  SELECT
    gp.id,
    gp.manufacturer,
    gp.name,
    gp.normalized_name,
    gp.release_month,
    gp.release_week_text,
    date_trunc('month', gp.release_month)::date AS month_start,
    (date_trunc('month', gp.release_month)::date + interval '1 month - 1 day')::date AS month_end,
    regexp_match(
      gp.release_week_text,
      '20[0-9]{2}[[:space:]]*年[[:space:]]*([0-9]{1,2})[[:space:]]*月[[:space:]]*([0-9]{1,2})[[:space:]]*日'
    ) AS exact_match,
    regexp_match(
      gp.release_week_text,
      '第?[[:space:]]*([0-9]+)[[:space:]]*週'
    ) AS week_match
  FROM public.gacha_products gp
),
normalized AS (
  SELECT
    id,
    manufacturer,
    name,
    normalized_name,
    release_month,
    release_week_text,
    month_start,
    month_end,
    CASE
      WHEN release_month IS NULL THEN NULL
      WHEN exact_match IS NOT NULL
        AND exact_match[1]::int = extract(month FROM release_month)::int
        AND exact_match[2]::int BETWEEN 1 AND extract(day FROM month_end)::int
        THEN make_date(
          extract(year FROM release_month)::int,
          extract(month FROM release_month)::int,
          exact_match[2]::int
        )
      WHEN week_match IS NOT NULL
        AND week_match[1]::int >= 1
        AND ((week_match[1]::int - 1) * 7 + 1) <= extract(day FROM month_end)::int
        THEN make_date(
          extract(year FROM release_month)::int,
          extract(month FROM release_month)::int,
          (week_match[1]::int - 1) * 7 + 1
        )
      WHEN release_week_text ~ '上旬' THEN month_start
      WHEN release_week_text ~ '中旬' THEN make_date(
        extract(year FROM release_month)::int,
        extract(month FROM release_month)::int,
        least(11, extract(day FROM month_end)::int)
      )
      WHEN release_week_text ~ '下旬' THEN make_date(
        extract(year FROM release_month)::int,
        extract(month FROM release_month)::int,
        least(21, extract(day FROM month_end)::int)
      )
      ELSE month_start
    END AS release_start_date,
    CASE
      WHEN release_month IS NULL THEN NULL
      WHEN exact_match IS NOT NULL
        AND exact_match[1]::int = extract(month FROM release_month)::int
        AND exact_match[2]::int BETWEEN 1 AND extract(day FROM month_end)::int
        THEN make_date(
          extract(year FROM release_month)::int,
          extract(month FROM release_month)::int,
          exact_match[2]::int
        )
      WHEN week_match IS NOT NULL
        AND week_match[1]::int >= 1
        AND ((week_match[1]::int - 1) * 7 + 1) <= extract(day FROM month_end)::int
        THEN make_date(
          extract(year FROM release_month)::int,
          extract(month FROM release_month)::int,
          least(week_match[1]::int * 7, extract(day FROM month_end)::int)
        )
      WHEN release_week_text ~ '上旬' THEN make_date(
        extract(year FROM release_month)::int,
        extract(month FROM release_month)::int,
        least(10, extract(day FROM month_end)::int)
      )
      WHEN release_week_text ~ '中旬' THEN make_date(
        extract(year FROM release_month)::int,
        extract(month FROM release_month)::int,
        least(20, extract(day FROM month_end)::int)
      )
      WHEN release_week_text ~ '下旬' THEN month_end
      ELSE month_end
    END AS release_end_date,
    CASE
      WHEN release_month IS NULL THEN 'unknown'
      WHEN exact_match IS NOT NULL
        AND exact_match[1]::int = extract(month FROM release_month)::int
        AND exact_match[2]::int BETWEEN 1 AND extract(day FROM month_end)::int
        THEN 'exact'
      WHEN week_match IS NOT NULL
        AND week_match[1]::int >= 1
        AND ((week_match[1]::int - 1) * 7 + 1) <= extract(day FROM month_end)::int
        THEN 'week'
      WHEN release_week_text ~ '上旬' THEN 'early'
      WHEN release_week_text ~ '中旬' THEN 'mid'
      WHEN release_week_text ~ '下旬' THEN 'late'
      ELSE 'month'
    END AS release_precision
  FROM parsed
),
scheduled AS (
  SELECT
    id,
    release_start_date,
    release_end_date,
    release_precision,
    CASE
      WHEN release_start_date IS NULL THEN NULL
      WHEN release_precision = 'month' THEN (
        date_trunc('week', month_start)::date
        + (
          (
            (
              strpos(
                '0123456789abcdef',
                substr(
                  md5(
                    coalesce(manufacturer, '')
                    || ':'
                    || coalesce(normalized_name, lower(name), '')
                    || ':'
                    || release_month::text
                  ),
                  1,
                  1
                )
              ) - 1
            ) * 16
            + (
              strpos(
                '0123456789abcdef',
                substr(
                  md5(
                    coalesce(manufacturer, '')
                    || ':'
                    || coalesce(normalized_name, lower(name), '')
                    || ':'
                    || release_month::text
                  ),
                  2,
                  1
                )
              ) - 1
            )
          )
          % (((month_end - date_trunc('week', month_start)::date) / 7) + 1)
        ) * 7
      )
      ELSE date_trunc('week', release_start_date)::date
    END AS featured_week_start
  FROM normalized
)
UPDATE public.gacha_products gp
SET
  release_start_date = scheduled.release_start_date,
  release_end_date = scheduled.release_end_date,
  release_precision = scheduled.release_precision,
  featured_week_start = scheduled.featured_week_start
FROM scheduled
WHERE gp.id = scheduled.id;

CREATE INDEX IF NOT EXISTS idx_gacha_products_featured_week_start
  ON public.gacha_products(featured_week_start DESC)
  WHERE status = 'active' AND featured_week_start IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_gacha_products_release_range
  ON public.gacha_products(release_start_date, release_end_date)
  WHERE status = 'active' AND release_start_date IS NOT NULL AND release_end_date IS NOT NULL;

COMMENT ON COLUMN public.gacha_products.release_start_date IS
  'Normalized inclusive release date/range start for service filtering.';
COMMENT ON COLUMN public.gacha_products.release_end_date IS
  'Normalized inclusive release date/range end for service filtering.';
COMMENT ON COLUMN public.gacha_products.release_precision IS
  'Precision of normalized release schedule: exact, week, early, mid, late, month, or unknown.';
COMMENT ON COLUMN public.gacha_products.featured_week_start IS
  'Monday date for weekly service placement; month-only releases are deterministically distributed across overlapping month weeks.';

NOTIFY pgrst, 'reload schema';

COMMIT;
