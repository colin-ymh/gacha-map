-- Shops sort functions for distance and wishlist count

-- Distance-based sort function
CREATE OR REPLACE FUNCTION get_shops_by_distance(
  sw_lat float8, sw_lng float8, ne_lat float8, ne_lng float8,
  user_lat float8, user_lng float8,
  p_limit int DEFAULT 20, p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid, name text, address text, lat float8, lng float8,
  tags text[], image_urls text[], is_authorized boolean
)
LANGUAGE sql STABLE AS $$
  SELECT id, name, address, lat, lng, tags, image_urls, is_authorized
  FROM shops
  WHERE status = 'active'
    AND lat BETWEEN sw_lat AND ne_lat
    AND lng BETWEEN sw_lng AND ne_lng
  ORDER BY (lat - user_lat)^2 + (lng - user_lng)^2 ASC
  LIMIT p_limit OFFSET p_offset;
$$;

-- Wishlist count-based sort function
CREATE OR REPLACE FUNCTION get_shops_by_wishlist_count(
  sw_lat float8, sw_lng float8, ne_lat float8, ne_lng float8,
  p_limit int DEFAULT 20, p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid, name text, address text, lat float8, lng float8,
  tags text[], image_urls text[], is_authorized boolean,
  wishlist_count int
)
LANGUAGE sql STABLE AS $$
  SELECT s.id, s.name, s.address, s.lat, s.lng, s.tags, s.image_urls, s.is_authorized,
         COUNT(w.id)::int as wishlist_count
  FROM shops s
  LEFT JOIN wishlists w ON w.shop_id = s.id
  WHERE s.status = 'active'
    AND s.lat BETWEEN sw_lat AND ne_lat
    AND s.lng BETWEEN sw_lng AND ne_lng
  GROUP BY s.id
  ORDER BY COUNT(w.id) DESC
  LIMIT p_limit OFFSET p_offset;
$$;
