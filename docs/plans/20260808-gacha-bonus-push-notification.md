# 가챠 액션 보너스 획득 시 푸시 알림 + 보너스 상한 3→5 상향

## Request

리뷰/제보/가챠제보로 가챠 뽑기 기회가 추가됐을 때 사용자에게 푸시 알림을 보낸다.
겸사겸사 하루 액션 보너스 상한을 3회에서 5회로 올린다.

## Scope

- `ACTION_BONUS_MAX`를 3 → 5로 변경 (완료, 이 문서 작성 시점 기준 이미 반영됨:
  `apps/web/src/constants/gacha-roll.ts`, tsc/vitest 그린 확인함)
- `grantGachaBonusEvent`(`apps/web/src/lib/gacha/bonus.ts`)가 이벤트를 실제로
  적립했을 때(= 오늘 그 사용자의 액션 보너스가 상한 이내라 뽑기 기회가 실제로
  늘었을 때) 푸시 알림 1건 발송
- 새 알림 카테고리 `gacha_bonus` 추가 (기존 `badge`/`report_result`와 동일한
  단일 사용자 알림 패턴 — `enqueueNotification` 사용)
- 알림 설정 화면(`notification-settings.tsx`)에 토글 추가
- 알림 탭 시 홈(`/(tabs)`)으로 이동
- 대상: **`review`/`shop_report`/`gacha_report` 액션 보너스만.** 친구 초대
  클릭(`gacha_referral_clicks`)은 하루 최대 20회까지 쌓일 수 있어 이벤트마다
  푸시를 보내면 스팸이 되므로 **명시적으로 범위 밖** (이전 턴에서 사용자에게
  제안하고 동의받음)

## Out of Scope

- 친구 초대 클릭 보너스 푸시 (스팸 리스크로 제외, 위 참고)
- 알림 배치/요약(하루 1회 다이제스트) — 하루 최대 5회로 볼륨이 낮아 즉시 발송으로
  충분하다고 판단, 배치 인프라를 새로 만들 이유 없음
- 기존 단일 사용자 알림 카테고리(`report_result`/`shop_owner_activity`/`badge`/
  `shop_owner_update`)가 `notification_preferences` 토글을 실제로 강제하지
  않는 기존 버그성 갭 수정 (아래 Risks 참고, 이번 작업과 무관하게 이미 존재)
- `notifications/preferences` PATCH의 `validKeys`에 `product_wishlist_restock`이
  빠져있는 기존 이슈 수정 (무관, 발견만 기록)

## Relevant Files

- `apps/web/src/lib/gacha/bonus.ts` — 푸시 발송 지점. 현재 `{error}`만 확인하고
  return; 여기에 "오늘 몇 번째 적립인지" 판단 로직과 `enqueueNotification` 호출 추가
- `apps/web/src/lib/notifications/sendPush.ts` — `enqueueNotification(supabase, userId, category, title, body, data)`.
  `PushNotificationData.type` 유니온에 `"gacha_bonus"` 추가 필요
- `apps/web/src/lib/badges/earn.ts:71-84` — 참고할 기존 패턴 (단일 사용자 알림,
  try/catch로 실패 무시)
- `apps/web/src/app/api/gacha-products/[id]/roll/_utils.ts:21-24` — `todayKSTMidnight()`.
  DB `kst_today_start()`와 동일한 KST 자정 계산. bonus.ts에서 재사용
- `supabase/migrations/20260616_push_notifications.sql` — `pending_notifications.category`
  CHECK, `notification_preferences` 테이블, `enqueue_notification` RPC 원본
- `supabase/migrations/20260617_wishlist_product_update_notification.sql`,
  `20260624_product_wishlists.sql` — 카테고리 추가할 때의 마이그레이션 패턴
  (컬럼 추가는 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, CHECK는
  `DROP CONSTRAINT` 후 `ADD CONSTRAINT`로 전체 목록 재작성)
- `apps/web/src/app/api/notifications/preferences/route.ts` — GET 기본값 객체,
  PATCH `validKeys` 배열에 `gacha_bonus` 추가
- `apps/mobile/app/notification-settings.tsx` — `NotificationPreferences` 인터페이스,
  `CATEGORIES` 배열에 항목 추가
- `apps/mobile/app/_layout.tsx:39-69` — `PushNotificationData.type` 유니온,
  `routeFromNotification` switch에 `case "gacha_bonus"` 추가
- i18n 4개 파일(`apps/mobile/messages/{ko,en,ja,zh}.json`) — `notificationSettings.gachaBonus`/
  `gachaBonusDesc` 키 (기존 `badge`/`badgeDesc` 옆에 추가)

## Plan

### 1. 마이그레이션: `supabase/migrations/20260808_gacha_bonus_push.sql`

```sql
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

-- 삽입 + "오늘 상한 이내인지" 판단 + preference 확인을 한 트랜잭션에서 원자적으로
-- 처리한다. TS에서 별도 COUNT 쿼리를 하면 (a) 동시 액션 race로 false negative가
-- 나거나 (b) TS의 KST 자정 계산이 DB의 kst_today_start()와 미세하게 어긋날 수
-- 있어(codex 리뷰 major 지적) DB 함수 하나로 합친다. consume_daily_roll과 동일하게
-- advisory lock으로 사용자별 직렬화한다 (락 키는 다르게 둬서 롤 소비 로직과
-- 불필요하게 얽히지 않게 한다).
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
```

정확한 카테고리 전체 목록은 구현 시점에 `pending_notifications_category_check`
현재 정의를 다시 확인하고 그대로 옮긴다 (위 목록은 지금까지 확인한 마이그레이션
히스토리 기준 추정치 — 순서대로 적용됐는지 dev DB에서 `\d pending_notifications`로
재확인 필요). `gacha_bonus_events`엔 이미 `unique (user_id, source_type, source_id)`가
있으므로 `on conflict (user_id, source_type, source_id) do nothing`이 그대로 먹는다.

### 2. `bonus.ts`를 RPC 호출로 교체 + 푸시

기존의 `.from("gacha_bonus_events").insert(...)` 직접 호출을 걷어내고
`grant_gacha_bonus_event` RPC 호출로 바꾼다. TS 쪽에서 KST 계산/카운트를
다시 하지 않으므로 `apps/web/src/app/api/gacha-products/[id]/roll/_utils`를
`lib/`에서 import하는 방향성 나쁜 의존(codex 리뷰 major 지적)도 자연히 없어진다.

```ts
import { ACTION_BONUS_MAX } from "@/constants/gacha-roll";
import { enqueueNotification } from "@/lib/notifications/sendPush";

export async function grantGachaBonusEvent(
  adminClient: SupabaseClient,
  userId: string,
  sourceType: "review" | "shop_report" | "gacha_report",
  sourceId: string,
): Promise<void> {
  const { data: shouldNotify, error } = await adminClient.rpc(
    "grant_gacha_bonus_event",
    {
      p_user_id: userId,
      p_source_type: sourceType,
      p_source_id: sourceId,
      p_action_bonus_max: ACTION_BONUS_MAX,
    },
  );

  if (error) {
    console.error("[grantGachaBonusEvent] failed", {
      sourceType,
      sourceId,
      error,
    });
    return;
  }

  if (!shouldNotify) return;

  try {
    await enqueueNotification(
      adminClient,
      userId,
      "gacha_bonus",
      "가챠 뽑기 기회 +1",
      "리뷰/제보로 오늘 가챠 뽑기 기회가 늘었어요!",
      { type: "gacha_bonus" },
    );
  } catch {
    // notification failure must not affect the caller's response
  }
}
```

- RPC가 `false`를 돌려주는 경우: 중복 제출 / 오늘 상한 초과 / 알림 설정 꺼짐 —
  세 경우 다 푸시 없음. 셋을 구분해서 다르게 처리할 필요는 없다 (호출부 응답에
  영향 없는 non-blocking 사이드 이펙트이므로)
- 23505 특수 처리는 더 이상 필요 없다 — `on conflict do nothing`이 DB에서
  처리하고 RPC는 항상 `{data, error}` 형태로 정상 반환한다
- advisory lock으로 동일 유저의 동시 액션이 직렬화되므로 codex가 지적한
  race(두 액션이 동시에 들어와 서로 다른 count를 봐야 하는데 둘 다 초과로
  세는 문제)는 사라진다

### 3. `sendPush.ts` 타입 확장

`enqueueNotification`의 `category` 파라미터 유니온과 `PushNotificationData.type`
유니온 **둘 다**에 `"gacha_bonus"` 추가 (codex 지적: 계획 초안은 `PushNotificationData.type`만
언급했는데 실제로 `enqueueNotification` 자체의 `category` 인자 타입도 막혀 있어
그것부터 안 고치면 `bonus.ts`가 컴파일 안 됨).

### 4. `notifications/preferences/route.ts`

- `PreferencesRow`에 `gacha_bonus: boolean` (필수 — DB 컬럼이 `not null default true`이므로
  optional로 두면 안 됨, codex 지적), `PatchBody`에 `gacha_bonus?: boolean` (patch는 partial이라
  optional 맞음)
- GET의 기본값 객체에 `gacha_bonus: true` 추가
- PATCH `validKeys`에 `"gacha_bonus"` 추가
- (참고, 이번 범위 밖: 같은 배열에 기존부터 `product_wishlist_restock`이 빠져있는
  버그가 있음 — 손대지 않는다)

### 5. 모바일 알림 설정 화면

`notification-settings.tsx`:

- `NotificationPreferences` 인터페이스에 `gacha_bonus: boolean` 추가
- `CATEGORIES` 배열에 `{ key: "gacha_bonus", labelKey: "notificationSettings.gachaBonus", descKey: "notificationSettings.gachaBonusDesc" }` 추가

### 6. 알림 탭 라우팅

`_layout.tsx`:

- `PushNotificationData.type` 유니온에 `"gacha_bonus"` 추가
- `routeFromNotification`에 `case "gacha_bonus": router.push("/(tabs)" as never); break;` 추가

### 7. i18n (ko/en/ja/zh 4개 파일)

`notificationSettings` 섹션에 추가:

- `gachaBonus`: "가챠 보너스" / "Gacha Bonus" / "ガチャボーナス" / "扭蛋奖励"
- `gachaBonusDesc`: "리뷰/제보로 뽑기 기회가 늘어나면 알려드려요" (언어별 번역)

(참고: 이전 세션 산출물에서 `ja.json`/`zh.json`엔 `quick` 섹션이 원래 없는 등
일부 섹션 통일이 안 된 상태였음 — `notificationSettings` 섹션 자체는 4개 파일에
모두 있는지 구현 전 확인)

### 8. 테스트

- `bonus.test.ts` — RPC 호출 방식으로 바뀌었으므로 기존 3개 케이스(정상 삽입/23505/기타에러)를
  `adminClient.rpc("grant_gacha_bonus_event", ...)` mock 기준으로 다시 쓴다. 신규:
  - RPC가 `{ data: true, error: null }` → `enqueueNotification` 호출됨, 인자(category="gacha_bonus" 등) 검증
  - RPC가 `{ data: false, error: null }` (상한 초과/중복/설정 꺼짐 — 세 경우 다 이 케이스 하나로 커버) → `enqueueNotification` 호출 안 됨
  - RPC가 `{ data: null, error: {...} }` → `enqueueNotification` 호출 안 됨, throw 안 함
- `notifications/preferences/__tests__/route.test.ts` — 현재 파일 자체가 없음(codex 확인) →
  신규 작성. GET 기본값에 `gacha_bonus: true` 포함, PATCH로 `gacha_bonus` 갱신되는지
- 5개 라우트(reviews/reports/quick-report/gacha-observations/gacha-products) 테스트는
  `grantGachaBonusEvent`를 직접 mock하지 않고 있어 내부 로직 변경이 그 테스트들에서
  드러나지 않는다(non-blocking try/catch로 삼켜짐) — codex도 지적한 부분이지만, 배지
  적립 로직도 동일하게 라우트 테스트에서 mock 안 하는 게 기존 관례라 이번에 5곳
  전부 새로 mock을 얹지는 않는다. 대신 `bonus.test.ts`의 RPC 인자 검증을 촘촘히 해서
  로직 커버리지를 거기서 확보한다

### 9. 배포 순서 (프로젝트 규칙)

1. dev 마이그레이션 적용 (`mcp__supabase__apply_migration`, 메인 세션)
2. dev에서 리뷰/제보 1건 제출 → 푸시 수신 확인, 6번째 액션은 푸시 안 오는지 확인
3. prod 마이그레이션 적용
4. `main` 머지 (앱 배포) — 이번 변경은 API 응답 스키마를 안 건드리므로 구버전
   앱과 호환 문제 없음 (신규 푸시 카테고리가 추가될 뿐)

## Verification

- 같은 유저로 리뷰 1 + 제보 1 + 빠른제보 1 + 리뷰 1 + 제보 1(5번째) 제출 →
  매번 푸시 옴, `remaining_after`도 매번 +1
- 6번째 액션(가챠제보) 제출 → `gacha_bonus_events`엔 행이 쌓이지만 푸시 안 오고
  `remaining_after`도 안 늘어남
- 비로그인 샵 제보(`/api/reports`) → `grantGachaBonusEvent` 자체가 호출 안 되므로
  (기존 로직) 푸시도 없음 — 회귀 없는지 확인
- 알림 설정에서 "가챠 보너스" 토글 끄기 → (Out of Scope에 적었듯 현재 인프라는
  단일 사용자 카테고리의 토글을 강제하지 않으므로) 꺼도 푸시가 계속 갈 수 있음.
  이건 기존 배지/제보 알림도 동일한 상태라 이번 작업에서 새로 생기는 회귀는
  아니지만, **사용자에게 이 사실을 알리고 이번에 같이 고칠지 확인 필요**
  (Risks 참고)
- `pnpm --filter web tsc`, 관련 vitest 통과

## Risks / Questions

- **`gacha_bonus`만 preference를 실제로 강제함**: 기존 4개 단일 사용자 카테고리
  (`badge`/`report_result`/`shop_owner_activity`/`shop_owner_update`)는 여전히
  토글이 UI만 있고 발송을 안 막는 기존 갭이 그대로 남는다. `gacha_bonus`는
  새로 만드는 RPC(`grant_gacha_bonus_event`) 안에서 `notification_preferences.gacha_bonus`를
  직접 확인하므로 이 카테고리 하나만 토글이 실제로 먹는다 — 카테고리마다 강제
  여부가 다른 비일관 상태가 되지만, 기존 `enqueue_notification` RPC(다른 4개
  카테고리가 공유)를 건드리면 그 카테고리들의 기존 동작을 의도치 않게 바꾸는
  더 큰 리스크가 생기므로 이번 범위에서는 손대지 않는다. 기존 4개 카테고리의
  갭을 통일해서 고칠지는 별도 작업으로 판단 필요
- **마이그레이션 카테고리 목록**: Plan 1번의 CHECK 목록은 마이그레이션 히스토리
  기준 추정치라 구현 직전 dev DB에서 `\d pending_notifications`로 실제 제약조건
  재확인 필요 (codex도 히스토리 순서 자체는 맞다고 확인함)
- **advisory lock 키 선택**: `hashtext(p_user_id::text || ':gacha_bonus_grant')`로
  `consume_daily_roll`의 락 키(`hashtext(p_user_id::text)`)와 다르게 둬서 두 RPC가
  서로 불필요하게 블로킹하지 않게 했다 — 구현 시 실제로 두 RPC가 자주 같은
  트랜잭션 흐름 안에서 겹쳐 호출되는지 다시 확인

## Adversarial Review

codex(mcp**codex**codex, read-only)로 1차 검토 진행. 지적 사항과 검증 결과:

| #   | 심각도           | 지적                                                                                                                                                       | 검증                                                            | 반영                                                                                                                                                          |
| --- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | blocker          | `enqueueNotification`의 `category` 파라미터 유니온 자체에 `"gacha_bonus"`가 없어 계획 코드가 컴파일 안 됨 (계획 초안은 `PushNotificationData.type`만 언급) | `sendPush.ts`의 `enqueueNotification` 시그니처 확인 — 사실      | Plan 3번에 `enqueueNotification`의 category 유니온도 함께 수정한다고 명시                                                                                     |
| 2   | major            | TS COUNT 쿼리 방식은 동시 액션에서 false negative 가능 (둘 다 "6번째"로 카운트해 둘 다 푸시 안 감)                                                         | 순차 실행에선 동치이나 동시 요청은 다르다는 지적이 맞음         | insert+count+preference 확인을 `grant_gacha_bonus_event` DB 함수 하나로 합치고 `consume_daily_roll`과 같은 advisory lock 패턴으로 직렬화 (Plan 1, 2번 재작성) |
| 3   | major            | TS `todayKSTMidnight()`와 DB `kst_today_start()`가 별도 구현이라 clock skew 시 어긋날 수 있음                                                              | 사실 — 두 곳에 KST 자정 로직이 중복                             | 위와 같은 해결로 TS 쪽 KST 계산 자체를 제거, DB `kst_today_start()`만 사용                                                                                    |
| 4   | blocker/decision | 토글을 화면에 노출하면서 실제로 강제 안 하면 사용자에게 거짓 기능                                                                                          | 맞는 지적                                                       | `gacha_bonus`는 새 RPC 안에서 preference를 직접 확인하도록 결정 (기존 4개 카테고리는 범위 밖 유지 — Risks에 비일관성 명시)                                    |
| 5   | major            | `lib/gacha/bonus.ts`가 `app/api/.../[id]/roll/_utils`를 import하는 건 선례 없는 역방향 의존                                                                | 맞는 지적                                                       | RPC로 옮기면서 이 import 자체가 필요 없어짐 (자연 해소)                                                                                                       |
| 6   | major            | 테스트 계획 부족 — `bonus.test.ts`가 count 체인/enqueue mock을 안 다루고, preferences route 테스트가 아예 없음("있다면"이 아니라 신규 필요)                | `notifications/preferences/__tests__` 디렉토리 자체가 없음 확인 | Plan 8번에 RPC mock 기준 테스트 재설계 + preferences route 테스트 신규 작성으로 반영                                                                          |
| 7   | minor            | `PreferencesRow.gacha_bonus`는 optional이 아니라 required여야 함                                                                                           | `PreferencesRow`는 DB row 전체를 나타내므로 맞는 지적           | Plan 4번 수정                                                                                                                                                 |
| 8   | minor            | 마이그레이션 카테고리 목록 추정 자체는 히스토리 기준 맞음                                                                                                  | 확인됨                                                          | 그대로 유지, dev DB 재확인 문구도 유지                                                                                                                        |
| 9   | minor            | 친구 초대 클릭 push 제외, 배치 알림 미도입 판단은 합리적                                                                                                   | 확인됨                                                          | 변경 없음                                                                                                                                                     |

## Final Plan

위 표의 반영 사항을 모두 본문(Plan/Risks)에 통합 완료. 원래 초안의 "TS에서
COUNT 쿼리" 방식을 "DB 함수 하나(`grant_gacha_bonus_event`)로 삽입+판단+preference
확인을 원자적으로 처리"하는 방식으로 교체한 것이 이번 라운드의 핵심 변경이다.
구현 순서:

1. 마이그레이션 작성 및 dev 적용 (Plan 1번)
2. `sendPush.ts` category 유니온 확장 (Plan 3번)
3. `bonus.ts`를 RPC 호출로 재작성 (Plan 2번)
4. `notifications/preferences/route.ts` 수정 (Plan 4번)
5. 모바일: 설정 화면, 알림 탭 라우팅, i18n 4개 파일 (Plan 5·6·7번)
6. 테스트: `bonus.test.ts` 재작성, `preferences/__tests__` 신규 (Plan 8번)
7. `pnpm --filter web tsc` + 관련 vitest 전체 통과 확인
8. dev 배포 후 Verification 섹션 항목 확인 → prod 마이그레이션 → `main` 머지 시점에 앱 배포 상태 확인 (Plan 9번)
