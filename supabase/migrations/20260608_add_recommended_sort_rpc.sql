CREATE OR REPLACE FUNCTION public.get_shops_by_score(
  sw_lat double precision,
  sw_lng double precision,
  ne_lat double precision,
  ne_lng double precision,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  name text,
  address text,
  lat double precision,
  lng double precision,
  is_authorized boolean,
  candidate_group_id bigint,
  wishlist_count bigint,
  opening_hours text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT
    s.id,
    s.name,
    s.address,
    s.lat,
    s.lng,
    s.is_authorized,
    s.candidate_group_id,
    COUNT(DISTINCT w.id) AS wishlist_count,
    s.opening_hours
  FROM shops s
  LEFT JOIN wishlists w ON w.shop_id = s.id
  LEFT JOIN reviews r ON r.shop_id = s.id
  LEFT JOIN shop_gacha_products sgp ON sgp.shop_id = s.id
  LEFT JOIN shop_quick_reports qr
    ON qr.shop_id = s.id AND qr.kind = 'gacha_present'
  WHERE s.status = 'active'
    AND s.lat >= sw_lat AND s.lat <= ne_lat
    AND s.lng >= sw_lng AND s.lng <= ne_lng
  GROUP BY s.id
  ORDER BY (
    COUNT(DISTINCT w.id) +
    COUNT(DISTINCT r.id) +
    COUNT(DISTINCT sgp.id) +
    COUNT(DISTINCT qr.id)
  ) DESC, s.name ASC
  LIMIT p_limit OFFSET p_offset;
$$;
