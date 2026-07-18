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
