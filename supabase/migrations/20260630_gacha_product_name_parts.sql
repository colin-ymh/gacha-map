-- Retroactively record name_parts column (already exists in prod, added manually).
-- IF NOT EXISTS prevents failure on fresh environments where this migration runs first.
ALTER TABLE public.gacha_products
  ADD COLUMN IF NOT EXISTS name_parts jsonb;

-- RPC: search_gacha_products
-- Mirrors the existing search_shops convention (SECURITY DEFINER, p_ prefix).
-- Searches name fields AND tag array elements via ILIKE substring.
-- Returns total_count via window function to avoid a second count query.
CREATE OR REPLACE FUNCTION public.search_gacha_products(
  q              text    DEFAULT '',
  p_manufacturer text    DEFAULT NULL,
  p_limit        integer DEFAULT 20,
  p_offset       integer DEFAULT 0
)
RETURNS TABLE (
  id                 uuid,
  manufacturer       text,
  name               text,
  name_ja            text,
  name_ko            text,
  name_en            text,
  jan_code           text,
  product_code       text,
  price_jpy          integer,
  release_month      date,
  release_week_text  text,
  types_count        integer,
  official_image_url text,
  source_url         text,
  source_type        text,
  status             text,
  created_at         timestamptz,
  updated_at         timestamptz,
  last_seen_at       timestamptz,
  name_parts         jsonb,
  total_count        bigint
)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    gp.id,
    gp.manufacturer,
    gp.name,
    gp.name_ja,
    gp.name_ko,
    gp.name_en,
    gp.jan_code,
    gp.product_code,
    gp.price_jpy,
    gp.release_month,
    gp.release_week_text,
    gp.types_count,
    gp.official_image_url,
    gp.source_url,
    gp.source_type,
    gp.status,
    gp.created_at,
    gp.updated_at,
    gp.last_seen_at,
    gp.name_parts,
    COUNT(*) OVER() AS total_count
  FROM public.gacha_products gp
  WHERE gp.status = 'active'
    AND (p_manufacturer IS NULL OR gp.manufacturer = p_manufacturer)
    AND (
      q = '' OR
      gp.name         ILIKE '%' || q || '%' OR
      gp.name_ja      ILIKE '%' || q || '%' OR
      gp.name_ko      ILIKE '%' || q || '%' OR
      gp.name_en      ILIKE '%' || q || '%' OR
      gp.jan_code     ILIKE '%' || q || '%' OR
      gp.product_code ILIKE '%' || q || '%' OR
      (
        jsonb_typeof(gp.name_parts -> 'tags') = 'array'
        AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(gp.name_parts -> 'tags') t
          WHERE t ILIKE '%' || q || '%'
        )
      )
    )
  ORDER BY gp.release_month DESC NULLS LAST, gp.name ASC
  LIMIT p_limit OFFSET p_offset;
END;
$$;
