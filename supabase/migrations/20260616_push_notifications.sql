-- device_push_tokens 테이블
CREATE TABLE device_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  platform text NOT NULL CHECK (platform IN ('ios', 'android')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX device_push_tokens_user_id_idx ON device_push_tokens(user_id);

ALTER TABLE device_push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can select own tokens" ON device_push_tokens
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "users can insert own tokens" ON device_push_tokens
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users can delete own tokens" ON device_push_tokens
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "service role full access" ON device_push_tokens
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- notification_preferences 테이블
CREATE TABLE notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  report_result boolean NOT NULL DEFAULT true,
  shop_owner_activity boolean NOT NULL DEFAULT true,
  wishlist_news boolean NOT NULL DEFAULT true,
  badge boolean NOT NULL DEFAULT true,
  shop_owner_update boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can select own preferences" ON notification_preferences
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "users can insert own preferences" ON notification_preferences
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users can update own preferences" ON notification_preferences
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "service role full access" ON notification_preferences
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- pending_notifications 테이블
CREATE TABLE pending_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('report_result', 'shop_owner_activity', 'wishlist_news', 'badge', 'shop_owner_update')),
  title text NOT NULL,
  body text NOT NULL,
  data jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'receipt_pending', 'sent', 'failed')),
  retry_count int NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  delivery_results jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX pending_notifications_status_idx ON pending_notifications(status);
CREATE INDEX pending_notifications_next_attempt_at_idx ON pending_notifications(next_attempt_at);
CREATE INDEX pending_notifications_claimed_at_idx ON pending_notifications(claimed_at);

ALTER TABLE pending_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role full access" ON pending_notifications
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- wishlists(shop_id) 인덱스 추가
CREATE INDEX IF NOT EXISTS wishlists_shop_id_idx ON wishlists(shop_id);

-- user_badges push_notified_at 컬럼 추가
ALTER TABLE user_badges ADD COLUMN IF NOT EXISTS push_notified_at timestamptz;

-- RPC: 알림 enqueue (토큰 존재 체크 + INSERT)
CREATE OR REPLACE FUNCTION enqueue_notification(
  p_user_id uuid,
  p_category text,
  p_title text,
  p_body text,
  p_data jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_notif_id uuid;
BEGIN
  -- 토큰이 없으면 enqueue하지 않음
  IF NOT EXISTS (SELECT 1 FROM device_push_tokens WHERE user_id = p_user_id) THEN
    RETURN NULL;
  END IF;

  INSERT INTO pending_notifications (user_id, category, title, body, data, status)
  VALUES (p_user_id, p_category, p_title, p_body, p_data, 'pending')
  RETURNING id INTO v_notif_id;

  RETURN v_notif_id;
END;
$$;

-- RPC: wishlist_news 팬아웃 (set-based)
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
  WHERE w.shop_id = p_shop_id
    AND EXISTS (SELECT 1 FROM device_push_tokens WHERE user_id = w.user_id)
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- RPC: cron Phase A — pending row 클레임 (FOR UPDATE SKIP LOCKED)
DROP FUNCTION IF EXISTS claim_pending_notifications(integer);

CREATE FUNCTION claim_pending_notifications(p_limit int DEFAULT 100)
RETURNS TABLE(
  notification_id uuid,
  out_user_id uuid,
  category text,
  title text,
  body text,
  data jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  UPDATE pending_notifications pn
  SET
    status = 'processing',
    claimed_at = now()
  WHERE pn.id IN (
    SELECT id FROM pending_notifications
    WHERE (
      status = 'pending' AND next_attempt_at <= now()
      OR
      status = 'processing' AND claimed_at < now() - interval '10 minutes'
    )
    ORDER BY created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING pn.id, pn.user_id, pn.category, pn.title, pn.body, pn.data;
END;
$$;

-- RPC: cron Phase A — 처리된 알림들의 delivery_results 업데이트
CREATE OR REPLACE FUNCTION update_notification_delivery_results(
  p_notification_id uuid,
  p_delivery_results jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE pending_notifications
  SET
    status = 'receipt_pending',
    delivery_results = p_delivery_results
  WHERE id = p_notification_id;
END;
$$;

-- RPC: cron Phase A — 토큰 0건 시 즉시 failed 처리
CREATE OR REPLACE FUNCTION mark_notification_failed_no_tokens(p_notification_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE pending_notifications
  SET status = 'failed'
  WHERE id = p_notification_id AND status = 'processing';
END;
$$;

-- RPC: cron Phase B — delivery_results에서 영수증 처리 결과 업데이트
CREATE OR REPLACE FUNCTION update_notification_receipt(
  p_notification_id uuid,
  p_delivery_results jsonb,
  p_final_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE pending_notifications
  SET
    status = p_final_status,
    delivery_results = p_delivery_results
  WHERE id = p_notification_id;
END;
$$;

-- RPC: cron — DeviceNotRegistered 토큰 삭제
CREATE OR REPLACE FUNCTION delete_unregistered_token(p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM device_push_tokens WHERE token = p_token;
END;
$$;

-- RPC: cron Phase B — 지수 백오프로 재시도 예약
CREATE OR REPLACE FUNCTION reschedule_notification_with_backoff(
  p_notification_id uuid,
  p_retry_count int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE pending_notifications
  SET
    status = 'pending',
    retry_count = p_retry_count + 1,
    next_attempt_at = now() + (pow(2, p_retry_count) || ' minutes')::interval
  WHERE id = p_notification_id;
END;
$$;
