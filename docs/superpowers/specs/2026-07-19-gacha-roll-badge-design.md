# 가챠 뽑기 배지 트랙 설계

## Context

**[2026-07-19 정정]** 최초 조사에서 `supabase/migrations`와 `apps/mobile`만 검색해 "어워드 엔진이 없다"고 잘못 판단했음. 실제로는 `apps/web/src/lib/badges/earn.ts`(`checkAndAwardBadge`) + `count.ts`(`getBadgeCount`)에 app-layer 어워드 엔진이 이미 구현되어 있고, `quick_report`/`shop_review`/`wishlist`/신고 승인 라우트에서 실제로 호출 중. 푸시 알림도 `enqueueNotification`으로 이미 연결되어 있음. 웹에도 `apps/web/src/app/[locale]/mypage/badges/page.tsx` 소비자용 배지 화면이 존재함. 아래 목표/설계는 이 사실을 반영해 수정됨 — **신규 트리거를 만들지 않고 기존 엔진에 훅킹**하는 방향으로 변경.

기존 배지 시스템(`docs/superpowers/specs/2026-06-08-badge-system-design.md`)은 퀵리포트/리뷰/신고/위시리스트 6개 트랙 + 운영자 배지로 구성. 가챠 뽑아보기 기능(`gacha_roll_results`)에 대한 배지 트랙은 없음.

## 목표

- 뽑기 행동 기반 배지 트랙 2개 신설
- 기존 app-layer 어워드 엔진(`checkAndAwardBadge`)에 신규 트랙 카운트 로직 추가
- 기존 배지 UI/알림 흐름 재사용 (모바일 + 웹 배지 화면 둘 다, 신규 알림 인프라 없음)

## 배지 트랙 정의

| track                | 기반 지표                                | 티어1 | 티어2 | 티어3 |
| -------------------- | ---------------------------------------- | ----- | ----- | ----- |
| `gacha_roll_variety` | 서로 다른 `product_id` 뽑은 개수         | 1개   | 20개  | 50개  |
| `gacha_roll_days`    | 뽑기 시도한 서로 다른 날짜 수 (KST 기준) | 1일   | 10일  | 30일  |

카피 (기존 트랙과 동일하게 스토리텔링 네이밍, 임계값은 UI에 노출 안 함):

- `gacha_roll_variety`: 뽑기 입문자 → 가챠 탐식가 → 가챠 컬렉터
- `gacha_roll_days`: 첫 방문 → 단골 뽑기러 → 가챠 중독자

`badge_definitions`에 두 트랙 × 3티어 = 6개 row 추가. `icon_url`은 기존 트랙과 동일하게 빈 문자열로 시작(에셋은 후속 작업).

## 데이터 소스

신규 테이블 없음. 기존 `gacha_roll_results(user_id, product_id, rolled_at)` 재사용.

- variety count: `COUNT(DISTINCT product_id) WHERE user_id = ?`
- days count: `COUNT(DISTINCT date(rolled_at AT TIME ZONE 'Asia/Seoul')) WHERE user_id = ?`

이 테이블은 retention 삭제 대상이 아님 (`daily_featured_gacha`와 달리 30일 삭제 로직 없음) — 누적 카운트로 안전하게 사용 가능.

## 어워드 엔진

DB 트리거를 새로 만들지 않고 기존 app-layer 엔진에 훅킹:

1. `apps/web/src/lib/badges/count.ts`의 `getBadgeCount()`에 `gacha_roll_variety`/`gacha_roll_days` 분기 추가 — 기존 트랙처럼 `badge_count_log`를 세지 않고 `gacha_roll_results`에서 직접 distinct product/day 계산
2. `apps/web/src/app/api/gacha-products/[id]/roll/route.ts`의 롤 성공(insert) 직후 `checkAndAwardBadge(adminClient, user.id, "gacha_roll_variety")`, `checkAndAwardBadge(..., "gacha_roll_days")` 호출
3. `tryLogBadgeCount`/`badge_count_log`는 사용 안 함 — `gacha_roll_results` row 자체가 이미 로그 역할

`checkAndAwardBadge`가 이미 처리해주는 것: `user_badges` insert, 대표 배지 미설정 시 자동 지정, `enqueueNotification`으로 푸시 알림 발송, `push_notified_at` 갱신.

기존 인앱 알림 흐름도 그대로 적용됨: 앱이 세션 로드/포그라운드 시 `fetchUnnotifiedBadges()`(`app/_layout.tsx`)가 `user_badges.notified_at IS NULL` 조회 → `BadgeEarnedModal` 표시.

## 클라이언트 변경

- `apps/mobile/app/badges.tsx`의 `BADGE_TRACKS` 배열에 `gacha_roll_variety`, `gacha_roll_days` 추가
- `apps/web/src/app/[locale]/mypage/badges/page.tsx`의 `BADGE_TRACKS` 배열에도 동일하게 추가 (웹에도 소비자용 배지 화면 존재)
- `packages/shared/src/types/badge.ts`의 `BadgeTrack` union에 두 값 추가 (closed union이라 안 하면 타입 에러/schema drift)

모바일 쪽 변경은 OTA(expo-updates) 미설정 상태라 정기 앱스토어 배포에 포함되어야 반영됨. 웹/DB 쪽 변경은 배포 즉시 반영.

## 기존 코드와의 관계

- `badge_definitions`, `user_badges`, `checkAndAwardBadge`, `getBadgeCount` 재사용
- DB 스키마 변경은 `badge_definitions` row 추가 + `gacha_roll_results` 인덱스 추가뿐, 신규 테이블/트리거 없음
- `apps/mobile/app/badges.tsx`, `apps/web/.../mypage/badges/page.tsx`의 `BADGE_TRACKS` 배열 수정
- 기존 6개 트랙(quick_report 등)의 어워드 로직은 그대로 둠, 변경 없음

## 스코프 외

- 뽑기 직후 즉시 배지 획득 모달 표시 (실시간 피드백) — 기존 세션 로드 시점 알림 흐름 그대로 사용
- 배지 아이콘 에셋 제작/업로드
- 다국어 배지 카피 (기존 트랙과 동일하게 한국어 텍스트만 DB에 저장)

## 검증 방법

1. 신규 유저가 상품 1개 최초 뽑기 → `gacha_roll_variety` 티어1, `gacha_roll_days` 티어1 동시 획득 확인
2. 하루 최대 10개 상품 제한이므로 여러 날에 걸쳐 서로 다른 상품 19개 추가로 뽑기 → 20개째에 `gacha_roll_variety` 티어2 획득 확인
3. 서로 다른 날짜에 10일 연속(비연속도 무관) 뽑기 → `gacha_roll_days` 티어2 획득 확인
4. 이미 획득한 티어는 재획득(중복 insert) 안 되는지 `ON CONFLICT` 동작 확인
5. `badges.tsx`에서 두 트랙이 잠금/해제 상태로 정상 렌더링되는지 확인
6. dev 프로젝트에 마이그레이션 적용 후 위 시나리오 재검증 → prod 적용

## 리스크 / 확인 필요 항목

- 카피(배지 이름/설명 문구) 최종 확정 필요 — 초안은 위 표 참고, 어드민에서 이후 수정 가능
- `getBadgeCount`가 매 롤마다 해당 유저의 `gacha_roll_results` 전체 row를 읽어 JS에서 distinct 계산 — `20260706` 마이그레이션들에서 기존 unique index가 제거되어 `user_id` 계열 인덱스가 없던 상태였음, 이번 마이그레이션에 `(user_id, rolled_at) INCLUDE (product_id)` 인덱스 추가로 완화. 데이터 더 커지면 SQL 집계(RPC)로 전환 검토
- 클라이언트 `BADGE_TRACKS` 변경분(모바일)이 다음 정기 배포 일정에 맞물리는지 확인 필요
