# 가챠 뽑기 배지 트랙 설계

## Context

기존 배지 시스템(`docs/superpowers/specs/2026-06-08-badge-system-design.md`)은 퀵리포트/리뷰/신고/위시리스트 6개 트랙 + 운영자 배지로 구성. 가챠 뽑아보기 기능(`gacha_roll_results`)에 대한 배지 트랙은 없음.

또한 기존 6개 트랙은 `badge_definitions`에 정의(threshold 포함)만 있고, 실제로 threshold 달성 시 `user_badges`에 자동으로 넣어주는 어워드 엔진은 구현된 적 없음(운영자 배지 트리거만 존재, `20260614_admin_badge.sql`). 이번 작업 범위에서는 기존 6개 트랙 엔진을 만들지 않음 — 별도 작업.

## 목표

- 뽑기 행동 기반 배지 트랙 2개 신설
- 신규 트랙 전용 자동 어워드 엔진(트리거) 구현
- 기존 배지 UI/알림 흐름 재사용 (신규 화면/신규 알림 인프라 없음)

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

`gacha_roll_results` AFTER INSERT 트리거 신설 (`grant_admin_badge()`와 동일 패턴, `SECURITY DEFINER`):

1. 트리거 발동 시 해당 `user_id`의 variety count, days count 계산
2. 두 트랙 각각에 대해 아직 획득하지 않은 티어 중 threshold를 만족하는 가장 높은 티어 조회
3. 해당 `badge_definitions.id`로 `user_badges` insert (`ON CONFLICT DO NOTHING`)

기존 알림 흐름 재사용: 앱이 세션 로드/포그라운드 시 `fetchUnnotifiedBadges()`(`app/_layout.tsx`)가 `user_badges.notified_at IS NULL` 조회 → `BadgeEarnedModal` 표시 → notified_at 갱신. 롤 직후 즉시 모달 띄우는 별도 클라이언트 흐름은 만들지 않음 (스코프 외, 필요 시 후속 작업).

## 클라이언트 변경

`apps/mobile/app/badges.tsx`의 `BADGE_TRACKS` 배열(하드코딩)에 `gacha_roll_variety`, `gacha_roll_days` 추가.

이 변경은 OTA(expo-updates) 미설정 상태라 정기 앱스토어 배포에 포함되어야 반영됨 — DB 마이그레이션만으로는 즉시 반영 안 됨.

## 기존 코드와의 관계

- `badge_definitions`, `user_badges`, `grant_admin_badge()` 트리거 패턴 재사용, 스키마 변경 없음
- `apps/mobile/app/badges.tsx`의 `BADGE_TRACKS` 배열만 수정
- 기존 6개 트랙(quick_report 등)의 어워드 엔진 부재는 이번 작업에서 다루지 않음

## 스코프 외

- 기존 6개 트랙(퀵리포트/리뷰/신고/위시리스트)의 어워드 엔진 구현
- 뽑기 직후 즉시 배지 획득 모달 표시 (실시간 피드백)
- 푸시 알림 발송 인프라 (`push_notified_at` 컬럼은 존재하나 실제 발송 로직 없음 — 기존 상태 그대로 둠)
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
- 트리거가 매 롤마다 `COUNT(DISTINCT ...)` 풀스캔 — 현재 `gacha_roll_results` 규모에선 문제 없으나 데이터 증가 시 `(user_id, rolled_at)` 인덱스 필요 여부 재검토
- 클라이언트 `BADGE_TRACKS` 변경분이 다음 정기 배포 일정에 맞물리는지 확인 필요
