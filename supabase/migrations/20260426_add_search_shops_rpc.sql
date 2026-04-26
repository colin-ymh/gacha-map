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
  wishlist_count bigint
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
      COUNT(w.id) AS wishlist_count
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
      COUNT(w.id) AS wishlist_count
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
