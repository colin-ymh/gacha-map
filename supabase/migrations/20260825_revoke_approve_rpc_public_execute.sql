-- 보안 핫픽스: approve_shop_owner_application의 PUBLIC EXECUTE 회수
--
-- 문제
--   Postgres는 함수 생성 시 기본으로 PUBLIC EXECUTE를 부여한다. Supabase는
--   public 스키마의 함수를 PostgREST RPC로 노출하므로, 클라이언트에 배포된
--   anon 키만 있으면 누구나 아래를 호출할 수 있었다.
--
--     POST /rest/v1/rpc/approve_shop_owner_application
--     { "application_id": "<본인이 만든 신청 id>", "note": null }
--
--   이 함수는 SECURITY DEFINER라 RLS를 우회한다. 결과적으로 임의의 사용자가
--   관리자 승인 없이 자기 신청을 승인해 shops.owner_id / is_authorized 를 가져가고
--   user_profiles.role 을 shop_owner 로 올릴 수 있었다.
--
-- 영향 범위 확인
--   저장소 전체에서 .rpc() 호출은 apps/web/src/app/api/** 와 apps/web/src/lib/**
--   (서버, service_role) 에만 있다. 모바일/웹 클라이언트에는 한 건도 없다.
--   따라서 anon/authenticated 권한 회수는 앱 동작에 영향이 없다.
--
-- 이 파일은 기능 마이그레이션(20260824_shop_application_hardening.sql)과 독립적으로
--   prod에 먼저 적용하기 위해 분리했다. 시그니처가 환경마다 다를 수 있으므로
--   (prod: (uuid, text) / dev: (uuid, text, boolean)) 이름 기준으로 모든 오버로드를 처리한다.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname = 'approve_shop_owner_application'
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig
    );
    RAISE NOTICE 'locked down %', r.sig;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
