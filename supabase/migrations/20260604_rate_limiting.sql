-- rate_limits 테이블: serverless 환경에서 persistent rate limiting
CREATE TABLE IF NOT EXISTS public.rate_limits (
  key TEXT PRIMARY KEY,
  count INT NOT NULL DEFAULT 1,
  reset_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
-- 클라이언트 접근 없음 (SECURITY DEFINER 함수만 사용)

-- 원자적 upsert + count 반환
-- window_ms: milliseconds, max: 허용 최대 횟수
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key TEXT,
  p_max INT,
  p_window_ms BIGINT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
  v_window INTERVAL;
BEGIN
  v_window := (p_window_ms || ' milliseconds')::INTERVAL;

  INSERT INTO public.rate_limits(key, count, reset_at)
  VALUES (p_key, 1, now() + v_window)
  ON CONFLICT (key) DO UPDATE SET
    count = CASE
      WHEN rate_limits.reset_at <= now() THEN 1
      ELSE rate_limits.count + 1
    END,
    reset_at = CASE
      WHEN rate_limits.reset_at <= now() THEN now() + v_window
      ELSE rate_limits.reset_at
    END
  RETURNING count INTO v_count;

  RETURN v_count <= p_max;
END;
$$;

-- 만료된 row 정리 (선택적 주기 실행용)
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.rate_limits WHERE reset_at < now();
$$;
