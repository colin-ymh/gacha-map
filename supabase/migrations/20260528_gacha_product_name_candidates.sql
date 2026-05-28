CREATE TABLE IF NOT EXISTS public.gacha_product_name_candidates (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id         uuid        NOT NULL REFERENCES public.gacha_products(id) ON DELETE CASCADE,
  locale             text        NOT NULL DEFAULT 'ko'
                                  CHECK (locale IN ('ko')),
  name               text        NOT NULL,
  normalized_name    text        NOT NULL,
  source_type        text        NOT NULL
                                  CHECK (source_type IN ('official_ko', 'domestic_vendor', 'admin', 'machine', 'user_alias')),
  source_name        text        NOT NULL,
  source_url         text,
  source_product_key text,
  confidence         numeric(4, 3),
  status             text        NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending', 'approved', 'rejected')),
  is_primary         boolean     NOT NULL DEFAULT false,
  reviewed_by        uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at        timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, locale, normalized_name, source_type, source_name)
);

CREATE INDEX IF NOT EXISTS gacha_product_name_candidates_product_id_idx
  ON public.gacha_product_name_candidates(product_id);

CREATE INDEX IF NOT EXISTS gacha_product_name_candidates_status_idx
  ON public.gacha_product_name_candidates(status);

CREATE INDEX IF NOT EXISTS gacha_product_name_candidates_source_idx
  ON public.gacha_product_name_candidates(source_type, source_name);

CREATE UNIQUE INDEX IF NOT EXISTS gacha_product_name_candidates_primary_key
  ON public.gacha_product_name_candidates(product_id, locale)
  WHERE status = 'approved' AND is_primary = true;

CREATE TRIGGER gacha_product_name_candidates_updated_at
  BEFORE UPDATE ON public.gacha_product_name_candidates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.gacha_product_name_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins can manage gacha_product_name_candidates"
  ON public.gacha_product_name_candidates
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

CREATE OR REPLACE FUNCTION public.approve_gacha_product_name_candidate(
  candidate_id uuid,
  reviewer_id uuid
)
RETURNS public.gacha_product_name_candidates
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  approved_candidate public.gacha_product_name_candidates;
BEGIN
  IF auth.role() <> 'service_role'
    AND NOT EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;

  SELECT *
  INTO approved_candidate
  FROM public.gacha_product_name_candidates
  WHERE id = candidate_id;

  IF approved_candidate.id IS NULL THEN
    RAISE EXCEPTION 'Gacha product name candidate not found';
  END IF;

  UPDATE public.gacha_product_name_candidates
  SET is_primary = false
  WHERE product_id = approved_candidate.product_id
    AND locale = approved_candidate.locale
    AND id <> approved_candidate.id;

  UPDATE public.gacha_product_name_candidates
  SET status = 'approved',
      is_primary = true,
      reviewed_by = reviewer_id,
      reviewed_at = now()
  WHERE id = approved_candidate.id
  RETURNING * INTO approved_candidate;

  UPDATE public.gacha_products
  SET name_ko = approved_candidate.name
  WHERE id = approved_candidate.product_id;

  RETURN approved_candidate;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_gacha_product_name_candidate(uuid, uuid)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_gacha_product_name_candidate(uuid, uuid)
  TO authenticated, service_role;
