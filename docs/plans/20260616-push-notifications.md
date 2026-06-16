# 푸시 알림(Push Notification) 기능 추가

## Context

gacha-map은 현재 푸시 알림 인프라가 전혀 없음 (모바일 expo-notifications, 웹 web-push, DB token 테이블, edge function 전부 미구축). 반면 제보(quick_reports)/리뷰 처리, 찜한 매장(wishlist) 변경, 뱃지 획득(user_badges, 이미 `notified_at` 컬럼까지 준비되어 있음), 매장 소유자(shop_owner_applications, shops.owner_id) 등 알림을 보낼 만한 이벤트는 이미 다수 존재함. 사용자 재방문/리텐션을 위해 이 이벤트들에 푸시 알림을 연결한다.

이 계획은 사용자 요청에 따라 **Codex 전체 플랜 교차검증을 3라운드** 거쳤다. 1라운드에서 나온 4개 critical(리뷰 상태 미존재, preferences 기본값, shop_owner_update 범위, wishlist fan-out 방식)을 수정한 뒤 2라운드 재검증을 수행, 2라운드에서 나온 6개 critical + 다수 major를 반영했다. 3라운드 재검증에서는 critical 0개, major 5개(wishlist_news 관리자 라우트 경로 오류, Phase A stuck-row 복구 부재, 토큰 0건 시 최종 상태 미정의, 로그아웃 시 기기별 token 식별 누락, Android notification channel 누락) + minor 1개(다이어그램 문장 누락)가 나왔고 전부 반영했다. 아래 본문은 그 반영 결과다.

## Scope (v1)

- 플랫폼: 모바일(Expo)만. 웹 push는 범위 제외.
- 알림 카테고리 5종:
  1. `report_result` - 제보(reports 테이블) 처리 결과 (제보자 본인에게)
  2. `shop_owner_activity` - 내 매장에 새 리뷰/제보가 등록됨 (매장 소유자에게). reviews/quick_report에는 승인·반려 같은 상태값이 없음을 확인했고, 사용자가 의도한 "리뷰 처리 결과"는 실제로는 "내 매장 리뷰/제보 활동 알림"이었음 (대화로 확정)
  3. `wishlist_news` - 찜한 매장의 핵심 정보(name/address/status) 변경
  4. `badge` - 뱃지 획득
  5. `shop_owner_update` - 매장 소유자 신청(shop_owner_applications) 승인/반려 결과 (admin 처리, v1은 admin 트리거만)
- 카테고리별 on/off 알림 설정 화면 (프로필 영역에 추가)
- 알림 탭 시 관련 화면으로 딥링크

## Out of Scope (v2로 연기)

- `broadcast` (전체 유저 대상 공지/이벤트 알림) - 트리거 주체, 빈도, 메시지 포맷 미정 + 수천 명 fan-out이라 별도 설계 필요. 인프라(pending_notifications + cron)는 그대로 재사용 가능.
- 웹(PC) push
- 앱 내 알림 인박스/히스토리 화면 (push만 보내고 끝)
- `pending_notifications` 오래된 row 정리(retention) 배치 — v1은 무기한 누적, v2에서 cron으로 정리
- APNs/FCM 기기 제거(uninstall) 웹훅 연동 — v1은 발송 시점에 받는 `DeviceNotRegistered` 에러로만 토큰 정리 (충분히 커버됨)

## Architecture

```
[모바일]                         [웹 API route]                      [비동기 처리 - Vercel Cron 1분]
1. expo-notifications 권한 요청   4. report 승인/반려, 리뷰/제보 생성,    6. /api/cron/send-notifications
   + token 발급                     wishlist fan-out, badge 획득 등        - CRON_SECRET 헤더 검증
2. POST /api/notifications/token    → DB 업데이트가 실제로 반영된           - Phase A: pending row를
   (인증된 본인 user_id로만 upsert)    경우에만 pending_notifications        FOR UPDATE SKIP LOCKED로 클레임
3. 카테고리별 on/off                  INSERT (idempotency 가드)             → status='processing'
   notification_preferences        5. badge는 lib/badges/earn.ts의         → Expo Push API 티켓 발송
4. 푸시 탭 → expo-router 딥링크       checkAndAwardBadge() insert 직후        → status='receipt_pending'
                                      동일 패턴으로 INSERT             - Phase B: receipt_pending +
                                                                              15분 경과 row의 영수증 조회
                                                                              → 최종 sent/failed 확정
                                                                              → DeviceNotRegistered 토큰 삭제
                                                                            - stuck row 복구: processing
                                                                              10분 이상 머문 row는 pending
                                                                              으로 되돌림 (크래시 복구)
```

**핵심 결정 1 (1라운드 Codex 반영):** API route에서 Expo Push API를 직접 동기 호출하지 않음. fan-out(찜한 매장 알림)이 수백~수천 건일 수 있어 admin 요청이 타임아웃되거나 부분 실패 시 복구 불가능한 문제가 생김. 대신 `pending_notifications`에 적재만 하고 Vercel Cron이 처리. 새 인프라(Redis/Bull) 도입 없음.

**핵심 결정 2 (2라운드 Codex 반영):** Expo Push API는 "티켓"만 즉시 반환하고 실제 전달 성공/실패(`DeviceNotRegistered` 등)는 별도 "영수증" 조회(전송 후 최소 15분 권장)로만 알 수 있음. 따라서 cron을 2-phase로 분리: 티켓 발송(Phase A) → 영수증 확인(Phase B). 새 테이블 없이 `pending_notifications`에 `delivery_results jsonb` 컬럼을 추가해 멀티 디바이스별 결과를 배열로 저장 (정규화 테이블 대신 v1 단순화).

**핵심 결정 3 (2라운드 Codex 반영):** Vercel Cron이 1분마다 실행되므로 이전 실행이 안 끝난 채 다음 실행이 겹칠 수 있음(중복 발송 위험). `SELECT ... FOR UPDATE SKIP LOCKED`로 row를 클레임한 뒤 `status='processing'`으로 바꾸는 방식으로 동시 실행 시에도 같은 row를 두 번 처리하지 않음. **stuck row 복구 (3라운드 Codex major):** Expo 호출 중 함수가 죽으면 row가 `processing`에 영원히 멈출 수 있으므로, Phase A 시작 시 `status='processing' AND claimed_at < now() - interval '10 minutes'` row도 함께 클레임 대상에 포함시켜 `pending`으로 되돌린 뒤 재시도한다.

## DB 변경 (supabase/migrations/, dev 먼저 적용 → prod)

**`device_push_tokens`**

- `id uuid pk`, `user_id uuid references auth.users`, `token text unique`, `platform text check (ios|android)`, `created_at`, `updated_at`
- upsert on conflict(token): user_id 갱신 (기기 변경/재로그인 대응)
- RLS: user는 자기 user_id row만 select/insert/delete. service role만 전체 select (cron이 사용).
- **보안 (2라운드 critical #5):** `POST /api/notifications/token`은 인증된 Supabase 클라이언트(쿠키/세션)로 `auth.user.id`를 직접 읽어서 그 값으로만 upsert한다. 요청 body에 user_id가 와도 절대 사용하지 않음 (스푸핑 방지).

**`notification_preferences`**

- `user_id uuid pk references auth.users`, `report_result bool default true`, `shop_owner_activity bool default true`, `wishlist_news bool default true`, `badge bool default true`, `shop_owner_update bool default true`
- RLS: user는 자기 자신만 select/insert/update (insert도 허용 — 토큰 등록 전에 설정 화면에서 먼저 저장하는 경우 대응, 2라운드 major #18).
- **기본값/백필 정책:** 별도 가입 트리거 없음. 토큰 등록 또는 설정화면 진입 시 `INSERT ... ON CONFLICT (user_id) DO NOTHING`으로 기본값(전부 true) row 생성. 트리거 발송 쿼리는 `LEFT JOIN notification_preferences` + `COALESCE(pref.category, true)`로 작성 — row가 없는 유저도 기본 true로 취급.

**`pending_notifications`**

- `id uuid pk`, `user_id uuid`, `category text`, `title text` (≤60자로 truncate), `body text` (≤150자로 truncate), `data jsonb`, `status text default 'pending' check (pending|processing|receipt_pending|sent|failed)`, `retry_count int default 0`, `next_attempt_at timestamptz default now()`, `claimed_at timestamptz`, `delivery_results jsonb default '[]'` (디바이스별 `{token, ticket_id, status, error}` 배열), `created_at`
- service role만 접근 (API route, cron 모두 service key 사용)
- **payload 크기 가드 (major #17):** Expo 4KB 제한 대비 title/body를 enqueue 헬퍼에서 truncate.
- **data 페이로드 스키마 (major #9, 카테고리별 고정):**
  - `report_result`: `{type:'report_result', report_id}`
  - `shop_owner_activity`: `{type:'shop_owner_activity', shop_id}`
  - `wishlist_news`: `{type:'wishlist_news', shop_id}`
  - `badge`: `{type:'badge', badge_id}`
  - `shop_owner_update`: `{type:'shop_owner_update', application_id}`
- **토큰 없는 유저 가드 (major #13):** enqueue 시 `WHERE EXISTS (SELECT 1 FROM device_push_tokens WHERE user_id = target)` 조건 추가 — 토큰 미등록 유저는 row 자체를 쌓지 않음 (cron이 영원히 못 보낼 row 방지).

**기타 컬럼/인덱스 추가**

- `wishlists`에 `CREATE INDEX ON wishlists(shop_id)` 추가 (major #14 — fan-out SELECT가 user_id 인덱스만 있고 shop_id 인덱스가 없어 풀스캔 위험).
- `user_badges`에 `push_notified_at timestamptz` 컬럼 추가 — 기존 `notified_at`은 모바일 인앱 뱃지 모달이 "확인함" 표시로 이미 사용 중이라 푸시 발송 완료 마커와 충돌함 (major #15). 푸시는 `push_notified_at`만 사용.

## 트리거 지점 (전부 "DB 변경이 실제로 반영된 후에만 pending_notifications INSERT")

| 카테고리            | 위치                                                                                                                                                                                                                                                                                                                                           | 수신자                                                | 비고                                                                                                                                                                                                                                                                                                               |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| report_result       | `apps/web/src/app/api/admin/reports/[id]/approve/route.ts` (status→reviewed), `.../reject/route.ts` (status→resolved), `apps/web/src/app/api/admin/shops/route.ts` (source_report_id로 자동 resolved 처리되는 분기)                                                                                                                            | report.user_id                                        | **idempotency (major #8):** `UPDATE reports SET status=$1 WHERE id=$2 AND status='pending'`처럼 상태 가드를 걸고 실제 row가 갱신된 경우에만 INSERT (중복 호출 시 중복 발송 방지). new_shop 타입 report는 승인 후에도 `shop_id`가 채워지지 않는 것을 확인함(major #11) → 이 경우 딥링크 대상 없이 `/profile`로 폴백 |
| shop_owner_activity | `apps/web/src/app/api/shops/[id]/reviews/route.ts` (리뷰 생성 직후), `apps/web/src/app/api/shops/[id]/quick-report/route.ts` (제보 생성 직후)                                                                                                                                                                                                  | `shops.owner_id` (해당 shop_id 소유자, null이면 skip) | 작성자==owner인 경우(본인 매장에 본인이 작성) 제외                                                                                                                                                                                                                                                                 |
| wishlist_news       | `apps/web/src/app/api/admin/shops/[id]/route.ts` (PATCH, 관리자 수정 — 3라운드 Codex에서 `admin/shops/route.ts`는 신규 생성 POST만 있고 실제 기존 매장 수정은 `[id]/route.ts`임을 확인해 경로 정정) **+** `apps/web/src/app/api/shop-owner/shop/route.ts` (PATCH, 매장 소유자 본인 수정 — 기존 코드에 이미 존재함을 확인, 2라운드 critical #1) | `wishlists`에서 해당 shop_id의 user_id 전체 fan-out   | name/address/status 변경시에만(whitelist), 두 route 모두 동일 로직 호출. fan-out은 application loop 대신 단일 set-based SQL(`INSERT INTO pending_notifications (...) SELECT ... FROM wishlists WHERE shop_id = $1 AND EXISTS(...)`)로 처리                                                                         |
| badge               | `apps/web/src/lib/badges/earn.ts` `checkAndAwardBadge()` insert 직후                                                                                                                                                                                                                                                                           | 해당 user_id                                          | `push_notified_at` 채워서 중복 방지 (기존 `notified_at`과 분리)                                                                                                                                                                                                                                                    |
| shop_owner_update   | `shop_owner_applications` 상태 변경 route (admin)                                                                                                                                                                                                                                                                                              | application.user_id                                   | v1은 admin 처리만. owner 본인이 자기 매장을 수정하는 것은 `shop_owner_update`가 아니라 위 `wishlist_news`를 같이 발생시키는 이벤트임 (notify 대상이 다름에 주의)                                                                                                                                                   |

각 트리거는 `notification_preferences`에서 해당 카테고리가 true(또는 row 없음=기본 true)인 유저에게만 INSERT.

## 비동기 발송 처리 (cron, 2-phase)

- `apps/web/src/lib/notifications/sendPush.ts`: `expo-server-sdk` 사용.
- `apps/web/src/app/api/cron/send-notifications/route.ts`:
  - **인증 (critical #6):** `Authorization: Bearer ${CRON_SECRET}` 헤더 검증, 불일치 시 401. `vercel.json` cron 설정 + Vercel 환경변수에 `CRON_SECRET` 등록.
  - **Phase A (티켓 발송):** `status IN ('pending','processing') AND (status='pending' AND next_attempt_at<=now() OR status='processing' AND claimed_at < now() - interval '10 minutes')` row를 `FOR UPDATE SKIP LOCKED`로 최대 N개 클레임 (3라운드 Codex major: `processing` 상태로 10분 이상 머문 row는 Expo 호출 중 크래시로 stuck된 것으로 간주해 재클레임 대상에 포함) → `status='processing'`, `claimed_at=now()` → user_id별 `device_push_tokens` 조회. **조회 결과가 0건이면 (3라운드 Codex major) 즉시 `status='failed'`로 종료하고 Phase B로 넘기지 않음** (토큰이 없으면 영수증 확인 대상도 없으므로 receipt_pending에 두면 영원히 안 끝남). 토큰이 있으면 100개씩 배치로 Expo Push API 호출 → 받은 ticket id를 `delivery_results`에 저장 → `status='receipt_pending'`.
  - **Phase B (영수증 확인):** `status='receipt_pending' AND claimed_at < now() - interval '15 minutes'` row의 ticket id로 `getPushNotificationReceiptsAsync` 호출 → 모든 디바이스 성공이면 `status='sent'`. `DeviceNotRegistered` 에러면 해당 token을 `device_push_tokens`에서 삭제하고 그 디바이스만 실패 처리(다른 디바이스가 하나라도 성공이면 전체 `sent`로 간주, 전부 실패면 `failed`). 그 외 에러는 `retry_count+1` 후 `status='pending'`으로 되돌리고 `next_attempt_at = now() + (2^retry_count)분` (지수 백오프, major #16), retry_count 5회 초과 시 `status='failed'`로 종료.

## 모바일 변경

- 패키지 추가: `expo-notifications`, `apps/web`에 `expo-server-sdk`
- `app.config.js`에 expo-notifications 플러그인 추가
- 권한 요청 + token 등록: 로그인 직후(또는 프로필 첫 진입 시) 1회, `_layout.tsx`의 `loadUserFromSession` 근처에 훅. 콜드 스타트(앱이 종료된 상태에서 알림 탭으로 실행)도 `getLastNotificationResponseAsync`로 처리.
- **Android notification channel (3라운드 Codex major):** Android는 채널 미설정 시 알림이 표시되지 않거나 기본음만 나갈 수 있으므로, 토큰 등록 직후 `Notifications.setNotificationChannelAsync('default', { name: 'Default', importance: AndroidImportance.DEFAULT })` 호출.
- 발급받은 Expo push token을 `expo-secure-store` 등으로 기기 로컬에 저장 (3라운드 Codex major: 로그아웃 시 정확히 "이 기기"의 token만 지워야 하므로, 서버에 다시 물어보지 않고 로그인 시 저장해둔 토큰 값으로 삭제 요청을 보낸다).
- 로그아웃 시 `DELETE /api/notifications/token` (body에 로컬에 저장된 현재 기기 token 포함 → 그 token row만 삭제. 다른 기기 로그인은 유지되는 게 정상 동작).
- 알림 설정 화면: 프로필 탭(`(tabs)/profile.tsx`)에 메뉴 추가 → 카테고리별 토글 화면 신규 (`notification-settings.tsx`)
- 딥링크 라우팅 (`data.type` 기준 expo-router push):
  - `report_result`, `wishlist_news` → `/shop/{shop_id}` (shop_id 없으면 `/profile` 폴백)
  - `shop_owner_activity` → `/shop/{shop_id}?tab=reviews` (현재 shop 상세 화면에 별도 nested route가 없어 쿼리 파라미터로 탭 전환, major #10)
  - `badge` → `/badges`
  - `shop_owner_update` → `/profile`
  - 딥링크 대상 매장이 비공개/삭제된 경우(상세 API 404) → 토스트 안내 후 `/profile`로 폴백 (major #19)

## Verification

- 마이그레이션 dev 적용 → Supabase MCP로 테이블/RLS/인덱스 확인
- 모바일: 실기기(EAS dev build, 시뮬레이터는 push 불가)에서 권한 요청 → token 등록 확인 (device_push_tokens row 생성, user_id가 본인 것인지 확인)
- 관리자 웹에서 제보 승인/반려 → pending_notifications row 생성 확인 (idempotent: 같은 요청 2번 보내도 row 1개만) → cron Phase A 수동 트리거 → status='receipt_pending' 확인 → 15분 후 Phase B → status='sent' + 실기기 푸시 도착 + 탭 시 딥링크 확인
- cron 동시 실행 테스트: Phase A를 거의 동시에 2번 호출해도 같은 row가 중복 발송되지 않는지 확인 (SKIP LOCKED 동작 확인)
- 위시리스트 fan-out: admin 수정 + shop-owner 본인 수정 양쪽 다 매장 정보(이름) 수정 → 여러 유저가 찜한 매장 기준 pending_notifications row 수 확인, wishlists(shop_id) 인덱스로 빠르게 조회되는지 확인
- 뱃지: 리뷰/제보/위시리스트 액션으로 뱃지 획득 조건 충족 → `push_notified_at`만 채워지고 기존 `notified_at`(인앱 모달용)과 분리되어 동작하는지 확인
- 알림 설정 토글 off 시 해당 카테고리 pending_notifications row가 생성되지 않는지 확인
- `CRON_SECRET` 없이 `/api/cron/send-notifications` 호출 시 401 확인 (보안)
- `POST /api/notifications/token`에 다른 유저의 user_id를 body로 넣어 호출해도 본인 user_id로만 저장되는지 확인 (스푸핑 방지)

## Risks / Open Questions

- Vercel Cron 1분 주기가 현재 플랜(Hobby/Pro)에서 가능한지 확인 필요 (Hobby는 cron 일 1회 제한 있을 수 있음 → 확인 후 안되면 Supabase Edge Function의 pg_cron으로 대체)
- EAS 푸시 인증서(APNs key/FCM)는 EAS 프로젝트에 이미 연결되어 있는지 별도 확인 필요 (최초 발송 시 `eas credentials`로 설정)
- new_shop 타입 report는 승인 후에도 reports.shop_id가 채워지지 않음 — v1은 `/profile` 폴백으로 처리. shop_id를 채워주는 백필 로직은 이 작업의 범위를 벗어나므로 별도 개선 과제로 남김.
- `pending_notifications`/`delivery_results` row가 무기한 누적됨 — v1은 정리 배치 없음. row 수가 문제될 정도로 커지면 v2에서 retention cron 추가.
- 2라운드 Codex 리뷰의 minor 항목(타임스탬프 디폴트, 세부 로깅 등)은 구현 단계에서 코드 리뷰로 통상적으로 처리 가능한 수준이라 별도 설계 변경 없이 진행.

## 다음 단계 (project workflow)

CLAUDE.md Plan-Review-Implement-Verify 규칙에 따라, 이 계획 승인 후 `docs/plans/20260616-push-notifications.md`로 저장하고 실제 구현은 backend-agent(API route, sendPush 모듈, migration)와 mobile 쪽 작업(별도 agent 또는 직접)으로 분배. 마이그레이션은 dev 먼저 적용 → 확인 → prod.
