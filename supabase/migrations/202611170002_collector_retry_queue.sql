BEGIN;

CREATE TABLE public.gacha_collector_retries (
  mode text NOT NULL CHECK (mode IN ('catalog', 'variants')),
  source text NOT NULL CHECK (source ~ '^[a-z][a-z0-9_]{0,63}$'),
  target_key text NOT NULL CHECK (btrim(target_key) <> '' AND octet_length(target_key) <= 1024),
  stage text NOT NULL CHECK (stage IN ('list', 'detail_request', 'parse', 'save', 'lineup')),
  url text NOT NULL CHECK (btrim(url) <> ''),
  last_error text NOT NULL,
  context jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(context) = 'object'),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 5),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'exhausted', 'resolved')),
  available_at timestamptz NOT NULL,
  lease_token uuid,
  updated_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  PRIMARY KEY (mode, source, target_key),
  CHECK (lease_token IS NULL OR (status = 'pending' AND attempt_count > 0))
);

ALTER TABLE public.gacha_collector_retries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.gacha_collector_retries FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.gacha_collector_retries TO service_role;
CREATE POLICY gacha_collector_retries_service_read
  ON public.gacha_collector_retries FOR SELECT TO service_role USING (true);

CREATE INDEX gacha_collector_retries_pending_due_idx
  ON public.gacha_collector_retries (mode, source, available_at, target_key)
  WHERE status = 'pending';

CREATE FUNCTION public.claim_gacha_collector_retries(
  p_mode text,
  p_sources text[],
  p_limit_per_source integer
)
RETURNS SETOF public.gacha_collector_retries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  claim_time timestamptz := statement_timestamp();
  source_limit integer := LEAST(20, GREATEST(1, COALESCE(p_limit_per_source, 1)));
BEGIN
  WITH expired AS (
    SELECT queue.source, queue.target_key
    FROM public.gacha_collector_retries AS queue
    WHERE queue.mode = p_mode
      AND queue.source = ANY(p_sources)
      AND queue.status = 'pending'
      AND queue.attempt_count = 5
      AND queue.available_at <= claim_time
    FOR UPDATE OF queue SKIP LOCKED
  )
  UPDATE public.gacha_collector_retries AS queue
  SET status = 'exhausted', lease_token = NULL, updated_at = claim_time
  FROM expired
  WHERE queue.mode = p_mode
    AND queue.source = expired.source
    AND queue.target_key = expired.target_key;

  RETURN QUERY
  WITH requested_sources AS (
    SELECT DISTINCT requested.source
    FROM unnest(p_sources) AS requested(source)
    WHERE requested.source IS NOT NULL
    ORDER BY requested.source
  ), due AS MATERIALIZED (
    SELECT candidate.source, candidate.target_key, candidate.available_at
    FROM requested_sources
    CROSS JOIN LATERAL (
      SELECT queue.source, queue.target_key, queue.available_at
      FROM public.gacha_collector_retries AS queue
      WHERE queue.mode = p_mode
        AND queue.source = requested_sources.source
        AND queue.status = 'pending'
        AND queue.attempt_count < 5
        AND queue.available_at <= claim_time
      ORDER BY queue.available_at, queue.target_key
      LIMIT source_limit
      FOR UPDATE OF queue SKIP LOCKED
    ) AS candidate
  ), claimed AS (
    UPDATE public.gacha_collector_retries AS queue
    SET lease_token = gen_random_uuid(),
        attempt_count = queue.attempt_count + 1,
        available_at = claim_time + interval '2 hours',
        updated_at = claim_time
    FROM due
    WHERE queue.mode = p_mode
      AND queue.source = due.source
      AND queue.target_key = due.target_key
    RETURNING queue.*
  )
  SELECT claimed.*
  FROM claimed
  JOIN due USING (source, target_key)
  ORDER BY due.available_at, due.source, due.target_key;
END;
$$;

CREATE FUNCTION public.record_gacha_collector_failure(
  p_mode text,
  p_source text,
  p_target_key text,
  p_stage text,
  p_url text,
  p_error text,
  p_context jsonb,
  p_lease_token uuid DEFAULT NULL,
  p_permanent boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  failure_time timestamptz := statement_timestamp();
BEGIN
  IF p_lease_token IS NULL THEN
    INSERT INTO public.gacha_collector_retries AS queue (
      mode, source, target_key, stage, url, last_error, context, status, available_at, updated_at
    )
    VALUES (
      p_mode, p_source, p_target_key, p_stage, p_url, left(p_error, 4096), COALESCE(p_context, '{}'::jsonb),
      CASE WHEN p_permanent THEN 'exhausted' ELSE 'pending' END,
      CASE WHEN p_permanent THEN failure_time ELSE failure_time + interval '30 minutes' END,
      failure_time
    )
    ON CONFLICT (mode, source, target_key) DO UPDATE
      SET stage = EXCLUDED.stage,
          url = EXCLUDED.url,
          last_error = EXCLUDED.last_error,
          context = EXCLUDED.context,
          status = EXCLUDED.status,
          available_at = EXCLUDED.available_at,
          updated_at = EXCLUDED.updated_at,
          attempt_count = 0
    WHERE queue.status = 'resolved';
  ELSE
    UPDATE public.gacha_collector_retries AS queue
    SET stage = p_stage,
        url = p_url,
        last_error = left(p_error, 4096),
        context = COALESCE(p_context, '{}'::jsonb),
        status = CASE WHEN p_permanent OR queue.attempt_count = 5 THEN 'exhausted' ELSE 'pending' END,
        available_at = CASE
          WHEN p_permanent OR queue.attempt_count = 5 THEN failure_time
          ELSE failure_time + interval '30 minutes' * (1 << (queue.attempt_count - 1))
        END,
        lease_token = NULL,
        updated_at = failure_time
    WHERE queue.mode = p_mode
      AND queue.source = p_source
      AND queue.target_key = p_target_key
      AND queue.status = 'pending'
      AND queue.lease_token = p_lease_token
      AND queue.available_at > failure_time;
  END IF;

  RETURN FOUND;
END;
$$;

CREATE FUNCTION public.complete_gacha_collector_retry(
  p_mode text,
  p_source text,
  p_target_key text,
  p_lease_token uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.gacha_collector_retries AS queue
  SET status = 'resolved', lease_token = NULL, updated_at = statement_timestamp()
  WHERE queue.mode = p_mode
    AND queue.source = p_source
    AND queue.target_key = p_target_key
    AND queue.status = 'pending'
    AND queue.lease_token = p_lease_token
    AND queue.available_at > statement_timestamp();

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_gacha_collector_retries(text, text[], integer)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.record_gacha_collector_failure(text, text, text, text, text, text, jsonb, uuid, boolean)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.complete_gacha_collector_retry(text, text, text, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.claim_gacha_collector_retries(text, text[], integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_gacha_collector_failure(text, text, text, text, text, text, jsonb, uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_gacha_collector_retry(text, text, text, uuid) TO service_role;

COMMIT;
