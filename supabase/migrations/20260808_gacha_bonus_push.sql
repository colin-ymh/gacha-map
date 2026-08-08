-- 가챠 액션 보너스(review/shop_report/gacha_report) 적립 시 푸시 알림.
--
-- 삽입 + "오늘 상한(ACTION_BONUS_MAX) 이내인지" 판단 + notification_preferences
-- 확인을 한 함수에서 원자적으로 처리한다. TS에서 별도 COUNT 쿼리로 하면
-- (a) 동시 액션 race로 false negative가 나거나 (b) TS의 KST 자정 계산이
-- kst_today_start()와 미세하게 어긋날 수 있어 DB 함수 하나로 합친다.
-- consume_daily_roll과 동일하게 advisory lock으로 사용자별 직렬화한다
-- (락 키는 달리 둬서 롤 소비 로직과 불필요하게 얽히지 않게 한다).

alter table public.notification_preferences
  add column if not exists gacha_bonus boolean not null default true;

alter table public.pending_notifications
  drop constraint if exists pending_notifications_category_check;

alter table public.pending_notifications
  add constraint pending_notifications_category_check
  check (category in (
    'report_result', 'shop_owner_activity', 'wishlist_news', 'badge',
    'shop_owner_update', 'wishlist_product_update', 'product_wishlist_restock',
    'gacha_bonus'
  ));

create function public.grant_gacha_bonus_event(
  p_user_id uuid,
  p_source_type text,
  p_source_id uuid,
  p_action_bonus_max int
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_count int;
  v_pref_on boolean;
begin
  perform pg_advisory_xact_lock(hashtext(p_user_id::text || ':gacha_bonus_grant'));

  insert into public.gacha_bonus_events (user_id, source_type, source_id)
  values (p_user_id, p_source_type, p_source_id)
  on conflict (user_id, source_type, source_id) do nothing
  returning id into v_id;

  -- 중복 제출(이미 적립된 액션 재시도) — 새로 적립된 게 아니므로 알릴 것 없음
  if v_id is null then
    return false;
  end if;

  select count(*)::int into v_count
  from public.gacha_bonus_events
  where user_id = p_user_id
    and created_at >= public.kst_today_start();

  select np.gacha_bonus into v_pref_on
  from public.notification_preferences np
  where np.user_id = p_user_id;

  -- 오늘 상한 이내에 든 이벤트라 실제로 뽑기 기회가 늘었고, 알림 설정도 켜져
  -- 있을 때만 true. 상한을 넘긴 이벤트는 행은 쌓이지만(집계용) 알리지 않는다.
  return v_count <= p_action_bonus_max and coalesce(v_pref_on, true);
end;
$$;

revoke all on function public.grant_gacha_bonus_event(uuid, text, uuid, int) from public, anon, authenticated;
grant execute on function public.grant_gacha_bonus_event(uuid, text, uuid, int) to service_role;
