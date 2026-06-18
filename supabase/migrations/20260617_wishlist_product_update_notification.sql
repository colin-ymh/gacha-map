-- notification_preferences에 wishlist_product_update 컬럼 추가
ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS wishlist_product_update boolean NOT NULL DEFAULT true;

-- 기존 opt-out 사용자 의도 보존: wishlist_news=false면 wishlist_product_update도 false
UPDATE notification_preferences
  SET wishlist_product_update = false
  WHERE wishlist_news = false;

-- pending_notifications category CHECK 확장
ALTER TABLE pending_notifications
  DROP CONSTRAINT IF EXISTS pending_notifications_category_check;

ALTER TABLE pending_notifications
  ADD CONSTRAINT pending_notifications_category_check
  CHECK (category IN ('report_result', 'shop_owner_activity', 'wishlist_news', 'badge', 'shop_owner_update', 'wishlist_product_update'));

-- enqueue_wishlist_news RPC: notification_preferences LEFT JOIN + COALESCE 체크 추가
CREATE OR REPLACE FUNCTION enqueue_wishlist_news(
  p_shop_id uuid,
  p_category text,
  p_title text,
  p_body text,
  p_data jsonb
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count int;
BEGIN
  INSERT INTO pending_notifications (user_id, category, title, body, data, status)
  SELECT
    w.user_id,
    p_category,
    p_title,
    p_body,
    p_data,
    'pending'
  FROM wishlists w
  LEFT JOIN notification_preferences np ON np.user_id = w.user_id
  WHERE w.shop_id = p_shop_id
    AND EXISTS (SELECT 1 FROM device_push_tokens WHERE user_id = w.user_id)
    AND (
      CASE p_category
        WHEN 'wishlist_news' THEN COALESCE(np.wishlist_news, true)
        WHEN 'wishlist_product_update' THEN COALESCE(np.wishlist_product_update, true)
        ELSE true
      END
    )
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
