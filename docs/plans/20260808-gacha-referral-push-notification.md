# 친구 초대 클릭 시 초대자 푸시 알림 + 리뷰/제보 보너스는 토스트 전환

## Request

친구가 내 추천 링크를 열어 내가 가챠 뽑기 기회를 추가로 얻을 때, 초대자에게
푸시 알림이 오게 한다. 동시에 리뷰/제보 액션 보너스는 (이미 앱 안에 있는
상태라 푸시가 불필요하므로) 푸시를 없애고 클라이언트 토스트로만 알린다.

**이 문서는 `20260808-gacha-bonus-push-notification.md`의 "친구 초대 클릭
푸시는 스팸 위험으로 범위 제외" 결정을 뒤집는다.** 대신 스팸 리스크는
`REFERRAL_BONUS_MAX`를 20 → 5로 낮춰 상한 자체를 줄이는 것으로 완화한다
(사용자 확정: 클릭마다 즉시 발송, 최대 5건/일).

## Scope

- `REFERRAL_BONUS_MAX` 20 → 5 (`apps/web/src/constants/gacha-roll.ts`).
  타 파일에 20이 하드코딩된 곳 없음을 확인함 (grep 완료).
- DB: `notification_preferences.gacha_referral_bonus` 컬럼 추가,
  `pending_notifications_category_check`에 `gacha_referral_bonus` 추가.
- DB: 신규 RPC `record_referral_click(p_inviter_id, p_visitor_id, p_variant_id, p_bonus_max)`.
  기존 `grant_gacha_bonus_event`/`consume_daily_roll`과 동일 패턴
  (advisory lock → insert on conflict do nothing → 오늘 카운트 계산 →
  `least(cap, count)` 기준으로 "이번 클릭이 실제로 기회를 늘렸는지" 판단 →
  notification_preferences 확인 → boolean 반환). cap 초과 클릭(6번째부터)은
  행은 쌓이되(집계용) false를 반환해 푸시하지 않는다 — `consume_daily_roll`이
  `least(p_bonus_max, count(*))`로 상한을 적용하는 것과 동일한 의미.
- DB: `grant_gacha_bonus_event` 단순화 — `notification_preferences` 조회/AND
  제거하고 `v_count <= p_action_bonus_max`만 반환. 반환값의 의미가
  "알려야 하는지"에서 "실제로 적립됐는지"로 바뀐다 (푸시가 없어졌으므로).
- `apps/web/src/lib/notifications/sendPush.ts`: `PushNotificationData.type`
  유니온과 `enqueueNotification`의 `category` 유니온에 `"gacha_referral_bonus"`
  추가.
- `apps/web/src/app/api/referral/click/route.ts`: 마지막의 blind insert
  (line 105-112)를 `record_referral_click` RPC 호출로 교체. **insert 문만
  교체하고 봇 UA 필터, IP rate limit, 자기 클릭 방지, 항상 204 반환 같은
  기존 가드는 그대로 둔다.** RPC가 true를 반환하면 `enqueueNotification`
  호출 (제목 "가챠 기회가 생겼어요", 본문 "친구가 링크를 열어서 가챠 뽑기
  기회가 늘었어요", category `gacha_referral_bonus`). 푸시 실패는 try/catch로
  삼켜 클릭 응답(204)에 영향 없게 한다 — `bonus.ts` 기존 패턴과 동일.
- `apps/web/src/lib/gacha/bonus.ts`: `grantGachaBonusEvent` 반환 타입
  `Promise<void>` → `Promise<boolean>`. `enqueueNotification` 호출 제거,
  RPC(`grant_gacha_bonus_event`)가 반환한 "적립 여부"를 그대로 리턴.
- 호출부 5곳 — 각 라우트의 최종 성공 응답에 `gachaBonusGranted: boolean` 필드
  추가:
  - `apps/web/src/app/api/shops/[id]/quick-report/route.ts` (line 137, 171)
  - `apps/web/src/app/api/shops/[id]/gacha-products/route.ts` (line 275, 293)
  - `apps/web/src/app/api/shops/[id]/reviews/route.ts` (line 362, 386)
  - `apps/web/src/app/api/gacha-observations/route.ts` (line 78, 128)
  - `apps/web/src/app/api/reports/route.ts` (line 254, 269)
- 모바일 `apps/mobile/components/ui/WishToast.tsx`: `ToastType`에
  `"bonusGranted"` 추가, `getMessage()`에 케이스 추가, i18n 키
  `gacha.bonusGranted.toastSuccess` 참조.
- 모바일 성공 핸들러 4개 화면에서 응답의 `gachaBonusGranted`를 확인해
  `showToast("bonusGranted")` 호출. **기존 성공 Alert/토스트와 동시에 뜨지
  않게, `gachaBonusGranted`가 true면 기존 Alert 대신 보너스 토스트로
  대체한다** (동시 노출 없음, 하나만 보여준다):
  - `apps/mobile/app/review-form.tsx` (~line 219-230, 현재 `Alert.alert`)
  - `apps/mobile/app/gacha-report.tsx` (~line 179, 204, 188 부근 — 두 제출
    경로 모두 같은 성공 처리로 수렴하는지 확인 후 동일하게 적용)
  - `apps/mobile/app/report.tsx` (성공 처리부, 정확한 라인은 구현 시 확인)
  - `apps/mobile/components/organisms/gacha/GachaSection.tsx` (~line 325,
    quick-report 성공 시 이미 `showToast("quickReport")` 사용 중 —
    `gachaBonusGranted`가 true면 `"bonusGranted"`로 대체, 아니면 기존 유지)
  - 사전 확인 완료: 4개 화면 모두 `WishToastProvider`(root `_layout.tsx:230`
    또는 `shop/[id].tsx:264`) 하위에서 렌더링됨 → `useWishToast()`가 no-op
    기본값으로 떨어지는 문제 없음.
- 모바일 `apps/mobile/app/notification-settings.tsx`: `CATEGORIES`에서
  `gacha_bonus` 항목 제거, `gacha_referral_bonus` 항목 추가
  (`labelKey`/`descKey` 신규).
- i18n 4개 로케일(`ko`/`en`/`ja`/`zh` `messages/*.json`) 추가:
  - `gacha.bonusGranted.toastSuccess` (토스트 문구, 로케일별 번역)
  - `notificationSettings.gachaReferralBonus` / `...Desc` (알림설정 라벨)
  - 기존 `notificationSettings.gachaBonus` / `...Desc` 키는 미사용으로 남김
    (삭제 안 함 — 최소 변경)
- 테스트: `apps/web/src/lib/gacha/__tests__/bonus.test.ts` 반환값 boolean
  검증으로 갱신. `referral/click` 라우트 테스트가 있으면 RPC 호출/푸시 분기
  검증 추가 (없으면 신규 작성 여부는 구현 시 기존 테스트 커버리지 확인 후 판단).

## Out of Scope

- 푸시 본문 다국어화 — 기존 `gacha_bonus` 푸시도 한국어 하드코딩이었음
  (`bonus.ts`). 동일 패턴 유지, 서버 푸시 텍스트는 한국어 고정. 클라이언트
  토스트만 4개 로케일 지원.
- `notification_preferences.gacha_bonus` 컬럼/체크 제약의 옛 값 DDL 삭제 —
  죽은 컬럼으로 남겨둠. 별도 정리 작업으로 미룸.
- 다이제스트/배치 알림 — 사용자가 클릭마다 즉시 발송을 선택함.
- referral_code 발급 로직, 공유 링크 UI, `/r/[variantId]` 랜딩 페이지 변경.
- 기존 `report_result`/`shop_owner_activity`/`badge`/`shop_owner_update`가
  `notification_preferences`를 강제하지 않는 기존 갭 수정 (무관, 발견만
  기록됨 — 이전 계획 문서에도 동일하게 기록되어 있음).

## Relevant Files

- `supabase/migrations/20260806_gacha_referral_rewards.sql` — `gacha_referral_clicks`
  테이블, `consume_daily_roll`(참고 패턴)
- `supabase/migrations/20260808_gacha_bonus_push.sql` — `grant_gacha_bonus_event`
  현재 정의 (단순화 대상), notification_preferences.gacha_bonus 추가했던 마이그레이션
- `supabase/migrations/20260807_realtime_push_trigger.sql` — `pending_notifications`
  AFTER INSERT 트리거, 3초 디바운스 후 `/api/cron/send-notifications` 호출 (신규
  카테고리 추가해도 이 트리거는 그대로 재사용됨, 변경 불필요)
- `apps/web/src/lib/notifications/sendPush.ts` — `enqueueNotification`
- `apps/web/src/lib/gacha/bonus.ts` — `grantGachaBonusEvent`
- `apps/web/src/app/api/referral/click/route.ts`
- `apps/web/src/constants/gacha-roll.ts`
- `apps/mobile/components/ui/WishToast.tsx`
- `apps/mobile/app/_layout.tsx` (line 230), `apps/mobile/app/shop/[id].tsx` (line 264)
- `apps/mobile/app/notification-settings.tsx` (line 36-81, `CATEGORIES`)
- `apps/mobile/app/review-form.tsx`, `apps/mobile/app/gacha-report.tsx`,
  `apps/mobile/app/report.tsx`, `apps/mobile/components/organisms/gacha/GachaSection.tsx`
- `apps/mobile/messages/{ko,en,ja,zh}.json`

## Plan

1. 마이그레이션 작성: `supabase/migrations/20260808_gacha_referral_push.sql`
   - `notification_preferences.gacha_referral_bonus boolean not null default true`
   - `pending_notifications_category_check` 재정의 (기존 값 + `gacha_referral_bonus`)
   - `record_referral_click(p_inviter_id uuid, p_visitor_id uuid, p_variant_id uuid, p_bonus_max int) returns boolean`
   - `grant_gacha_bonus_event` CREATE OR REPLACE로 단순화 (notification_preferences
     조회 제거)
2. dev Supabase 프로젝트에 `apply_migration`으로 적용 → `list_migrations`/직접
   RPC 호출로 동작 확인 (메인 세션에서, MCP 사용)
3. `apps/web/src/constants/gacha-roll.ts`: `REFERRAL_BONUS_MAX = 20` → `5`
4. `sendPush.ts` 타입 유니온 갱신
5. `bonus.ts` 리팩터: 반환 `Promise<boolean>`, `enqueueNotification` 호출 제거
6. `referral/click/route.ts`: RPC 교체 + 성공 시 `enqueueNotification` 호출
7. 5개 호출부 라우트 응답에 `gachaBonusGranted` 필드 추가
8. `cd apps/web && rtk vitest run` — 관련 테스트 그린 확인, `bonus.test.ts` 갱신
9. `apps/mobile/components/ui/WishToast.tsx`에 `"bonusGranted"` 타입 추가
10. 4개 로케일 i18n 키 추가 (토스트 문구, 알림설정 라벨/설명)
11. 모바일 4개 화면 성공 핸들러 수정 (Alert/기존 토스트 → 조건부 보너스 토스트)
12. `apps/mobile/app/notification-settings.tsx` `CATEGORIES` 교체
13. `cd apps/mobile && rtk tsc && rtk lint` 확인
14. dev 환경에서 실제 흐름 검증 (Verification 참고)
15. 사용자 확인 후 prod DB에 마이그레이션 적용 (`main` 머지 전 완료 — DB 배포
    순서 규칙)
16. Penpot 동기화 여부 검토: 신규 토스트는 기존 `WishToast` 컴포넌트 스타일
    재사용(레이아웃 변경 없음), `notification-settings` 토글은 항목 1개
    교체(텍스트 수준)라 "레이아웃 구조·컴포넌트 배치·신규 화면" 변경에
    해당하지 않는다고 판단 — 생략. 구현 중 실제 UI가 이 판단과 달라지면
    재검토.

## Verification

- `apps/web` vitest: `bonus.test.ts` (반환값 boolean, RPC 인자), referral
  click route 테스트(RPC mock 기준)
- dev DB에서 직접 확인:
  1. 테스트 계정 A의 `referral_code`로 `/api/referral/click` 5회 이상 다른
     `visitor_id`로 호출 (curl)
  2. `pending_notifications`에 6번째부터는 행이 없거나 `false` 분기로
     스킵되는지 확인 (cap=5 경계 확인, 요청사항 4번)
  3. A의 Expo 디바이스에 실제 푸시 도착 확인 (사용자 원 요청 목적)
- notification-settings에서 `gacha_referral_bonus` 토글 off 시 푸시 안 오는지
  확인
- review-form/gacha-report/report/quick-report 각각 제출 시 보너스 상한 이내면
  토스트 뜨고 기존 Alert는 안 뜨는지, 상한 초과 시 기존 동작(Alert 등) 유지되는지
  확인
- `apps/mobile` tsc/lint 그린

## Risks / Questions

- **정책 변경**: `REFERRAL_BONUS_MAX` 20→5는 기존 사용자에게 체감되는 리워드
  축소. 마케팅/공지 필요 여부는 이번 작업 범위 밖 — 사용자 판단 필요.
- **버전 스큐**: 웹 API 응답에 `gachaBonusGranted` 필드가 새로 추가되지만
  구버전 모바일 앱은 이 필드를 무시하므로 하위호환 문제 없음. 반대로 새
  모바일 빌드가 구버전 웹 API(필드 없음)를 칠 경우 `gachaBonusGranted`가
  `undefined`로 falsy 처리되어 토스트만 안 뜨고 크래시는 없음 — 안전.
- **매일 알림 설정 화면**: `gacha_bonus` 옛 토글을 이미 켜둔 사용자는 이제
  화면에서 안 보이지만 컬럼은 남아있음 — 혼란 없음(화면에 없으므로).
- **referral click 익명 호출**: 비로그인 방문자도 호출 가능한 엔드포인트라
  RPC가 매 호출 advisory lock을 잡는다 — 기존 `consume_daily_roll` 패턴과
  동일한 부하 수준이라 별도 대응 불필요.
- Codex adversarial review 결과는 이 문서의 "Adversarial Review" 섹션에
  추가 후 필요 시 "Final Plan" 반영.

## Adversarial Review

codex (gpt-5.2) 리뷰 완료. 요약:

**Blocking**

1. `apps/web/src/app/api/notifications/preferences/route.ts`에 `gacha_bonus`만
   있고 `gacha_referral_bonus`가 빠짐 — `PreferencesRow`/`PatchBody`/GET 기본값/
   `validKeys`(line 4-91) 전부 갱신 필요. 안 하면 새 토글 PATCH가 무시되거나
   GET 기본값이 `undefined`.
2. 신규 RPC `record_referral_click`의 권한 패턴(SECURITY DEFINER, search_path,
   REVOKE FROM PUBLIC/anon/authenticated, GRANT TO service_role)이 계획에
   암시만 되어 있고 명시 안 됨 — 명시 필요(보안 필수).
3. 중복 클릭(같은 inviter+visitor+오늘) 시 즉시 `false` 반환하는 로직이
   빠져있으면 재요청마다 상한 이내에서 푸시가 중복 발송될 수 있음.
4. **모바일 Alert→toast "대체" 설계가 실제 코드와 안 맞음:**
   - `review-form.tsx`는 성공 시 Alert 자체가 없고 바로 `router.back()`
     (line 232-237) — "대체"가 아니라 순수 추가.
   - `report.tsx`는 성공 Alert의 OK 버튼이 `router.back()`을 담당
     (line 198-200) — Alert 자체를 없애면 뒤로가기 트리거가 사라짐.
   - `gacha-report.tsx`는 두 성공 경로 모두 `Alert.alert(...)` 호출 직후
     (블로킹 아님) 바로 `router.back()` 실행 (line 188-189, 216-217).
   - `GachaSection.tsx` quick-report는 **응답 전에 이미 낙관적으로**
     `showToast("quickReport")`를 쏨 (line 431, 443) — 응답 도착 후 또
     toast를 부르면 순서상 뒤에 실행되는 것뿐, "대체"가 아님.
5. CLAUDE.md의 "Notion 기획서 → Penpot 디자인 → 프론트엔드 개발" 게이트가
   이 UI 변경(토스트 추가, 알림설정 토글 교체)에 적용되는지 명시 안 됨.

**Major** 6. `apps/mobile/app/_layout.tsx`의 `routeFromNotification`(line 43-77)이
`gacha_bonus`까지만 알고 `gacha_referral_bonus` 케이스가 없음 — 푸시
탭해도 라우팅 안 됨. 7. `grantGachaBonusEvent` 반환 타입 변경은 호출부가 반환값을 무시해도
컴파일 에러 없음 — 5개 호출부 전부 명시적으로 반환값을 받아써야 함. 8. 테스트 갱신이 "있으면"이 아니라 필수 대상 명시 필요: 기존
`referral/click/__tests__/route.test.ts`, `quick-report/__tests__/route.test.ts`
가 이미 존재하고 옛 동작을 전제로 함. 9. `docs/api-contracts.md`(reports 응답), `docs/superpowers/specs/2026-06-07-quick-report-design.md`
가 기존 응답 스키마를 문서화하고 있어 `gachaBonusGranted` 추가 시 갱신 필요.

**Nice-to-have** 10. `WishToast.tsx`의 `backgroundColor: "rgba(30,30,30,0.88)"`(line 98)가
색상 하드코딩 — 이 파일을 만지는 김에 `colors.ts` 상수로 옮기는 것을 고려.

## Final Plan

Adversarial Review 반영해 Scope/Plan을 아래로 확정한다. (Scope 섹션의 원안 중
"모바일 성공 핸들러" 항목과 아래 4번이 상충하면 아래가 우선한다.)

### DB (변경 없음, 세부 확정)

- `record_referral_click(p_inviter_id uuid, p_visitor_id uuid, p_variant_id uuid, p_bonus_max int) returns boolean`
  - `SECURITY DEFINER`, `SET search_path = public`
  - `perform pg_advisory_xact_lock(hashtext(p_inviter_id::text || ':referral_click'))`
  - INSERT를 `BEGIN ... EXCEPTION WHEN unique_violation THEN RETURN false; END;`
    블록으로 감싼다 (ON CONFLICT 대신 — 유니크 인덱스가 함수형 인덱스라
    `ON CONFLICT (...)` 타겟 매칭이 까다로움; `assign_referral_code`가 이미
    쓰는 예외 패턴을 그대로 따름).
  - insert 성공 후 오늘 count 계산 → `count <= p_bonus_max` 그리고
    `notification_preferences.gacha_referral_bonus`(없으면 true) 조건일 때만
    `true` 반환.
  - `REVOKE ALL ... FROM PUBLIC, anon, authenticated; GRANT EXECUTE ... TO service_role;`
- `grant_gacha_bonus_event` 단순화: notification_preferences 조회 제거,
  `v_count <= p_action_bonus_max`만 반환 (기존 REVOKE/GRANT는 유지).
- `notification_preferences.gacha_referral_bonus boolean not null default true`,
  `pending_notifications_category_check`에 `gacha_referral_bonus` 추가.

### Web API

- `apps/web/src/app/api/notifications/preferences/route.ts`: `PreferencesRow`,
  `PatchBody`, GET 기본값 객체, `validKeys` 4곳 모두에 `gacha_referral_bonus`
  추가. (기존 `product_wishlist_restock`이 `validKeys`에 빠진 버그는 무관,
  손대지 않음.)
- `apps/web/src/app/api/notifications/preferences/__tests__/route.test.ts`
  갱신 (새 필드 반영).
- `apps/web/src/lib/gacha/bonus.ts`: `grantGachaBonusEvent` → `Promise<boolean>`.
- 5개 호출부: 각 라우트에서 `let gachaBonusGranted = false;`로 선언 후
  `gachaBonusGranted = await grantGachaBonusEvent(...)`로 명시적으로 대입,
  최종 성공 응답 JSON에 `gachaBonusGranted` 포함. `reviews/route.ts`의
  idempotent 재제출 분기(line ~201, 보너스 호출 이전에 조기 반환)는
  `gachaBonusGranted: false` 유지.
- `apps/web/src/app/api/referral/click/route.ts`: insert(line 105-112)를
  `record_referral_click` RPC 호출로 교체, true면
  `enqueueNotification(adminClient, inviter.id, "gacha_referral_bonus", "가챠 기회가 생겼어요", "친구가 링크를 열어서 가챠 뽑기 기회가 늘었어요", { type: "gacha_referral_bonus" })`
  를 try/catch로 감싸 호출. 봇 UA 필터/rate limit/자기 클릭 방지/항상 204
  반환은 그대로 유지.
- `apps/web/src/lib/notifications/sendPush.ts`: 유니온에 `"gacha_referral_bonus"`
  추가.
- 테스트 갱신 대상(존재 확인됨): `bonus.test.ts`,
  `referral/click/__tests__/route.test.ts`,
  `quick-report/__tests__/route.test.ts`,
  `notifications/preferences/__tests__/route.test.ts`. `reviews/__tests__`,
  `reports/__tests__` 존재 확인 후 필요 시 갱신. `gacha-observations`는
  `__tests__` 디렉토리 없음 — 신규 작성은 선택 사항(범위 밖으로 둠, 과한
  범위 방지).
- `docs/api-contracts.md`(reports 응답 스키마), `docs/superpowers/specs/2026-06-07-quick-report-design.md`
  에 `gachaBonusGranted` 필드 추가 반영.

### Mobile — 화면별로 다르게 처리 (일괄 "Alert→toast 대체" 아님)

- `review-form.tsx`: 응답 파싱 후(`data.new_badge` 체크 근처, line 232-235),
  `router.back()`(line 237) 직전에
  `if (data.gachaBonusGranted) showToast("bonusGranted");` 추가. 파일에
  `useWishToast` import/훅 호출 신규 추가 필요.
- `GachaSection.tsx` quick-report: `handleQuickReport`의
  `if (data.new_badge) { ... }` 근처(line 355-357)에
  `if (data.gachaBonusGranted) showToast("bonusGranted");` 추가. 낙관적
  `showToast("quickReport")` 호출(line 431, 443)은 건드리지 않음 — 두 토스트가
  순차 실행되며 나중 것이 이긴다(WishToast는 단일 상태라 자연스럽게 대체됨).
- `report.tsx`: 응답 바디는 이미 `resBody`로 파싱됨(line 187-191). Alert
  메시지를 조건부로 구성:
  `resBody.gachaBonusGranted ? \`${t("report.success")}\n${t("gacha.bonusGranted.toastSuccess")}\` : t("report.success")`.
Alert 구조(OK 버튼이 `router.back()` 담당)는 그대로 유지.
- `gacha-report.tsx`: 두 성공 경로(line 184-190, 210-217) 모두 현재 응답
  json을 안 읽으므로 `const data = await res.json().catch(() => ({}))` 추가
  후, `Alert.alert(t("gacha.report.successNew"), data.gachaBonusGranted ? t("gacha.bonusGranted.toastSuccess") : undefined)`
  로 변경. `router.back()`은 그대로 Alert 호출 직후 유지(기존과 동일하게
  non-blocking).
- `apps/mobile/app/_layout.tsx`: `PushNotificationData.type` 유니온과
  `routeFromNotification`의 switch(line 43-77)에
  `case "gacha_referral_bonus": router.push("/(tabs)" as never); break;` 추가.
  기존 `gacha_bonus` 케이스는 삭제하지 않고 유지(이미 큐에 쌓인 알림 대비,
  죽은 코드로 남겨도 무해).
- `WishToast.tsx`: `ToastType`에 `"bonusGranted"` 추가, `getMessage()`에
  `if (toastType === "bonusGranted") return t("gacha.bonusGranted.toastSuccess");`
  추가. (선택) 이 파일을 여는 김에 `backgroundColor: "rgba(30,30,30,0.88)"`을
  `colors.ts`의 새 상수로 옮김 — 필수 아님, 시간 되면.
- `notification-settings.tsx`: `CATEGORIES`에서 `gacha_bonus` 제거,
  `gacha_referral_bonus` 추가.
- i18n 4개 로케일: `gacha.bonusGranted.toastSuccess`,
  `notificationSettings.gachaReferralBonus`/`...Desc`.

### 순서 (기존 Plan 1-16과 동일하되 위 세부사항 반영, 8번을 "웹 라우트 5곳 +

notification preferences 라우트 갱신 + 관련 vitest 전부 그린"으로 확장)

### UI 게이트 확인 필요 (사용자 결정 대기)

CLAUDE.md는 "Notion 기획서 → Penpot 디자인 → 프론트엔드 개발" 순서를
UI 작업 전제로 요구한다. 이번 변경은 신규 화면/레이아웃이 아니라 기존
`WishToast` 컴포넌트에 문구 케이스 1개 추가, 기존 `notification-settings`
토글 리스트에서 항목 1개를 다른 항목으로 교체하는 수준이라 신규 Penpot
디자인이 필요 없다고 판단하지만, 이 판단 자체가 프로젝트 규칙의 명시적
예외이므로 사용자 확인 없이 진행하지 않는다.
