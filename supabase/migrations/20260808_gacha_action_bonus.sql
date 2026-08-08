-- 리뷰/제보/가챠제보 완료 시 가챠 뽑기 보너스 지급
--
-- 정책: review/shop_report/gacha_report 세 종류를 합산해 하루 최대 3회 보너스.
-- 기존 gacha_referral_clicks(친구 초대) 보너스 패턴을 그대로 재사용한다.
-- p_action_bonus_max 값은 앱 상수(apps/web/src/constants/gacha-roll.ts)가 소유한다.

-- ---------------------------------------------------------------------------
-- 1. gacha_bonus_events
-- ---------------------------------------------------------------------------

create table if not exists public.gacha_bonus_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null check (source_type in ('review', 'shop_report', 'gacha_report')),
  source_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, source_type, source_id)
);

create index if not exists gacha_bonus_events_user_created_idx
  on public.gacha_bonus_events (user_id, created_at);

alter table public.gacha_bonus_events enable row level security;

-- INSERT는 service_role만 (정책 부재 = 거부). 본인은 자기 적립 내역만 읽는다.
create policy "users can read own bonus events"
  on public.gacha_bonus_events for select
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 2. RPC 재작성 — 파라미터 개수가 바뀌므로 CREATE OR REPLACE로는 기존 함수가
--    지워지지 않고 별도 오버로드로 남는다. 명시적으로 DROP 후 CREATE 한다.
-- ---------------------------------------------------------------------------

drop function if exists public.get_daily_roll_quota(uuid, int, int);
drop function if exists public.consume_daily_roll(uuid, uuid, uuid, int, int);

create function public.get_daily_roll_quota(
  p_user_id uuid,
  p_base int,
  p_bonus_max int,
  p_action_bonus_max int
)
returns table(base int, bonus int, used int, remaining int)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_day_start timestamptz := public.kst_today_start();
  v_referral_bonus int;
  v_action_bonus int;
  v_used int;
begin
  select least(p_bonus_max, count(*))::int into v_referral_bonus
  from public.gacha_referral_clicks
  where inviter_id = p_user_id
    and clicked_at >= v_day_start;

  select least(p_action_bonus_max, count(*))::int into v_action_bonus
  from public.gacha_bonus_events
  where user_id = p_user_id
    and created_at >= v_day_start;

  select count(*)::int into v_used
  from public.gacha_roll_results
  where user_id = p_user_id
    and roll_type = 'free_daily'
    and rolled_at >= v_day_start;

  return query select
    p_base,
    v_referral_bonus + v_action_bonus,
    v_used,
    greatest(0, p_base + v_referral_bonus + v_action_bonus - v_used);
end;
$$;

create function public.consume_daily_roll(
  p_user_id uuid,
  p_product_id uuid,
  p_variant_id uuid,
  p_base int,
  p_bonus_max int,
  p_action_bonus_max int
)
returns table(roll_id uuid, base int, bonus int, used_after int, remaining_after int)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_day_start timestamptz := public.kst_today_start();
  v_referral_bonus int;
  v_action_bonus int;
  v_bonus int;
  v_used int;
  v_roll uuid;
begin
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  select least(p_bonus_max, count(*))::int into v_referral_bonus
  from public.gacha_referral_clicks
  where inviter_id = p_user_id
    and clicked_at >= v_day_start;

  select least(p_action_bonus_max, count(*))::int into v_action_bonus
  from public.gacha_bonus_events
  where user_id = p_user_id
    and created_at >= v_day_start;

  v_bonus := v_referral_bonus + v_action_bonus;

  select count(*)::int into v_used
  from public.gacha_roll_results
  where user_id = p_user_id
    and roll_type = 'free_daily'
    and rolled_at >= v_day_start;

  if v_used >= p_base + v_bonus then
    return query select null::uuid, p_base, v_bonus, v_used, 0;
    return;
  end if;

  insert into public.gacha_roll_results (user_id, product_id, variant_id, roll_type)
  values (p_user_id, p_product_id, p_variant_id, 'free_daily')
  returning id into v_roll;

  v_used := v_used + 1;

  return query select
    v_roll,
    p_base,
    v_bonus,
    v_used,
    greatest(0, p_base + v_bonus - v_used);
end;
$$;

revoke all on function public.get_daily_roll_quota(uuid, int, int, int) from public, anon, authenticated;
revoke all on function public.consume_daily_roll(uuid, uuid, uuid, int, int, int) from public, anon, authenticated;

grant execute on function public.get_daily_roll_quota(uuid, int, int, int) to service_role;
grant execute on function public.consume_daily_roll(uuid, uuid, uuid, int, int, int) to service_role;
