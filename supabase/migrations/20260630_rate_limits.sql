CREATE TABLE IF NOT EXISTS public.rate_limits (
  key text PRIMARY KEY,
  count integer NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key text,
  p_max integer,
  p_window_ms bigint
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start timestamptz;
  v_count integer;
  v_now timestamptz := now();
BEGIN
  SELECT window_start, count INTO v_window_start, v_count
  FROM public.rate_limits
  WHERE key = p_key
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.rate_limits (key, count, window_start)
    VALUES (p_key, 1, v_now);
    RETURN true;
  END IF;

  IF (EXTRACT(EPOCH FROM (v_now - v_window_start)) * 1000) >= p_window_ms THEN
    UPDATE public.rate_limits SET count = 1, window_start = v_now WHERE key = p_key;
    RETURN true;
  END IF;

  IF v_count >= p_max THEN
    RETURN false;
  END IF;

  UPDATE public.rate_limits SET count = count + 1 WHERE key = p_key;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, integer, bigint) TO service_role;
