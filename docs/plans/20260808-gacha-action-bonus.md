# 리뷰/제보/가챠제보 완료 시 가챠 기회 보너스 지급

## Request

사용자가 리뷰 작성, 샵 제보, 가챠 상품 제보를 하면 가챠 뽑기 기회를 추가로 준다.
단 세 액션을 합쳐서 **하루 최대 3회**까지만 보너스 인정한다 (사용자 명시 확정, 액션별 개별 3회 아님).

## Scope

- 아래 5개 제출 경로 성공 시 가챠 보너스 이벤트 1건 적립 (source_type 3종, 세 종류 합산 하루 3회 cap):
  - `review` — 리뷰 작성
  - `shop_report` — 일반 샵 제보 + 빠른 제보(가차 있음/없음)
  - `gacha_report` — 가챠 상품 신규 등록 제보 + 기존 상품 매장 등록 제보
- 기존 `get_daily_roll_quota` / `consume_daily_roll` RPC의 보너스 계산에 반영
- 보너스 인정 시점: **제출 즉시** (관리자 승인 대기 없음)
- 하루 리셋 기준: 기존 패턴과 동일하게 KST 0시 (`kst_today_start()`)

## Out of Scope

- 토스트/배지 등 클라이언트 UI 피드백 ("가챠 기회 +1" 안내) — 사용자가 이번 라운드에서 명시적으로 제외, 별도 작업으로 분리
- 리뷰 수정(PUT), 제보 반려/승인 플로우 변경
- 친구 초대 보너스(`REFERRAL_BONUS_MAX`) 로직 변경 — 그대로 유지, 합산만 됨
- 네트워크 재시도로 인한 중복 액션의 보너스 중복 소진 방지 (아래 Risks 참고 — 기존 엔드포인트 자체가 멱등하지 않은 경우가 있어 이번 작업 범위에서 새로 해결하지 않음)

## Relevant Files

- `supabase/migrations/20260806_gacha_referral_rewards.sql` — 참고할 기존 패턴 (`gacha_referral_clicks`, `get_daily_roll_quota`, `consume_daily_roll`, `kst_today_start`)
- `apps/web/src/constants/gacha-roll.ts` — `DAILY_BASE_ROLLS`, `REFERRAL_BONUS_MAX` 상수 소유 파일
- `packages/shared/src/types/index.ts:322-338` — `GachaRollResult.permission.bonus`, `GachaRollQuotaSummary.bonus` 필드 주석 ("친구 초대로 받은 추가분"). 의미가 "초대+액션 합산"으로 바뀌므로 주석 갱신 필요
- RPC 호출부 3곳 (전부 파라미터 추가 필요):
  - `apps/web/src/app/api/gacha-products/[id]/roll/route.ts:86-94` (`consume_daily_roll`)
  - `apps/web/src/app/api/gacha/quota/route.ts:20` (`get_daily_roll_quota`)
  - `apps/web/src/app/api/gacha-products/[id]/roll-status/route.ts:52` (`get_daily_roll_quota`)
- 보너스 적립 지점 5곳:
  - `apps/web/src/app/api/shops/[id]/reviews/route.ts:277-357` — 리뷰 insert 성공 후. `reviewId`는 클라이언트 제공 UUID라 재시도 시 안정적(이미 `:159` 부근에서 기존 리뷰면 조기 return하므로 이 지점까지 재시도로 두 번 안 옴)
  - `apps/web/src/app/api/reports/route.ts:228-260` — 일반 샵 제보. 비로그인 가능(`user?.id` null 체크 필요). **`data.id`는 매 요청 새로 생성돼 재시도 시 불안정**
  - `apps/web/src/app/api/shops/[id]/quick-report/route.ts:93-107` — 빠른 제보(가차 있음/없음). 로그인 필수. `(shop_id, user_id, kind, week_start)` 유니크라 주간 1회 제약 있음 — insert 성공 시 `.select("id")` 추가해서 row id 확보 필요(현재는 `error`만 확인하고 id를 안 가져옴)
  - `apps/web/src/app/api/gacha-observations/route.ts:41-57` — 가챠 상품 신규(직접입력) 제보. 로그인 필수. `product.id`는 매 요청 새 `gacha_products` row라 **재시도 시 불안정**(제품 자체가 매번 새로 생성되는 기존 동작이라 이번 작업 범위 밖)
  - `apps/web/src/app/api/shops/[id]/gacha-products/route.ts:202-246` — 가챠 상품 기존 항목 매장 등록 제보. 로그인 필수. **SELECT→UPDATE or INSERT 방식이라 `record.id`가 (shop_id, gacha_product_id, reported_by, source) 조합에 대해 안정적** — 재시도 안전
- 클라이언트 호출부 (제출 경로 파악용, 코드 변경 없음):
  - `apps/mobile/app/gacha-report.tsx:177-215` — 가챠 상품 제보 두 갈래(신규 입력 vs 기존 상품 선택)가 서로 다른 API를 호출한다는 근거
- 테스트 (RPC 인자 검증 보강 필요):
  - `apps/web/src/app/api/gacha-products/[id]/roll/__tests__/route.test.ts:136-140` — `expect.objectContaining`이라 새 파라미터 누락을 못 잡음
  - `apps/web/src/app/api/gacha-products/[id]/roll-status/__tests__/route.test.ts:54` — RPC 인자 검증 자체가 없음

## Plan

### 1. 마이그레이션: `supabase/migrations/20260808_gacha_action_bonus.sql`

```sql
create table if not exists public.gacha_bonus_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null check (source_type in ('review','shop_report','gacha_report')),
  source_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, source_type, source_id)
);

create index if not exists gacha_bonus_events_user_created_idx
  on public.gacha_bonus_events (user_id, created_at);

alter table public.gacha_bonus_events enable row level security;

create policy "users can read own bonus events"
  on public.gacha_bonus_events for select
  using (auth.uid() = user_id);
-- insert 정책 없음 = service_role만 삽입 가능 (기존 gacha_referral_clicks와 동일 패턴)
```

**RPC 교체 — 반드시 `DROP FUNCTION` 후 `CREATE FUNCTION` (blocker, codex 지적).**
PostgreSQL은 파라미터 개수가 바뀌면 `CREATE OR REPLACE`가 기존 함수를 대체하지 않고 별도 오버로드로 남긴다.
`p_action_bonus_max`를 추가하면 기존 3-arg / 5-arg 함수가 그대로 남아 죽은 코드 + 권한 관리 이중화가 생긴다.
같은 마이그레이션 트랜잭션 안에서 명시적으로 드롭한다:

```sql
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

-- consume_daily_roll도 동일하게 v_action_bonus 계산을 추가하고
-- v_bonus := v_referral_bonus + v_action_bonus 로 바꿔서 재작성 (advisory lock 등 나머지 로직은 기존 그대로)

revoke all on function public.get_daily_roll_quota(uuid, int, int, int) from public, anon, authenticated;
revoke all on function public.consume_daily_roll(uuid, uuid, uuid, int, int, int) from public, anon, authenticated;
grant execute on function public.get_daily_roll_quota(uuid, int, int, int) to service_role;
grant execute on function public.consume_daily_roll(uuid, uuid, uuid, int, int, int) to service_role;
```

리턴 컬럼 구조는 안 바뀐다 — `bonus` 필드가 "초대+액션 합산값"이 될 뿐이라 route.ts 응답 파싱 코드는 그대로 둔다.

**배포 순서상 주의**: 이 프로젝트는 "dev 마이그레이션 → 확인 → prod 마이그레이션 → main 머지(앱 배포)" 순서를 쓴다. prod DB에 마이그레이션이 먼저 들어가고 앱 배포가 뒤따르는 구조라, 마이그레이션 적용 시점과 앱 배포 시점 사이에 구버전 API 코드가 옛 3-arg 시그니처로 RPC를 호출하는 짧은 창이 생긴다 — 이 창에서는 `DROP` 때문에 함수를 못 찾아 500 에러가 난다. 기존 `20260806` 마이그레이션도 같은 배포 순서를 썼으므로 새로운 리스크는 아니지만, 이 창을 최소화하기 위해 **prod 마이그레이션 적용 직후 바로 이어서 앱 배포(merge)를 진행**한다.

### 2. 상수 추가

`apps/web/src/constants/gacha-roll.ts`:

```ts
// 리뷰/제보/가챠제보 완료 시 하루에 받을 수 있는 최대 보너스 횟수. 세 액션 합산.
export const ACTION_BONUS_MAX = 3;
```

### 3. RPC 호출부 3곳에 파라미터 전달

`get_daily_roll_quota` / `consume_daily_roll`을 호출하는 아래 3개 라우트 모두에 `p_action_bonus_max: ACTION_BONUS_MAX` 추가 (import에 `ACTION_BONUS_MAX` 포함). 하나라도 빠지면 그 경로만 액션 보너스가 반영 안 된 값을 반환하므로 구현 후 diff로 3곳 전부 확인:

- `apps/web/src/app/api/gacha-products/[id]/roll/route.ts:86-94`
- `apps/web/src/app/api/gacha/quota/route.ts:20`
- `apps/web/src/app/api/gacha-products/[id]/roll-status/route.ts:52`

### 4. 공통 헬퍼

`apps/web/src/lib/gacha/bonus.ts` (badge award가 `checkAndAwardBadge`로 분리된 것과 같은 패턴):

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

export async function grantGachaBonusEvent(
  adminClient: SupabaseClient,
  userId: string,
  sourceType: "review" | "shop_report" | "gacha_report",
  sourceId: string,
): Promise<void> {
  const { error } = await adminClient
    .from("gacha_bonus_events")
    .insert({ user_id: userId, source_type: sourceType, source_id: sourceId });

  // 23505 = unique 충돌(같은 액션 재제출) → 정상, 조용히 무시.
  // 그 외 에러는 원본 액션(리뷰/제보) 응답을 막지 않되 로그는 남긴다.
  if (error && error.code !== "23505") {
    console.error("[grantGachaBonusEvent] failed", {
      sourceType,
      sourceId,
      error,
    });
  }
}
```

supabase-js는 insert 실패 시 throw가 아니라 `{ error }`를 반환하므로 try/catch가 아니라 반환값을 직접 확인한다 (기존 `reports/route.ts:246`, `quick-report/route.ts:102` 패턴과 동일).

### 5. 5개 지점에 적립 호출 삽입 (non-blocking, 각 라우트 성공 응답 구성 전에 `await` — 배지 지급과 동일 위치)

- `reviews/route.ts` — 배지 지급 블록(`:337-357`) 옆에서 `grantGachaBonusEvent(adminClient, user.id, "review", reviewId)`
- `reports/route.ts` — insert 성공(`:246` 이후) 하고 **`user?.id`가 존재할 때만** `grantGachaBonusEvent(adminClient, user.id, "shop_report", data.id)`. 비로그인 제보는 스킵
- `shops/[id]/quick-report/route.ts` — insert 성공 후(`:107` 이후), insert 호출에 `.select("id").single()` 추가해서 row id 확보 → `grantGachaBonusEvent(supabase, user.id, "shop_report", quickReport.id)`
- `gacha-observations/route.ts` — product insert 성공 후 `grantGachaBonusEvent(supabase, user.id, "gacha_report", product.id)`
- `shops/[id]/gacha-products/route.ts` — `record`가 확정된 후(update/insert 분기 둘 다) `grantGachaBonusEvent(supabase, user.id, "gacha_report", record.id)`

### 6. 공유 타입 주석 갱신

`packages/shared/src/types/index.ts:325` 주석을 "친구 초대로 받은 추가분" → "친구 초대 + 리뷰/제보/가챠제보 보너스 합산"으로 수정.

### 7. 테스트

- `roll/__tests__/route.test.ts:136-140` — `objectContaining`을 `p_action_bonus_max: ACTION_BONUS_MAX`를 포함한 정확한 매치로 강화 (또는 최소 해당 키 존재 검증 추가)
- `roll-status/__tests__/route.test.ts` — RPC 호출 인자에 `p_action_bonus_max` 포함되는지 검증 추가 (기존에 인자 검증 자체가 없었음)
- 신규: `grantGachaBonusEvent` 단위 테스트 — 정상 삽입 / 23505 무시 / 기타 에러 시 throw 안 함
- 신규 또는 기존 라우트 테스트 확장: 리뷰·제보·가챠제보 라우트에서 성공 시 `gacha_bonus_events` insert가 호출되는지, 비로그인 제보 시 호출 안 되는지

### 8. 배포 순서 (프로젝트 규칙)

1. dev 프로젝트에 마이그레이션 적용 (`mcp__supabase__apply_migration`, 메인 세션에서)
2. dev에서 리뷰/제보/빠른제보/가챠제보(신규)/가챠제보(기존상품) 5개 경로 각 1회 이상 호출 → `gacha_bonus_events` 적재 확인, 가챠 뽑기 `remaining_after`에 반영되는지 확인
3. 문제 없으면 prod 마이그레이션 적용 직후 바로 앱 배포(merge)까지 이어서 진행 (창 최소화)
4. `main` 머지 전 prod 적용 완료 필수 (기존 규칙)

## Verification

- 로컬/dev: 같은 유저로 리뷰 1 + 제보 1 + 가챠제보 1 + 리뷰 1(4번째) 제출 → `gacha_bonus_events`에 4행 적재되지만 `get_daily_roll_quota`의 `bonus`는 4번째부터 안 늘어나는지 SQL로 직접 확인
- 비로그인 상태로 샵 제보(`/api/reports`) 제출 → 에러 없이 정상 처리되고 `gacha_bonus_events`에는 안 쌓이는지 확인
- 빠른 제보(가차 있음/없음), 가챠 상품 기존 등록 제보 각각 실제 호출 → `gacha_bonus_events`에 `shop_report`/`gacha_report`로 정확히 쌓이는지 확인
- 기존 친구초대 보너스와 액션 보너스를 같은 날 동시에 쌓았을 때 `bonus = min(20, 초대수) + min(3, 액션수)`로 합산되는지 확인
- `pnpm --filter web build` 또는 `tsc` 통과, 신규/수정 테스트 통과 확인

## Risks / Questions

- **어뷰징**: 즉시 인정이라 스팸성 리뷰/제보로 보너스를 노릴 수 있음. 다만 하루 3회 상한 + 기존 제보 rate-limit(IP당 시간당 5회, `/api/reports`), 빠른 제보의 주 1회 제약이 있어 실효성 낮음. 사용자가 "즉시 인정"을 명시적으로 선택함.
- **재시도 시 보너스 중복 소진 (accepted risk)**: `/api/reports`와 `/api/gacha-observations`(신규 상품)는 매 요청마다 새 row id가 생겨 멱등하지 않다 — 이는 이 두 엔드포인트의 기존 동작(보너스 기능과 무관하게 이미 그랬음)이라, 네트워크 재시도 시 진짜 액션 1건이 하루 3회 보너스 cap을 혼자 다 소진할 수 있다. 하루 총량이 늘어나는 게 아니라 "소진 속도"만 빨라지는 정도라 이번 범위에서 별도 방지 로직(디바운스 등)을 추가하지 않는다. 문제가 실제로 보고되면 후속 작업으로 처리.
- **RPC DROP/CREATE 배포 창**: 위 "배포 순서상 주의" 참고 — prod 마이그레이션 적용과 앱 배포 사이 짧은 창에서 구버전 API가 500을 받을 수 있음. 기존 프로젝트 배포 순서(DB 먼저)의 고유 특성이라 이번 작업에서 새로 생긴 문제는 아니지만, 두 단계를 붙여서 진행해 창을 최소화한다.
- **모바일 앱 구버전 호환**: 응답 스키마 자체(필드 구조)는 안 바뀌고 `bonus` 필드의 의미만 확장되므로, 기존 `20260806-gacha-daily-roll-quota.md`의 "구버전 앱이 409를 삼킨다" 이슈와는 무관 — 신규 게이팅 불필요.

## Adversarial Review

codex(mcp**codex**codex, read-only)로 1차 검토 진행. 지적 사항과 검증 결과:

| #   | 심각도  | 지적                                                                                                               | 검증                                                              | 반영                                                                                                         |
| --- | ------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 1   | blocker | `CREATE OR REPLACE`로 파라미터 추가 시 기존 함수가 안 지워지고 새 오버로드가 생김                                  | Postgres 함수 identity는 arg 타입 목록 기준 — 사실 확인           | `DROP FUNCTION IF EXISTS` 후 `CREATE FUNCTION`으로 변경, 배포 창 리스크 명시                                 |
| 2   | major   | 가챠 상품 제보의 "기존 상품 선택" 경로(`/api/shops/[id]/gacha-products`)가 계획에 없음                             | `gacha-report.tsx:204`에서 실제로 이 API를 호출하는 것 확인       | 5번째 적립 지점으로 추가                                                                                     |
| 3   | major   | 샵 제보 중 `quick-report`(가차 있음/없음) 누락                                                                     | `quick-report/route.ts` 확인 — 로그인 필수, 실제 제보 플로우 맞음 | 적립 지점으로 추가, `.select("id")` 필요 명시                                                                |
| 4   | major   | `unique(user_id, source_type, source_id)` 멱등성이 `/api/reports`, `/api/gacha-observations`엔 안 통함(매번 새 id) | 두 라우트 코드 확인 — 사실                                        | Risks에 accepted risk로 명시, 범위 밖 선언. `shops/[id]/gacha-products`는 반대로 upsert라 안전함도 확인·기재 |
| 5   | major   | 헬퍼의 try/catch가 supabase-js의 `{error}` 반환 패턴과 안 맞음                                                     | 기존 라우트들이 `if (error)`로 직접 체크하는 것 확인              | 헬퍼를 `{error}` 체크 방식으로 재작성, 23505만 무시                                                          |
| 6   | major   | 테스트가 `objectContaining`이라 새 파라미터 누락을 못 잡음                                                         | 실제 테스트 파일 확인 — 사실                                      | Verification/Plan에 테스트 보강 항목 추가                                                                    |
| 7   | minor   | 공유 타입 주석("친구 초대로 받은 추가분")이 갱신 안 됨                                                             | `packages/shared/src/types/index.ts:325` 확인                     | 갱신 항목 추가                                                                                               |
| 8   | minor   | SQL 스니펫이 의사코드 수준이라 그대로 못 씀                                                                        | 맞음                                                              | 기존 `consume_daily_roll` 스타일 그대로 정확한 SQL로 재작성                                                  |

## Final Plan

위 표의 반영 사항을 모두 본문(Scope/Relevant Files/Plan/Risks)에 통합 완료. 구현 담당(backend-agent 또는 메인 세션)은 이 문서의 "Plan" 섹션 1~8번을 순서대로 따르면 된다. 마이그레이션 적용(`mcp__supabase__apply_migration`)은 메인 세션에서만 수행.
