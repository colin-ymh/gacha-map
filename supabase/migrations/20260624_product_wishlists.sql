CREATE TABLE product_wishlists (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id  uuid NOT NULL REFERENCES gacha_products(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);
CREATE INDEX ON product_wishlists (user_id);
ALTER TABLE product_wishlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own product wishlists"
  ON product_wishlists FOR ALL USING (auth.uid() = user_id);

ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS product_wishlist_restock boolean NOT NULL DEFAULT true;

ALTER TABLE pending_notifications
  DROP CONSTRAINT IF EXISTS pending_notifications_category_check;
ALTER TABLE pending_notifications
  ADD CONSTRAINT pending_notifications_category_check
  CHECK (category IN (
    'report_result','shop_owner_activity','wishlist_news','badge',
    'shop_owner_update','wishlist_product_update','product_wishlist_restock'
  ));

CREATE OR REPLACE FUNCTION enqueue_product_wishlist_fanout(
  p_product_id uuid,
  p_title      text,
  p_body       text,
  p_data       jsonb
) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_count int;
BEGIN
  INSERT INTO pending_notifications (user_id, category, title, body, data, status)
  SELECT pw.user_id, 'product_wishlist_restock', p_title, p_body, p_data, 'pending'
  FROM product_wishlists pw
  LEFT JOIN notification_preferences np ON np.user_id = pw.user_id
  WHERE pw.product_id = p_product_id
    AND EXISTS (SELECT 1 FROM device_push_tokens WHERE user_id = pw.user_id)
    AND COALESCE(np.product_wishlist_restock, true)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
