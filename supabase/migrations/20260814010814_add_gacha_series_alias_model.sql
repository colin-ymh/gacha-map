-- Moved from gacha-collector on 2026-08-22 (taxonomy DDL ownership returned to gacha-map).
--
-- HISTORY NOTE: this file is a CONSOLIDATED SNAPSHOT, not a verbatim record of what
-- dev version 20260814010814 applied. It was edited in place in the collector repo after
-- being applied, so it already folds in the `fix_gacha_series_collab_split_rules` change
-- (do not split every title containing `×`; e.g. 헌터×헌터 must stay a single series).
-- That separate file was therefore never applied and has been deleted.
-- Replaying this file produces the correct final state. Do NOT re-apply to dev.
--
-- Normalize gacha product IP/series ownership separately from search aliases.
--
-- Shape:
--   gacha_series          = canonical IP / series / character brand entity
--   gacha_product_series  = product-to-series mapping; collabs can have 2+ rows
--   gacha_series_aliases  = alias candidates attached to a series
--
-- The existing gacha_search_aliases table is retained as a legacy fallback.

BEGIN;

CREATE TABLE IF NOT EXISTS public.gacha_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ko text NOT NULL,
  name_ja text,
  name_en text,
  name_ko_norm text GENERATED ALWAYS AS (public.gacha_normalize_search_text(name_ko)) STORED,
  name_ja_norm text GENERATED ALWAYS AS (public.gacha_normalize_search_text(name_ja)) STORED,
  name_en_norm text GENERATED ALWAYS AS (public.gacha_normalize_search_text(name_en)) STORED,
  kind text NOT NULL DEFAULT 'unknown',
  status text NOT NULL DEFAULT 'active',
  source text NOT NULL DEFAULT 'name_parts',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gacha_series_name_ko_not_blank CHECK (btrim(name_ko) <> ''),
  CONSTRAINT gacha_series_name_ko_norm_not_blank CHECK (name_ko_norm <> ''),
  CONSTRAINT gacha_series_kind_check CHECK (
    kind IN (
      'anime',
      'manga',
      'game',
      'character_brand',
      'toy_line',
      'franchise',
      'other',
      'unknown'
    )
  ),
  CONSTRAINT gacha_series_status_check CHECK (
    status IN ('active', 'hidden', 'archived')
  ),
  CONSTRAINT gacha_series_source_check CHECK (
    source IN ('name_parts', 'manual', 'collector_llm', 'user_log')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS gacha_series_name_ko_norm_key
  ON public.gacha_series (name_ko_norm);

CREATE INDEX IF NOT EXISTS gacha_series_name_ja_norm_idx
  ON public.gacha_series (name_ja_norm)
  WHERE name_ja_norm <> '';

CREATE INDEX IF NOT EXISTS gacha_series_status_idx
  ON public.gacha_series (status);

CREATE TABLE IF NOT EXISTS public.gacha_product_series (
  product_id uuid NOT NULL REFERENCES public.gacha_products(id) ON DELETE CASCADE,
  series_id uuid NOT NULL REFERENCES public.gacha_series(id) ON DELETE CASCADE,
  relation_type text NOT NULL DEFAULT 'primary',
  confidence real NOT NULL DEFAULT 1,
  source text NOT NULL DEFAULT 'name_parts',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, series_id),
  CONSTRAINT gacha_product_series_relation_type_check CHECK (
    relation_type IN ('primary', 'collaboration', 'crossover', 'line', 'unknown')
  ),
  CONSTRAINT gacha_product_series_confidence_check CHECK (
    confidence >= 0 AND confidence <= 1
  ),
  CONSTRAINT gacha_product_series_source_check CHECK (
    source IN ('name_parts', 'manual', 'collector_llm', 'user_log')
  )
);

CREATE INDEX IF NOT EXISTS gacha_product_series_series_id_idx
  ON public.gacha_product_series (series_id);

CREATE INDEX IF NOT EXISTS gacha_product_series_product_id_idx
  ON public.gacha_product_series (product_id);

CREATE TABLE IF NOT EXISTS public.gacha_series_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid NOT NULL REFERENCES public.gacha_series(id) ON DELETE CASCADE,
  alias text NOT NULL,
  alias_norm text GENERATED ALWAYS AS (public.gacha_normalize_search_text(alias)) STORED,
  alias_type text NOT NULL,
  locale text,
  status text NOT NULL DEFAULT 'pending',
  source text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gacha_series_aliases_alias_not_blank CHECK (btrim(alias) <> ''),
  CONSTRAINT gacha_series_aliases_alias_norm_not_blank CHECK (alias_norm <> ''),
  CONSTRAINT gacha_series_aliases_alias_type_check CHECK (
    alias_type IN ('abbreviation', 'nickname', 'romaji', 'typo', 'translation', 'character')
  ),
  CONSTRAINT gacha_series_aliases_locale_check CHECK (
    locale IS NULL OR locale IN ('ko', 'ja', 'en')
  ),
  CONSTRAINT gacha_series_aliases_status_check CHECK (
    status IN ('pending', 'approved', 'rejected')
  ),
  CONSTRAINT gacha_series_aliases_source_check CHECK (
    source IN ('collector_llm', 'manual', 'user_log')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS gacha_series_aliases_approved_alias_key
  ON public.gacha_series_aliases (alias_norm)
  WHERE status = 'approved';

CREATE UNIQUE INDEX IF NOT EXISTS gacha_series_aliases_pending_source_key
  ON public.gacha_series_aliases (series_id, alias_norm, source)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS gacha_series_aliases_series_status_idx
  ON public.gacha_series_aliases (series_id, status);

CREATE INDEX IF NOT EXISTS gacha_series_aliases_status_idx
  ON public.gacha_series_aliases (status);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'update_updated_at'
      AND pg_function_is_visible(oid)
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgname = 'gacha_series_updated_at'
        AND tgrelid = 'public.gacha_series'::regclass
    ) THEN
      CREATE TRIGGER gacha_series_updated_at
        BEFORE UPDATE ON public.gacha_series
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at();
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgname = 'gacha_product_series_updated_at'
        AND tgrelid = 'public.gacha_product_series'::regclass
    ) THEN
      CREATE TRIGGER gacha_product_series_updated_at
        BEFORE UPDATE ON public.gacha_product_series
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at();
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgname = 'gacha_series_aliases_updated_at'
        AND tgrelid = 'public.gacha_series_aliases'::regclass
    ) THEN
      CREATE TRIGGER gacha_series_aliases_updated_at
        BEFORE UPDATE ON public.gacha_series_aliases
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at();
    END IF;
  END IF;
END $$;

-- Backfill series entities from existing product series names.
-- Keep full titles such as 헌터×헌터 intact. Collaboration splitting is handled
-- only in the mapping step when every split part already exists as a standalone
-- series.
WITH raw_product_series AS (
  SELECT
    nullif(btrim(gp.name_parts -> 'series' ->> 'ko'), '') AS series_ko,
    nullif(btrim(gp.name_parts -> 'series' ->> 'ja'), '') AS series_ja
  FROM public.gacha_products gp
  WHERE gp.status = 'active'
    AND gp.name_parts -> 'series' ->> 'ko' IS NOT NULL
),
series_candidates AS (
  SELECT DISTINCT ON (public.gacha_normalize_search_text(name_ko))
    series_ko AS name_ko,
    series_ja AS name_ja
  FROM raw_product_series
  WHERE series_ko IS NOT NULL
  ORDER BY
    public.gacha_normalize_search_text(series_ko),
    length(series_ko),
    series_ko,
    series_ja IS NULL,
    length(coalesce(series_ja, '')),
    series_ja
)
INSERT INTO public.gacha_series (name_ko, name_ja, kind, status, source, note)
SELECT
  name_ko,
  name_ja,
  'unknown',
  'active',
  'name_parts',
  'Backfilled from gacha_products.name_parts.series'
FROM series_candidates
ON CONFLICT (name_ko_norm) DO UPDATE
SET
  name_ja = coalesce(public.gacha_series.name_ja, excluded.name_ja),
  updated_at = now();

-- Rebuild product-to-series mapping. Names containing × become multiple rows
-- only when all split parts are known standalone series; otherwise the full
-- title is retained as a primary series.
DELETE FROM public.gacha_product_series
WHERE source = 'name_parts';

WITH raw_product_series AS (
  SELECT
    gp.id AS product_id,
    nullif(btrim(gp.name_parts -> 'series' ->> 'ko'), '') AS series_ko,
    nullif(btrim(gp.name_parts -> 'series' ->> 'ja'), '') AS series_ja
  FROM public.gacha_products gp
  WHERE gp.status = 'active'
    AND gp.name_parts -> 'series' ->> 'ko' IS NOT NULL
),
prepared AS (
  SELECT
    product_id,
    series_ko,
    public.gacha_normalize_search_text(series_ko) AS series_norm,
    regexp_split_to_array(series_ko, '\s*[×]\s*') AS ko_parts
  FROM raw_product_series
  WHERE series_ko IS NOT NULL
),
parts AS (
  SELECT
    p.product_id,
    p.series_ko,
    p.series_norm,
    cardinality(p.ko_parts) AS part_count,
    u.ord,
    nullif(btrim(u.ko_part), '') AS name_ko,
    public.gacha_normalize_search_text(nullif(btrim(u.ko_part), '')) AS part_norm
  FROM prepared p
  CROSS JOIN LATERAL unnest(p.ko_parts) WITH ORDINALITY AS u(ko_part, ord)
),
split_ready AS (
  SELECT p.product_id
  FROM parts p
  JOIN public.gacha_series s ON s.name_ko_norm = p.part_norm
  WHERE p.part_count > 1
    AND p.name_ko IS NOT NULL
  GROUP BY p.product_id, p.part_count
  HAVING count(DISTINCT p.part_norm) = p.part_count
     AND count(DISTINCT s.id) = p.part_count
),
mapping_candidates AS (
  SELECT
    p.product_id,
    p.part_norm AS target_norm,
    'collaboration'::text AS relation_type
  FROM parts p
  JOIN split_ready sr ON sr.product_id = p.product_id
  WHERE p.name_ko IS NOT NULL
  UNION ALL
  SELECT
    p.product_id,
    p.series_norm AS target_norm,
    'primary'::text AS relation_type
  FROM prepared p
  WHERE NOT EXISTS (
    SELECT 1
    FROM split_ready sr
    WHERE sr.product_id = p.product_id
  )
),
deduped_mapping_candidates AS (
  SELECT DISTINCT ON (product_id, target_norm)
    product_id,
    target_norm,
    relation_type
  FROM mapping_candidates
  ORDER BY
    product_id,
    target_norm,
    CASE relation_type WHEN 'primary' THEN 0 ELSE 1 END,
    relation_type
)
INSERT INTO public.gacha_product_series (
  product_id,
  series_id,
  relation_type,
  confidence,
  source,
  note
)
SELECT
  p.product_id,
  s.id,
  p.relation_type,
  1,
  'name_parts',
  'Backfilled from gacha_products.name_parts.series'
FROM deduped_mapping_candidates p
JOIN public.gacha_series s
  ON s.name_ko_norm = p.target_norm
ON CONFLICT (product_id, series_id) DO UPDATE
SET
  relation_type = excluded.relation_type,
  confidence = greatest(public.gacha_product_series.confidence, excluded.confidence),
  updated_at = now();

-- Backfill series aliases from the legacy text-array alias table.
WITH legacy_alias_matches AS (
  SELECT
    a.id AS legacy_alias_id,
    s.id AS series_id,
    a.alias,
    a.alias_type,
    a.locale,
    a.status,
    a.source,
    a.note,
    a.created_at,
    a.updated_at,
    row_number() OVER (
      PARTITION BY a.id
      ORDER BY
        CASE
          WHEN public.gacha_normalize_search_text(t.term) = s.name_ko_norm THEN 0
          WHEN public.gacha_normalize_search_text(t.term) = s.name_ja_norm THEN 1
          ELSE 2
        END,
        s.name_ko
    ) AS rn
  FROM public.gacha_search_aliases a
  CROSS JOIN LATERAL unnest(a.canonical_terms) AS t(term)
  JOIN public.gacha_series s
    ON public.gacha_normalize_search_text(t.term) IN (
      s.name_ko_norm,
      s.name_ja_norm,
      s.name_en_norm
    )
)
INSERT INTO public.gacha_series_aliases (
  series_id,
  alias,
  alias_type,
  locale,
  status,
  source,
  note,
  created_at,
  updated_at
)
SELECT
  series_id,
  alias,
  alias_type,
  locale,
  status,
  source,
  note,
  created_at,
  updated_at
FROM legacy_alias_matches
WHERE rn = 1
ON CONFLICT DO NOTHING;

CREATE OR REPLACE VIEW public.gacha_search_alias_expansions AS
SELECT
  a.id,
  a.alias,
  a.alias_norm,
  names.canonical_terms,
  names.canonical_norms,
  a.alias_type,
  a.locale,
  a.status,
  a.source,
  a.note,
  a.created_at,
  a.updated_at
FROM public.gacha_series_aliases a
JOIN public.gacha_series s ON s.id = a.series_id
CROSS JOIN LATERAL (
  SELECT
    array_agg(DISTINCT term ORDER BY term) AS canonical_terms,
    array_agg(DISTINCT norm ORDER BY norm) AS canonical_norms
  FROM (
    VALUES
      (s.name_ko, s.name_ko_norm),
      (s.name_ja, s.name_ja_norm),
      (s.name_en, s.name_en_norm)
  ) AS v(term, norm)
  WHERE term IS NOT NULL
    AND btrim(term) <> ''
    AND norm IS NOT NULL
    AND norm <> ''
) names
WHERE s.status = 'active'
UNION ALL
SELECT
  a.id,
  a.alias,
  a.alias_norm,
  a.canonical_terms,
  a.canonical_norms,
  a.alias_type,
  a.locale,
  a.status,
  a.source,
  a.note,
  a.created_at,
  a.updated_at
FROM public.gacha_search_aliases a
WHERE NOT EXISTS (
  SELECT 1
  FROM public.gacha_series_aliases sa
  WHERE sa.alias_norm = a.alias_norm
    AND sa.status = a.status
);

CREATE OR REPLACE FUNCTION public.sync_gacha_series_alias_to_search_alias()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_terms text[];
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  SELECT array_agg(DISTINCT term ORDER BY term)
    INTO v_terms
  FROM (
    SELECT s.name_ko AS term
    FROM public.gacha_series s
    WHERE s.id = NEW.series_id
    UNION
    SELECT s.name_ja AS term
    FROM public.gacha_series s
    WHERE s.id = NEW.series_id
    UNION
    SELECT s.name_en AS term
    FROM public.gacha_series s
    WHERE s.id = NEW.series_id
  ) terms
  WHERE term IS NOT NULL
    AND btrim(term) <> '';

  IF v_terms IS NULL OR cardinality(v_terms) = 0 THEN
    RETURN NEW;
  END IF;

  UPDATE public.gacha_search_aliases legacy
     SET canonical_terms = v_terms,
         alias_type = NEW.alias_type,
         locale = NEW.locale,
         status = NEW.status,
         source = NEW.source,
         note = NEW.note,
         updated_at = now()
   WHERE legacy.alias_norm = NEW.alias_norm
     AND legacy.source = NEW.source
     AND legacy.status <> 'rejected';

  IF FOUND THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.gacha_search_aliases (
    alias,
    canonical_terms,
    alias_type,
    locale,
    status,
    source,
    note
  )
  SELECT
    NEW.alias,
    v_terms,
    NEW.alias_type,
    NEW.locale,
    NEW.status,
    NEW.source,
    NEW.note
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.gacha_search_aliases legacy
    WHERE legacy.alias_norm = NEW.alias_norm
      AND legacy.status = NEW.status
      AND legacy.source = NEW.source
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS gacha_series_aliases_sync_search_alias
  ON public.gacha_series_aliases;

CREATE TRIGGER gacha_series_aliases_sync_search_alias
  AFTER INSERT OR UPDATE OF alias, alias_type, locale, status, source, note, series_id
  ON public.gacha_series_aliases
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_gacha_series_alias_to_search_alias();

ALTER TABLE public.gacha_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gacha_product_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gacha_series_aliases ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'gacha_series'
      AND policyname = 'public can view active gacha_series'
  ) THEN
    CREATE POLICY "public can view active gacha_series"
      ON public.gacha_series
      FOR SELECT
      TO public
      USING (status = 'active');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'gacha_product_series'
      AND policyname = 'public can view active gacha_product_series'
  ) THEN
    CREATE POLICY "public can view active gacha_product_series"
      ON public.gacha_product_series
      FOR SELECT
      TO public
      USING (
        EXISTS (
          SELECT 1
          FROM public.gacha_products gp
          WHERE gp.id = gacha_product_series.product_id
            AND gp.status = 'active'
        )
        AND EXISTS (
          SELECT 1
          FROM public.gacha_series gs
          WHERE gs.id = gacha_product_series.series_id
            AND gs.status = 'active'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'gacha_series_aliases'
      AND policyname = 'public can view approved gacha_series_aliases'
  ) THEN
    CREATE POLICY "public can view approved gacha_series_aliases"
      ON public.gacha_series_aliases
      FOR SELECT
      TO public
      USING (status = 'approved');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'user_profiles'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'gacha_series'
        AND policyname = 'admins can manage gacha_series'
    ) THEN
      CREATE POLICY "admins can manage gacha_series"
        ON public.gacha_series
        FOR ALL
        TO authenticated
        USING (
          EXISTS (
            SELECT 1
            FROM public.user_profiles
            WHERE user_profiles.id = auth.uid()
              AND user_profiles.role = 'admin'
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1
            FROM public.user_profiles
            WHERE user_profiles.id = auth.uid()
              AND user_profiles.role = 'admin'
          )
        );
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'gacha_product_series'
        AND policyname = 'admins can manage gacha_product_series'
    ) THEN
      CREATE POLICY "admins can manage gacha_product_series"
        ON public.gacha_product_series
        FOR ALL
        TO authenticated
        USING (
          EXISTS (
            SELECT 1
            FROM public.user_profiles
            WHERE user_profiles.id = auth.uid()
              AND user_profiles.role = 'admin'
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1
            FROM public.user_profiles
            WHERE user_profiles.id = auth.uid()
              AND user_profiles.role = 'admin'
          )
        );
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'gacha_series_aliases'
        AND policyname = 'admins can manage gacha_series_aliases'
    ) THEN
      CREATE POLICY "admins can manage gacha_series_aliases"
        ON public.gacha_series_aliases
        FOR ALL
        TO authenticated
        USING (
          EXISTS (
            SELECT 1
            FROM public.user_profiles
            WHERE user_profiles.id = auth.uid()
              AND user_profiles.role = 'admin'
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1
            FROM public.user_profiles
            WHERE user_profiles.id = auth.uid()
              AND user_profiles.role = 'admin'
          )
        );
    END IF;
  END IF;
END $$;

GRANT SELECT ON public.gacha_series TO anon, authenticated;
GRANT SELECT ON public.gacha_product_series TO anon, authenticated;
GRANT SELECT ON public.gacha_series_aliases TO anon, authenticated;
GRANT SELECT ON public.gacha_search_alias_expansions TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.gacha_series TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.gacha_product_series TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.gacha_series_aliases TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
