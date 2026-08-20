-- 가챠 스캔 이미지 보존 정책 — 자동 삭제 cron 등록
--
-- 배경: /api/gacha-scan이 사용자 촬영 이미지를 scan-images 버킷에 업로드하지만
-- 삭제 정책이 없어 무기한 보관되고 있었다. 개인정보처리방침에 고지한 보존 기준
-- (조사 완료 시 즉시 삭제 / 미완료여도 90일 상한)을 실제로 집행한다.
--
-- 실제 삭제 로직은 Next.js 라우트 /api/cron/purge-scan-images에 있다.
-- 여기서는 그 라우트를 매일 호출하는 스케줄만 등록한다.
-- (send-pending-notifications와 동일한 vault + pg_net 패턴)
--
-- 실행 전 예상 영향:
--   - vault에 purge_scan_images_url 시크릿 1건 생성 (없을 때만).
--   - cron job 'purge-scan-images' 1건 등록.
--   - 데이터 행 변경 0건. 실제 이미지 삭제는 이후 스케줄 실행 시 발생한다.
-- 재실행 시:
--   - cron.schedule은 동일 jobname을 upsert하므로 중복되지 않는다.
--   - vault 시크릿은 이미 있으면 건너뛴다.

BEGIN;

-- purge 라우트 URL은 기존 push_trigger_url과 같은 호스트를 쓰므로 경로만 바꿔 파생한다.
-- 값 자체는 vault 안에서만 다뤄지며 마이그레이션 텍스트에 노출되지 않는다.
do $$
declare
  v_base text;
begin
  if exists (select 1 from vault.decrypted_secrets where name = 'purge_scan_images_url') then
    return;
  end if;

  select decrypted_secret into v_base
  from vault.decrypted_secrets
  where name = 'push_trigger_url';

  if v_base is null then
    raise notice 'push_trigger_url이 없어 purge_scan_images_url을 생성하지 못했습니다. 수동 등록 필요.';
    return;
  end if;

  perform vault.create_secret(
    replace(v_base, '/api/cron/send-notifications', '/api/cron/purge-scan-images'),
    'purge_scan_images_url'
  );
end $$;

-- 매일 KST 03:00 (UTC 18:00) 1회.
-- 삭제 대상 판정(상태 terminal / 90일 초과)은 라우트가 담당한다.
select cron.schedule(
  'purge-scan-images',
  '0 18 * * *',
  $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'purge_scan_images_url'),
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'db_cron_secret'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'purge_scan_images_url');
  $cron$
);

COMMIT;
