-- Add product-level gacha lineup variants collected from official source pages.
-- Expected impact before first execution:
--   - Creates public.gacha_product_variants.
--   - Adds public read policy for variants whose product is active.
--   - Adds authenticated admin management policy.
-- Expected impact after successful execution / rerun:
--   - 0 data rows changed.
--   - DDL is idempotent.

BEGIN;

CREATE TABLE IF NOT EXISTS public.gacha_product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.gacha_products(id) ON DELETE CASCADE,
  name_ja text NOT NULL,
  name_ko text,
  image_url text,
  sort_order integer NOT NULL,
  source_name text NOT NULL,
  source_url text NOT NULL,
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gacha_product_variants
  ADD COLUMN IF NOT EXISTS product_id uuid,
  ADD COLUMN IF NOT EXISTS name_ja text,
  ADD COLUMN IF NOT EXISTS name_ko text,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS sort_order integer,
  ADD COLUMN IF NOT EXISTS source_name text,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS raw_payload jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.gacha_product_variants
  ALTER COLUMN product_id SET NOT NULL,
  ALTER COLUMN name_ja SET NOT NULL,
  ALTER COLUMN sort_order SET NOT NULL,
  ALTER COLUMN source_name SET NOT NULL,
  ALTER COLUMN source_url SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'gacha_product_variants_product_id_fkey'
      AND conrelid = 'public.gacha_product_variants'::regclass
  ) THEN
    ALTER TABLE public.gacha_product_variants
      ADD CONSTRAINT gacha_product_variants_product_id_fkey
      FOREIGN KEY (product_id)
      REFERENCES public.gacha_products(id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'gacha_product_variants_name_ja_not_blank'
      AND conrelid = 'public.gacha_product_variants'::regclass
  ) THEN
    ALTER TABLE public.gacha_product_variants
      ADD CONSTRAINT gacha_product_variants_name_ja_not_blank
      CHECK (btrim(name_ja) <> '');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'gacha_product_variants_sort_order_positive'
      AND conrelid = 'public.gacha_product_variants'::regclass
  ) THEN
    ALTER TABLE public.gacha_product_variants
      ADD CONSTRAINT gacha_product_variants_sort_order_positive
      CHECK (sort_order > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'gacha_product_variants_product_source_order_name_key'
      AND conrelid = 'public.gacha_product_variants'::regclass
  ) THEN
    ALTER TABLE public.gacha_product_variants
      ADD CONSTRAINT gacha_product_variants_product_source_order_name_key
      UNIQUE (product_id, source_name, sort_order, name_ja);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS gacha_product_variants_product_order_idx
  ON public.gacha_product_variants (product_id, sort_order);

CREATE INDEX IF NOT EXISTS gacha_product_variants_source_idx
  ON public.gacha_product_variants (source_name);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'update_updated_at'
      AND pg_function_is_visible(oid)
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'gacha_product_variants_updated_at'
      AND tgrelid = 'public.gacha_product_variants'::regclass
  ) THEN
    CREATE TRIGGER gacha_product_variants_updated_at
      BEFORE UPDATE ON public.gacha_product_variants
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

ALTER TABLE public.gacha_product_variants ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'gacha_product_variants'
      AND policyname = 'public can view active gacha_product_variants'
  ) THEN
    CREATE POLICY "public can view active gacha_product_variants"
      ON public.gacha_product_variants
      FOR SELECT
      TO public
      USING (
        EXISTS (
          SELECT 1
          FROM public.gacha_products
          WHERE gacha_products.id = gacha_product_variants.product_id
            AND gacha_products.status = 'active'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'gacha_product_variants'
      AND policyname = 'admins can manage gacha_product_variants'
  ) THEN
    CREATE POLICY "admins can manage gacha_product_variants"
      ON public.gacha_product_variants
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
END $$;

GRANT SELECT ON public.gacha_product_variants TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.gacha_product_variants TO authenticated;

CREATE TABLE IF NOT EXISTS public.gacha_product_variant_extraction_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.gacha_products(id) ON DELETE CASCADE,
  source_name text NOT NULL,
  method text NOT NULL,
  status text NOT NULL,
  expected_count integer,
  extracted_count integer NOT NULL DEFAULT 0,
  image_count integer NOT NULL DEFAULT 0,
  parser_version text NOT NULL,
  error_message text,
  raw_payload jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gacha_product_variant_extraction_results
  ADD COLUMN IF NOT EXISTS product_id uuid,
  ADD COLUMN IF NOT EXISTS source_name text,
  ADD COLUMN IF NOT EXISTS method text,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS expected_count integer,
  ADD COLUMN IF NOT EXISTS extracted_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS image_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS parser_version text,
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS raw_payload jsonb,
  ADD COLUMN IF NOT EXISTS fetched_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.gacha_product_variant_extraction_results
  ALTER COLUMN product_id SET NOT NULL,
  ALTER COLUMN source_name SET NOT NULL,
  ALTER COLUMN method SET NOT NULL,
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN extracted_count SET DEFAULT 0,
  ALTER COLUMN extracted_count SET NOT NULL,
  ALTER COLUMN image_count SET DEFAULT 0,
  ALTER COLUMN image_count SET NOT NULL,
  ALTER COLUMN parser_version SET NOT NULL,
  ALTER COLUMN fetched_at SET DEFAULT now(),
  ALTER COLUMN fetched_at SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'gacha_variant_results_product_id_fkey'
      AND conrelid = 'public.gacha_product_variant_extraction_results'::regclass
  ) THEN
    ALTER TABLE public.gacha_product_variant_extraction_results
      ADD CONSTRAINT gacha_variant_results_product_id_fkey
      FOREIGN KEY (product_id)
      REFERENCES public.gacha_products(id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'gacha_variant_results_status_check'
      AND conrelid = 'public.gacha_product_variant_extraction_results'::regclass
  ) THEN
    ALTER TABLE public.gacha_product_variant_extraction_results
      ADD CONSTRAINT gacha_variant_results_status_check
      CHECK (
        status IN (
          'success',
          'partial',
          'no_lineup_found',
          'needs_ocr',
          'failed'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'gacha_variant_results_counts_check'
      AND conrelid = 'public.gacha_product_variant_extraction_results'::regclass
  ) THEN
    ALTER TABLE public.gacha_product_variant_extraction_results
      ADD CONSTRAINT gacha_variant_results_counts_check
      CHECK (
        (expected_count IS NULL OR expected_count >= 0)
        AND extracted_count >= 0
        AND image_count >= 0
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'gacha_variant_results_text_not_blank'
      AND conrelid = 'public.gacha_product_variant_extraction_results'::regclass
  ) THEN
    ALTER TABLE public.gacha_product_variant_extraction_results
      ADD CONSTRAINT gacha_variant_results_text_not_blank
      CHECK (
        btrim(source_name) <> ''
        AND btrim(method) <> ''
        AND btrim(parser_version) <> ''
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'gacha_variant_results_product_source_parser_key'
      AND conrelid = 'public.gacha_product_variant_extraction_results'::regclass
  ) THEN
    ALTER TABLE public.gacha_product_variant_extraction_results
      ADD CONSTRAINT gacha_variant_results_product_source_parser_key
      UNIQUE (product_id, source_name, parser_version);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS gacha_variant_results_source_status_idx
  ON public.gacha_product_variant_extraction_results (source_name, status);

CREATE INDEX IF NOT EXISTS gacha_variant_results_product_idx
  ON public.gacha_product_variant_extraction_results (product_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'update_updated_at'
      AND pg_function_is_visible(oid)
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'gacha_variant_results_updated_at'
      AND tgrelid = 'public.gacha_product_variant_extraction_results'::regclass
  ) THEN
    CREATE TRIGGER gacha_variant_results_updated_at
      BEFORE UPDATE ON public.gacha_product_variant_extraction_results
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

ALTER TABLE public.gacha_product_variant_extraction_results ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'gacha_product_variant_extraction_results'
      AND policyname = 'admins can manage gacha variant extraction results'
  ) THEN
    CREATE POLICY "admins can manage gacha variant extraction results"
      ON public.gacha_product_variant_extraction_results
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
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.gacha_product_variant_extraction_results
  TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
