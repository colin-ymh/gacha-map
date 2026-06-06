-- get_shops_by_name, search_shops 함수에서 image_urls 참조 제거
-- 20260604_drop_shop_image_columns.sql에서 컬럼은 DROP됐으나 함수 정의 업데이트 누락됨

DROP FUNCTION IF EXISTS public.get_shops_by_name(double precision, double precision, double precision, double precision, integer, integer);

CREATE OR REPLACE FUNCTION public.get_shops_by_name(sw_lat double precision, sw_lng double precision, ne_lat double precision, ne_lng double precision, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, name text, address text, lat double precision, lng double precision, tags text[], is_authorized boolean, place_id text, candidate_group_id bigint, wishlist_count bigint, opening_hours text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT s.id, s.name, s.address, s.lat, s.lng, s.tags, s.is_authorized,
    s.place_id, s.candidate_group_id, COUNT(w.id) AS wishlist_count, s.opening_hours
  FROM shops s LEFT JOIN wishlists w ON w.shop_id = s.id
  WHERE s.status = 'active' AND s.lat >= sw_lat AND s.lat <= ne_lat AND s.lng >= sw_lng AND s.lng <= ne_lng
  GROUP BY s.id ORDER BY s.name ASC LIMIT p_limit OFFSET p_offset;
$function$;

DROP FUNCTION IF EXISTS public.search_shops(text, text, integer, integer);

CREATE OR REPLACE FUNCTION public.search_shops(q text DEFAULT ''::text, sort_by text DEFAULT 'name'::text, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, name text, address text, lat double precision, lng double precision, tags text[], is_authorized boolean, wishlist_count bigint, opening_hours text)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF sort_by = 'wishlist_count' THEN
    RETURN QUERY SELECT s.id, s.name, s.address, s.lat, s.lng, s.tags, s.is_authorized, COUNT(w.id) AS wishlist_count, s.opening_hours
    FROM shops s LEFT JOIN wishlists w ON w.shop_id = s.id
    WHERE s.status = 'active' AND (q = '' OR s.name ILIKE '%'||q||'%' OR s.address ILIKE '%'||q||'%')
    GROUP BY s.id ORDER BY COUNT(w.id) DESC, s.name ASC LIMIT p_limit OFFSET p_offset;
  ELSE
    RETURN QUERY SELECT s.id, s.name, s.address, s.lat, s.lng, s.tags, s.is_authorized, COUNT(w.id) AS wishlist_count, s.opening_hours
    FROM shops s LEFT JOIN wishlists w ON w.shop_id = s.id
    WHERE s.status = 'active' AND (q = '' OR s.name ILIKE '%'||q||'%' OR s.address ILIKE '%'||q||'%')
    GROUP BY s.id ORDER BY s.name ASC LIMIT p_limit OFFSET p_offset;
  END IF;
END;
$function$;
