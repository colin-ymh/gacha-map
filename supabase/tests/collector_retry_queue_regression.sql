-- Run against dev. Queue fixtures and lease changes are rolled back.
BEGIN;

DO $$
DECLARE
  source_a text := 'retry_a_' || substr(gen_random_uuid()::text, 1, 8);
  source_b text := 'retry_b_' || substr(gen_random_uuid()::text, 1, 8);
  source_c text := 'retry_c_' || substr(gen_random_uuid()::text, 1, 8);
  target_url text := 'https://example.invalid/catalog/retry';
  original_token uuid;
  lease public.gacha_collector_retries%ROWTYPE;
  n integer;
BEGIN
  IF NOT public.record_gacha_collector_failure(
    'catalog', source_a, 'detail', 'detail_request', target_url, 'initial', '{"depth":3}'
  ) THEN
    RAISE EXCEPTION 'Initial failure was not recorded';
  END IF;
  IF EXISTS (SELECT FROM public.claim_gacha_collector_retries('catalog', ARRAY[source_a], 3)) THEN
    RAISE EXCEPTION 'Claim ignored initial delay';
  END IF;

  UPDATE public.gacha_collector_retries SET available_at = statement_timestamp() - interval '1 minute'
  WHERE mode = 'catalog' AND source = source_a AND target_key = 'detail';
  SELECT * INTO STRICT lease FROM public.claim_gacha_collector_retries('catalog', ARRAY[source_a], 3);
  original_token := lease.lease_token;
  IF original_token IS NULL OR lease.attempt_count <> 1
    OR lease.available_at <> statement_timestamp() + interval '2 hours'
  THEN
    RAISE EXCEPTION 'Claim did not create a two-hour first lease';
  END IF;
  IF EXISTS (SELECT FROM public.claim_gacha_collector_retries('catalog', ARRAY[source_a], 3)) THEN
    RAISE EXCEPTION 'Live lease was claimed again';
  END IF;
  IF public.record_gacha_collector_failure('catalog', source_a, 'detail', 'parse', target_url, 'ordinary duplicate', '{}')
    OR public.record_gacha_collector_failure('catalog', source_a, 'detail', 'parse', target_url, 'wrong lease', '{}', gen_random_uuid())
    OR public.complete_gacha_collector_retry('catalog', source_a, 'detail', gen_random_uuid())
  THEN
    RAISE EXCEPTION 'Competing worker changed a live lease';
  END IF;
  IF NOT public.record_gacha_collector_failure(
    'catalog', source_a, 'detail', 'parse', target_url, 'first retry failed', '{"depth":4}', original_token
  ) THEN
    RAISE EXCEPTION 'Current worker could not reschedule failure';
  END IF;
  SELECT * INTO STRICT lease FROM public.gacha_collector_retries
  WHERE mode = 'catalog' AND source = source_a AND target_key = 'detail';
  IF lease.lease_token IS NOT NULL OR lease.stage <> 'parse' OR lease.context <> '{"depth":4}'
    OR lease.available_at <> statement_timestamp() + interval '30 minutes'
  THEN
    RAISE EXCEPTION 'Backoff or new failure context was wrong';
  END IF;
  IF public.record_gacha_collector_failure('catalog', source_a, 'detail', 'save', target_url, 'ordinary during backoff', '{}') THEN
    RAISE EXCEPTION 'Ordinary failure reset backoff';
  END IF;

  UPDATE public.gacha_collector_retries SET available_at = statement_timestamp() - interval '1 minute'
  WHERE mode = 'catalog' AND source = source_a AND target_key = 'detail';
  SELECT * INTO STRICT lease FROM public.claim_gacha_collector_retries('catalog', ARRAY[source_a], 3);
  IF lease.lease_token = original_token OR lease.attempt_count <> 2
    OR public.complete_gacha_collector_retry('catalog', source_a, 'detail', original_token)
  THEN
    RAISE EXCEPTION 'Reclaimed job accepted its earlier lease';
  END IF;
  IF NOT public.record_gacha_collector_failure(
    'catalog', source_a, 'detail', 'save', target_url, 'second retry failed', '{}', lease.lease_token
  ) THEN
    RAISE EXCEPTION 'Second retry failure could not be rescheduled';
  END IF;
  IF NOT EXISTS (
    SELECT FROM public.gacha_collector_retries
    WHERE mode = 'catalog' AND source = source_a AND target_key = 'detail'
      AND available_at = statement_timestamp() + interval '1 hour'
  ) THEN
    RAISE EXCEPTION 'Second retry did not get exponential backoff';
  END IF;

  UPDATE public.gacha_collector_retries SET available_at = statement_timestamp() - interval '1 minute'
  WHERE mode = 'catalog' AND source = source_a AND target_key = 'detail';
  SELECT * INTO STRICT lease FROM public.claim_gacha_collector_retries('catalog', ARRAY[source_a], 3);
  IF NOT public.complete_gacha_collector_retry('catalog', source_a, 'detail', lease.lease_token) THEN
    RAISE EXCEPTION 'Current worker could not complete its lease';
  END IF;
  IF public.complete_gacha_collector_retry('catalog', source_a, 'detail', lease.lease_token) THEN
    RAISE EXCEPTION 'Completion was not confined to the current lease';
  END IF;
  IF NOT public.record_gacha_collector_failure(
    'catalog', source_a, 'detail', 'save', target_url, 'new incident', '{}'
  ) THEN
    RAISE EXCEPTION 'New incident could not reopen a completed job';
  END IF;
  IF NOT EXISTS (
    SELECT FROM public.gacha_collector_retries
    WHERE mode = 'catalog' AND source = source_a AND target_key = 'detail'
      AND status = 'pending' AND attempt_count = 0 AND last_error = 'new incident'
  ) THEN
    RAISE EXCEPTION 'New incident did not reopen completed job with fresh attempts';
  END IF;

  INSERT INTO public.gacha_collector_retries(
    mode, source, target_key, stage, url, last_error, attempt_count, available_at, lease_token
  ) VALUES
    ('catalog', source_a, 'crashed-fifth', 'save', target_url, 'previous error', 5,
      statement_timestamp() - interval '1 minute', gen_random_uuid()),
    ('catalog', source_a, 'due-fifth', 'save', target_url, 'previous error', 4,
      statement_timestamp() - interval '1 minute', NULL),
    ('variants', source_a, 'separate-mode', 'lineup', target_url, 'previous error', 0,
      statement_timestamp() - interval '1 minute', NULL);
  SELECT * INTO STRICT lease FROM public.claim_gacha_collector_retries('catalog', ARRAY[source_a], 3);
  IF lease.target_key <> 'due-fifth' OR lease.attempt_count <> 5
    OR NOT EXISTS (
      SELECT FROM public.gacha_collector_retries
      WHERE mode = 'catalog' AND source = source_a AND target_key = 'crashed-fifth'
        AND status = 'exhausted' AND lease_token IS NULL
    )
  THEN
    RAISE EXCEPTION 'Fifth expired lease, claim, or mode isolation violated';
  END IF;
  IF NOT public.record_gacha_collector_failure(
    'catalog', source_a, 'due-fifth', 'save', target_url, 'still failed', '{}', lease.lease_token
  ) THEN
    RAISE EXCEPTION 'Fifth failure was not recorded';
  END IF;
  IF public.record_gacha_collector_failure(
    'catalog', source_a, 'due-fifth', 'save', target_url, 'exhausted duplicate', '{}'
  ) THEN
    RAISE EXCEPTION 'Exhausted job was reopened';
  END IF;
  IF NOT EXISTS (
    SELECT FROM public.gacha_collector_retries
    WHERE mode = 'catalog' AND source = source_a AND target_key = 'due-fifth'
      AND status = 'exhausted' AND lease_token IS NULL
  ) THEN
    RAISE EXCEPTION 'Fifth failure did not exhaust the job or was reopened';
  END IF;
  IF NOT public.record_gacha_collector_failure(
    'catalog', source_a, 'gone', 'detail_request', target_url, 'HTTP 410', '{}', NULL, true
  ) THEN
    RAISE EXCEPTION 'Permanent failure was not recorded';
  END IF;
  IF NOT EXISTS (
    SELECT FROM public.gacha_collector_retries
    WHERE mode = 'catalog' AND source = source_a AND target_key = 'gone'
      AND status = 'exhausted' AND attempt_count = 0
  ) THEN
    RAISE EXCEPTION 'Permanent failure was not immediately exhausted';
  END IF;

  INSERT INTO public.gacha_collector_retries(mode, source, target_key, stage, url, last_error, available_at)
  SELECT 'catalog', selected.source, 'quota-' || serial, 'list', target_url, 'quota fixture',
    statement_timestamp() - interval '1 hour' + interval '1 second' * serial
  FROM unnest(ARRAY[source_b, source_c]) AS selected(source)
  CROSS JOIN generate_series(1, 22) AS jobs(serial);
  SELECT count(*) INTO n
  FROM public.claim_gacha_collector_retries('catalog', ARRAY[source_b, source_c, source_b], 999);
  IF n <> 40 OR EXISTS (
    SELECT FROM public.gacha_collector_retries
    WHERE mode = 'catalog' AND source IN (source_b, source_c) AND target_key IN ('quota-21', 'quota-22')
      AND lease_token IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Per-source upper clamp, deduplication or due ordering violated';
  END IF;
  SELECT count(*) INTO n FROM public.claim_gacha_collector_retries('catalog', ARRAY[source_b, source_c], 0);
  IF n <> 2 THEN
    RAISE EXCEPTION 'Per-source minimum quota violated';
  END IF;

  IF has_table_privilege('anon', 'public.gacha_collector_retries', 'SELECT')
    OR has_table_privilege('authenticated', 'public.gacha_collector_retries', 'SELECT')
    OR has_table_privilege('service_role', 'public.gacha_collector_retries', 'UPDATE')
    OR NOT has_table_privilege('service_role', 'public.gacha_collector_retries', 'SELECT')
    OR NOT has_function_privilege('service_role', 'public.claim_gacha_collector_retries(text,text[],integer)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.claim_gacha_collector_retries(text,text[],integer)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.record_gacha_collector_failure(text,text,text,text,text,text,jsonb,uuid,boolean)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.complete_gacha_collector_retry(text,text,text,uuid)', 'EXECUTE')
  THEN
    RAISE EXCEPTION 'Unexpected retry queue permissions';
  END IF;
END;
$$;

ROLLBACK;
SELECT 'collector retry queue rollback regression passed' AS result;
