-- 보안: 서버 전용 SECURITY DEFINER 함수의 anon/authenticated EXECUTE 회수
--
-- 배경
--   Postgres는 함수 생성 시 PUBLIC EXECUTE를 기본 부여하고, Supabase는 public
--   스키마 함수를 PostgREST RPC(POST /rest/v1/rpc/<name>)로 노출한다.
--   SECURITY DEFINER 함수는 RLS를 우회하므로, 클라이언트에 배포된 anon 키만으로
--   서버 전용 로직을 임의 호출할 수 있는 상태였다. 예:
--     - enqueue_notification / enqueue_*_fanout : 임의 사용자·전체 사용자에게 푸시 발송
--     - approve_gacha_product_name_candidate    : 모더레이션 자가 승인
--     - cleanup_rate_limits / check_rate_limit  : 레이트리밋 초기화·조작
--     - update_notification_* / claim_pending_* : 알림 파이프라인 조작
--
-- 안전성 근거 (변경 전 실측)
--   1. 저장소 전체에서 .rpc() 호출은 apps/web/src/app/api/** 와 apps/web/src/lib/**
--      에만 있다. 이 경로는 createAdminClient() = service_role 로 동작한다.
--   2. 모바일/웹 클라이언트에는 .rpc() 호출도, /rest/v1/rpc/ 직접 fetch도 0건이다.
--      모바일의 supabase 클라이언트 사용처는 auth / 프로필 / 스토리지뿐이다.
--   따라서 anon·authenticated 권한 회수는 앱 동작에 영향이 없다.
--
-- 의도적으로 제외한 것
--   - get_current_user_role() : user_profiles의 RLS 정책 2곳에서 호출된다.
--     authenticated 권한을 회수하면 정책 평가가 실패해 프로필 조회가 전부 깨진다.
--   - 트리거 함수(grant_admin_badge, handle_new_user,
--     trigger_dispatch_pending_notifications) : PostgREST가 노출하지 않으므로
--     RPC 공격면이 아니다. 괜히 건드리지 않는다.
--   - 읽기 전용 조회 함수(get_shops_by_*, search_*, get_daily_featured_gacha,
--     get_new_arrival_gacha) : 공개 데이터 조회라 노출 자체의 피해가 없고,
--     잘못 건드리면 지도/검색이 통째로 죽는다. 별도 판단으로 미룬다.
--
-- approve_shop_owner_application 은 20260825_revoke_approve_rpc_public_execute.sql
-- 에서 이미 처리했다.

DO $$
DECLARE
  target_names text[] := ARRAY[
    -- 모더레이션 승인
    'approve_gacha_product_name_candidate',
    -- 샵 상태 변경
    'auto_hide_shop_if_absent',
    -- 레이트리밋
    'check_rate_limit',
    'cleanup_rate_limits',
    -- 푸시 토큰
    'delete_unregistered_token',
    -- 알림 발송 (전체 사용자 스팸 벡터)
    'enqueue_notification',
    'enqueue_product_wishlist_fanout',
    'enqueue_wishlist_news',
    -- 알림 파이프라인 내부 상태
    'claim_pending_notifications',
    'mark_notification_failed_no_tokens',
    'reschedule_notification_with_backoff',
    'update_notification_delivery_results',
    'update_notification_receipt'
  ];
  r record;
  n integer := 0;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname = ANY(target_names)
       -- 트리거 함수는 건드리지 않는다
       AND p.prorettype <> 'trigger'::regtype
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig
    );
    n := n + 1;
    RAISE NOTICE 'locked down %', r.sig;
  END LOOP;

  RAISE NOTICE 'total locked down: %', n;
END $$;

NOTIFY pgrst, 'reload schema';
