-- Realtime push notification dispatch: DB 트리거가 INSERT 직후 즉시
-- /api/cron/send-notifications를 호출해 폴링 지연 없이 발송을 시작한다.
-- 기존 GitHub Actions cron(분당, 신뢰성 낮음)은 pg_cron 5분 안전망으로 대체한다.
--
-- 실제 URL/secret 값은 이 파일에 없음 — dev/prod 프로젝트마다 다르므로
-- 적용 후 별도 execute_sql로 vault.create_secret 호출해 수동 주입한다.
-- (secret 이름: push_trigger_url, db_cron_secret)

create extension if not exists supabase_vault;
create extension if not exists pg_net;
create extension if not exists pg_cron;

-- 트리거 debounce용 단일 row 상태 테이블. 짧은 시간에 여러 INSERT 문이
-- 연달아 와도 dispatch 호출을 과도하게 하지 않기 위함 (statement-level
-- 트리거라 위시리스트 fan-out처럼 한 INSERT 문에 수천 row가 들어가도
-- 애초에 트리거는 1번만 도는데, 이건 짧은 간격의 "여러 번의 INSERT 문"을
-- 추가로 제어하기 위한 것).
create table if not exists notification_dispatch_state (
  id boolean primary key default true,
  last_dispatched_at timestamptz,
  constraint notification_dispatch_state_single_row check (id)
);
insert into notification_dispatch_state (id) values (true) on conflict do nothing;

create or replace function trigger_dispatch_pending_notifications()
returns trigger
language plpgsql
security definer
set search_path = public, vault, net
as $$
declare
  v_should_dispatch boolean;
  v_url text;
  v_secret text;
begin
  -- 예외가 나도 원본 INSERT는 항상 성공해야 한다.
  begin
    update notification_dispatch_state
      set last_dispatched_at = now()
      where id = true
        and (last_dispatched_at is null or last_dispatched_at < now() - interval '3 seconds')
    returning true into v_should_dispatch;

    if not coalesce(v_should_dispatch, false) then
      return null;
    end if;

    select decrypted_secret into v_url
      from vault.decrypted_secrets where name = 'push_trigger_url';
    select decrypted_secret into v_secret
      from vault.decrypted_secrets where name = 'db_cron_secret';

    if v_url is null or v_secret is null then
      return null;
    end if;

    perform net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || v_secret,
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    );
  exception when others then
    null;
  end;

  return null;
end;
$$;

drop trigger if exists pending_notifications_dispatch on pending_notifications;
create trigger pending_notifications_dispatch
after insert on pending_notifications
for each statement
execute function trigger_dispatch_pending_notifications();

-- Phase A 안전망(트리거가 놓친 row) + Phase B(영수증 확인) 5분 주기.
-- URL/secret은 vault에서 읽으므로 여기도 값 자체는 노출되지 않는다.
select cron.schedule(
  'send-pending-notifications',
  '*/5 * * * *',
  $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'push_trigger_url'),
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'db_cron_secret'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'push_trigger_url');
  $cron$
);
