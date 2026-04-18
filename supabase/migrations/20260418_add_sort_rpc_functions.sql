CREATE OR REPLACE FUNCTION get_shops_by_distance(
  sw_lat double precision,
  sw_lng double precision,
  ne_lat double precision,
  ne_lng double precision,
  user_lat double precision,
  user_lng double precision,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  name text,
  address text,
  lat double precision,
  lng double precision,
  tags text[],
  image_urls text[],
  is_authorized boolean,
  place_id text,
  candidate_group_id bigint
)
LANGUAGE sql STABLE
AS $$
  SELECT
    s.id, s.name, s.address, s.lat, s.lng, s.tags, s.image_urls, s.is_authorized, s.place_id, s.candidate_group_id
  FROM shops s
  WHERE
    s.status = 'active'
    AND s.lat >= sw_lat AND s.lat <= ne_lat
    AND s.lng >= sw_lng AND s.lng <= ne_lng
  ORDER BY
    SQRT(
      POWER((s.lat - user_lat) * 111000, 2) +
      POWER((s.lng - user_lng) * 111000 * COS(RADIANS(user_lat)), 2)
    ) ASC
  LIMIT p_limit
  OFFSET p_offset;
$$;

CREATE OR REPLACE FUNCTION get_shops_by_wishlist_count(
  sw_lat double precision,
  sw_lng double precision,
  ne_lat double precision,
  ne_lng double precision,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  name text,
  address text,
  lat double precision,
  lng double precision,
  tags text[],
  image_urls text[],
  is_authorized boolean,
  place_id text,
  candidate_group_id bigint,
  wishlist_count bigint
)
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id, s.name, s.address, s.lat, s.lng, s.tags, s.image_urls, s.is_authorized, s.place_id, s.candidate_group_id,
    COUNT(w.id) AS wishlist_count
  FROM shops s
  LEFT JOIN wishlists w ON w.shop_id = s.id
  WHERE
    s.status = 'active'
    AND s.lat >= sw_lat AND s.lat <= ne_lat
    AND s.lng >= sw_lng AND s.lng <= ne_lng
  GROUP BY s.id
  ORDER BY wishlist_count DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;
