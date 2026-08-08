-- 친구 초대 클릭 시 초대자에게 푸시 알림.
--
-- 리뷰/제보 액션 보너스는 이미 앱 안에서 발생하는 이벤트라 토스트로 충분하다고
-- 판단해 push는 제거하고(grant_gacha_bonus_event 단순화, 앱 코드에서 처리),
-- 친구 초대 클릭은 초대자가 앱 밖(카톡 등)에 있을 때 발생하므로 push로 알린다.
--
-- record_referral_click은 gacha_referral_clicks INSERT + "오늘 몇 번째 클릭인지"
-- + notification_preferences 확인을 한 함수에서 원자적으로 처리한다.
-- consume_daily_roll/grant_gacha_bonus_event와 동일하게 advisory lock으로
-- 초대자별 직렬화한다(락 키는 따로 둬서 롤 소비/액션 보너스 로직과 안 얽히게 한다).
--
-- 중복 클릭(같은 inviter+visitor+오늘)은 gacha_referral_clicks_daily_uniq
-- 유니크 인덱스가 막는다. 이 인덱스는 함수형 인덱스라 ON CONFLICT (...) 타겟
-- 매칭이 까다로워, assign_referral_code가 이미 쓰는 예외 처리 패턴
-- (BEGIN ... EXCEPTION WHEN unique_violation)을 그대로 따른다.

alter table public.notification_preferences
  add column if not exists gacha_referral_bonus boolean not null default true;

alter table public.pending_notifications
  drop constraint if exists pending_notifications_category_check;

alter table public.pending_notifications
  add constraint pending_notifications_category_check
  check (category in (
    'report_result', 'shop_owner_activity', 'wishlist_news', 'badge',
    'shop_owner_update', 'wishlist_product_update', 'product_wishlist_restock',
    'gacha_bonus', 'gacha_referral_bonus'
  ));

create or replace function public.record_referral_click(
  p_inviter_id uuid,
  p_visitor_id uuid,
  p_variant_id uuid,
  p_bonus_max int
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_click_id uuid;
  v_count int;
  v_pref_on boolean;
begin
  perform pg_advisory_xact_lock(hashtext(p_inviter_id::text || ':referral_click'));

  begin
    insert into public.gacha_referral_clicks (inviter_id, visitor_id, variant_id)
    values (p_inviter_id, p_visitor_id, p_variant_id)
    returning id into v_click_id;
  exception when unique_violation then
    -- 오늘 이미 인정된 (초대자, 방문자) 조합 — 새로 적립된 게 아니므로 알릴 것 없음
    return false;
  end;

  select count(*)::int into v_count
  from public.gacha_referral_clicks
  where inviter_id = p_inviter_id
    and clicked_at >= public.kst_today_start();

  select np.gacha_referral_bonus into v_pref_on
  from public.notification_preferences np
  where np.user_id = p_inviter_id;

  -- 오늘 상한 이내에 든 클릭이라 실제로 뽑기 기회가 늘었고, 알림 설정도 켜져
  -- 있을 때만 true. 상한을 넘긴 클릭은 행은 쌓이지만(집계용) 알리지 않는다 —
  -- consume_daily_roll이 least(p_bonus_max, count(*))로 상한을 적용하는 것과
  -- 동일한 의미.
  return v_count <= p_bonus_max and coalesce(v_pref_on, true);
end;
$$;

revoke all on function public.record_referral_click(uuid, uuid, uuid, int) from public, anon, authenticated;
grant execute on function public.record_referral_click(uuid, uuid, uuid, int) to service_role;

-- 리뷰/제보 보너스는 이제 토스트로만 알린다. notification_preferences 확인은
-- 더 이상 의미가 없으므로(푸시가 없으니) 제거하고, "오늘 상한 이내에 든
-- 이벤트인지"(= 실제로 뽑기 기회가 늘었는지)만 반환한다.
create or replace function public.grant_gacha_bonus_event(
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
begin
  perform pg_advisory_xact_lock(hashtext(p_user_id::text || ':gacha_bonus_grant'));

  insert into public.gacha_bonus_events (user_id, source_type, source_id)
  values (p_user_id, p_source_type, p_source_id)
  on conflict (user_id, source_type, source_id) do nothing
  returning id into v_id;

  -- 중복 제출(이미 적립된 액션 재시도) — 새로 적립된 게 아니므로 false
  if v_id is null then
    return false;
  end if;

  select count(*)::int into v_count
  from public.gacha_bonus_events
  where user_id = p_user_id
    and created_at >= public.kst_today_start();

  return v_count <= p_action_bonus_max;
end;
$$;

revoke all on function public.grant_gacha_bonus_event(uuid, text, uuid, int) from public, anon, authenticated;
grant execute on function public.grant_gacha_bonus_event(uuid, text, uuid, int) to service_role;
