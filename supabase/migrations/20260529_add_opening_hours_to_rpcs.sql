-- Add opening_hours to all shop listing RPC functions
DROP FUNCTION IF EXISTS get_shops_by_distance(double precision, double precision, double precision, double precision, double precision, double precision, integer, integer);
DROP FUNCTION IF EXISTS get_shops_by_name(double precision, double precision, double precision, double precision, integer, integer);
DROP FUNCTION IF EXISTS get_shops_by_wishlist_count(double precision, double precision, double precision, double precision, integer, integer);
DROP FUNCTION IF EXISTS search_shops(text, text, integer, integer);

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
  candidate_group_id bigint,
  wishlist_count bigint,
  opening_hours text
)
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id, s.name, s.address, s.lat, s.lng, s.tags, s.image_urls, s.is_authorized,
    s.place_id, s.candidate_group_id,
    COUNT(w.id) AS wishlist_count,
    s.opening_hours
  FROM shops s
  LEFT JOIN wishlists w ON w.shop_id = s.id
  WHERE
    s.status = 'active'
    AND s.lat >= sw_lat AND s.lat <= ne_lat
    AND s.lng >= sw_lng AND s.lng <= ne_lng
  GROUP BY s.id
  ORDER BY
    SQRT(
      POWER((s.lat - user_lat) * 111000, 2) +
      POWER((s.lng - user_lng) * 111000 * COS(RADIANS(user_lat)), 2)
    ) ASC
  LIMIT p_limit
  OFFSET p_offset;
$$;

CREATE OR REPLACE FUNCTION get_shops_by_name(
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
  wishlist_count bigint,
  opening_hours text
)
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id, s.name, s.address, s.lat, s.lng, s.tags, s.image_urls, s.is_authorized,
    s.place_id, s.candidate_group_id,
    COUNT(w.id) AS wishlist_count,
    s.opening_hours
  FROM shops s
  LEFT JOIN wishlists w ON w.shop_id = s.id
  WHERE
    s.status = 'active'
    AND s.lat >= sw_lat AND s.lat <= ne_lat
    AND s.lng >= sw_lng AND s.lng <= ne_lng
  GROUP BY s.id
  ORDER BY s.name ASC
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
  wishlist_count bigint,
  opening_hours text
)
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id, s.name, s.address, s.lat, s.lng, s.tags, s.image_urls, s.is_authorized,
    s.place_id, s.candidate_group_id,
    COUNT(w.id) AS wishlist_count,
    s.opening_hours
  FROM shops s
  LEFT JOIN wishlists w ON w.shop_id = s.id
  WHERE
    s.status = 'active'
    AND s.lat >= sw_lat AND s.lat <= ne_lat
    AND s.lng >= sw_lng AND s.lng <= ne_lng
  GROUP BY s.id
  ORDER BY COUNT(w.id) DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

CREATE OR REPLACE FUNCTION search_shops(
  q text DEFAULT '',
  sort_by text DEFAULT 'name',
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
  wishlist_count bigint,
  opening_hours text
)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF sort_by = 'wishlist_count' THEN
    RETURN QUERY
    SELECT
      s.id, s.name, s.address, s.lat, s.lng, s.tags, s.image_urls, s.is_authorized,
      COUNT(w.id) AS wishlist_count,
      s.opening_hours
    FROM shops s
    LEFT JOIN wishlists w ON w.shop_id = s.id
    WHERE
      s.status = 'active'
      AND (q = '' OR s.name ILIKE '%' || q || '%' OR s.address ILIKE '%' || q || '%')
    GROUP BY s.id
    ORDER BY COUNT(w.id) DESC, s.name ASC
    LIMIT p_limit OFFSET p_offset;
  ELSE
    RETURN QUERY
    SELECT
      s.id, s.name, s.address, s.lat, s.lng, s.tags, s.image_urls, s.is_authorized,
      COUNT(w.id) AS wishlist_count,
      s.opening_hours
    FROM shops s
    LEFT JOIN wishlists w ON w.shop_id = s.id
    WHERE
      s.status = 'active'
      AND (q = '' OR s.name ILIKE '%' || q || '%' OR s.address ILIKE '%' || q || '%')
    GROUP BY s.id
    ORDER BY s.name ASC
    LIMIT p_limit OFFSET p_offset;
  END IF;
END;
$$;
