-- refresh_gacha_browse_views()의 MV concurrent refresh가 9~18s 걸려
-- PostgREST 기본 statement_timeout(authenticator 8s)에 걸리면서
-- Biweekly Collector가 57014로 실패했다.
-- PostgREST는 함수 proconfig의 statement_timeout을 호출 전에 적용하므로
-- 이 함수에만 타임아웃을 늘린다. (Supabase API 요청 상한 60s)
alter function public.refresh_gacha_browse_views() set statement_timeout = '60s';

notify pgrst, 'reload schema';
