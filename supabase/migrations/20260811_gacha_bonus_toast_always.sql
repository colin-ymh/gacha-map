-- 액션 보너스 적립 시 인앱 토스트는 알림 설정과 무관하게 항상 뜨게 한다.
--
-- 기존 grant_gacha_bonus_event는 반환값에 notification_preferences.gacha_bonus를
-- AND로 곱했다. 그런데 이 반환값은 푸시 발송 여부가 아니라 API 응답의
-- gachaBonusGranted 플래그(= 클라이언트 토스트 표시 조건)로만 쓰인다.
-- gacha_bonus 카테고리로 푸시를 보내는 코드는 존재하지 않는다.
-- 결과적으로 "푸시 알림 설정"이 인앱 토스트를 막고 있었다 — 설정의 약속과
-- 실제 동작이 어긋난 상태.
--
-- 이제 반환값은 "오늘 상한 이내에 든 이벤트라 실제로 뽑기 기회가 늘었는지"만
-- 뜻한다. 시그니처가 그대로라 앱 배포 순서와 무관하게 적용해도 안전하다
-- (구버전 앱은 토스트가 더 자주 뜰 뿐이다).
--
-- notification_preferences.gacha_bonus 컬럼은 이 시점부터 사용처가 없다.
-- 가챠 보너스 알림 설정은 gacha_referral_bonus 하나로 통합되며(친구 초대
-- 보너스 푸시를 제어), gacha_bonus 컬럼은 롤백 여지를 위해 남겨둔다.

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

  -- 중복 제출(이미 적립된 액션 재시도) — 새로 적립된 게 아니므로 알릴 것 없음
  if v_id is null then
    return false;
  end if;

  select count(*)::int into v_count
  from public.gacha_bonus_events
  where user_id = p_user_id
    and created_at >= public.kst_today_start();

  -- 상한을 넘긴 이벤트는 행은 쌓이지만(집계용) 기회가 늘지 않으므로 알리지 않는다.
  return v_count <= p_action_bonus_max;
end;
$$;

revoke all on function public.grant_gacha_bonus_event(uuid, text, uuid, int) from public, anon, authenticated;
grant execute on function public.grant_gacha_bonus_event(uuid, text, uuid, int) to service_role;
