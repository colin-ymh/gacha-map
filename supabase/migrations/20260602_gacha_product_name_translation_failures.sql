CREATE TABLE IF NOT EXISTS public.gacha_product_name_translation_failures (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        uuid        NOT NULL REFERENCES public.gacha_products(id) ON DELETE CASCADE,
  locale            text        NOT NULL DEFAULT 'ko'
                                CHECK (locale IN ('ko')),
  source_name       text        NOT NULL DEFAULT 'openai',
  model             text        NOT NULL,
  error_code        text        NOT NULL,
  error_message     text        NOT NULL,
  attempt_count     integer     NOT NULL DEFAULT 1
                                CHECK (attempt_count > 0),
  last_attempted_at timestamptz NOT NULL DEFAULT now(),
  resolved_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, locale, source_name)
);

CREATE INDEX IF NOT EXISTS gacha_product_name_translation_failures_unresolved_idx
  ON public.gacha_product_name_translation_failures(last_attempted_at DESC)
  WHERE resolved_at IS NULL;

CREATE TRIGGER gacha_product_name_translation_failures_updated_at
  BEFORE UPDATE ON public.gacha_product_name_translation_failures
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.gacha_product_name_translation_failures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins can manage gacha_product_name_translation_failures"
  ON public.gacha_product_name_translation_failures
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
