# 푸시 알림 실시간화 (DB Trigger + Edge Function)

## Context

`docs/plans/20260616-push-notifications.md`로 구축된 현재 파이프라인은 폴링 방식이다: `pending_notifications`에 알림을 적재하고, GitHub Actions 워크플로우(`.github/workflows/send-notifications.yml`)가 `* * * * *`(매분) `/api/cron/send-notifications`를 호출해 Phase A(발송)/Phase B(영수증 확인)를 처리한다.

이 워크플로우가 반복 실패 중임을 확인했다 (run #662, #663 — `The job was not acquired by Runner of type hosted even after multiple attempts`). 원인 조사:

- 레포는 **public**이므로 GitHub Actions 분당 과금/한도 초과는 배제됨 (`gh repo view` 확인).
- 실행 이력 자체가 651→663까지 각 실행 간격이 매분이 아니라 1.5~2시간 간격으로 드문드문 찍힘. 매분 스케줄이 실제로는 GitHub 스케줄러에서 낮은 우선순위로 취급되어 지연/드롭되는 것으로 보임 (GitHub의 알려진 동작 — 고빈도 scheduled workflow는 지연·스킵될 수 있음).
- 결론: 코드 문제가 아니라 **GitHub Actions 스케줄러가 매분 실행을 신뢰성 있게 보장하지 못함**. billing 문제는 아니지만 인프라 신뢰성 문제이고, 이는 Phase A뿐 아니라 Phase B(영수증 확인, 15분 지연 로직)에도 동일하게 영향을 준다.

사용자 요청(실시간 알림)에 따라, Phase A는 DB Trigger + Edge Function으로 이벤트 기반 즉시 발송으로 전환하고, GitHub Actions에 대한 의존을 완전히 제거하기 위해 Phase A 안전망과 Phase B는 Supabase `pg_cron`으로 이관한다.

## Scope

- `pending_notifications` INSERT 시 DB Trigger → `pg_net`으로 신규 Edge Function `push-dispatch` 비동기 호출 → 해당 row 즉시 클레임(`claim_pending_notifications` RPC 재사용) → Expo Push API 발송 → `delivery_results` 저장 (기존 Phase A 로직과 동일한 RPC 재사용, 발송 부분만 Edge Function에 이식).
- 기존 Next.js `/api/cron/send-notifications`(Phase A+B)는 그대로 유지하되, 호출 주체를 GitHub Actions → **Supabase `pg_cron`**으로 교체. 주기는 5분 (Phase A는 트리거가 놓친 row를 훑는 안전망 역할, Phase B는 영수증 확인 담당이라 5분이면 충분).
- `.github/workflows/send-notifications.yml` 삭제 (schedule 트리거 제거). GitHub Actions 의존 완전 종료.
- dev(`epcsyfirxeqzjfnltcai`) 먼저 적용 → 동작 확인 → prod(`llawvidldrjjqwdbgfxh`) 적용.

## Out of Scope

- v1(20260616 계획)의 다른 부분(모바일 토큰 등록, 알림 설정 화면, 트리거 지점 5종 카테고리 등)은 변경 없음.
- 웹 push, broadcast 카테고리는 여전히 범위 밖.
- `pending_notifications` retention 정리 배치는 여전히 범위 밖.

## Relevant Files

- `apps/web/src/app/api/cron/send-notifications/route.ts` — Phase A/B 로직 원본 (수정 없음, 호출 주체만 바뀜)
- `apps/web/src/lib/notifications/sendPush.ts` — `expo-server-sdk` 기반 발송 (Node 전용)
- `.github/workflows/send-notifications.yml` — 삭제 대상
- `supabase/migrations/` — 신규 마이그레이션 (extension, trigger, pg_cron job)
- 신규: `supabase/functions/push-dispatch/index.ts` (Edge Function)

## Plan

1. **마이그레이션 1 — extension 활성화**: `pg_net`, `pg_cron` 활성화.
2. **신규 Edge Function `push-dispatch`**:
   - Deno/fetch 기반. `expo-server-sdk`는 Node 전용이라 쓸 수 없음 → Expo Push API(`https://exp.host/--/api/v2/push/send`)를 raw `fetch`로 직접 호출하는 최소 로직을 Edge Function 안에 작성.
   - **알려진 트레이드오프**: `sendPush.ts`(Node, cron용)와 Edge Function(Deno, 트리거용) 두 곳에 "Expo Push API 호출 + delivery_results 구성" 로직이 중복됨. 공유 패키지로 뽑기엔 런타임이 달라(Node vs Deno) 이번 범위에서는 중복을 그대로 두고 주석으로 명시. 추후 필요시 `packages/shared`에 순수 함수(요청 payload 구성 등)만 분리 검토.
   - 인증: 요청 헤더의 shared secret(`x-dispatch-secret`)을 `vault.decrypted_secrets`에 저장된 값과 비교. 불일치 시 401.
   - 로직: `claim_pending_notifications` RPC(limit 5, 기존 재사용) → 토큰 조회 → Expo 발송 → `update_notification_delivery_results` RPC(기존 재사용)로 저장. Phase B(영수증 확인)는 여기서 처리하지 않음 — pg_cron 쪽 Phase B가 담당.
3. **마이그레이션 2 — trigger**:
   - `pending_notifications`에 `AFTER INSERT FOR EACH ROW WHEN (NEW.status = 'pending')` 트리거.
   - 트리거 함수는 `pg_net.http_post`로 Edge Function URL 호출(fire-and-forget, 트랜잭션 커밋 후 비동기 실행되므로 INSERT 자체는 지연 없음).
   - **URL/secret은 프로젝트마다 다름** (dev/prod ref 상이) → 마이그레이션 파일에 하드코딩하지 않는다. `vault.create_secret`으로 `push_dispatch_url`, `push_dispatch_secret` 두 값을 저장하고, 트리거 함수는 `vault.decrypted_secrets`에서 읽어온다. 실제 값 주입은 마이그레이션 적용 후 **dev/prod 각각에서 별도로 MCP `execute_sql`로 수동 실행** (git에 실제 secret 값 커밋 안 함).
4. **마이그레이션 3 — pg_cron job**:
   - `cron.schedule('send-pending-notifications', '*/5 * * * *', $$ select net.http_post(...) $$)`로 기존 `/api/cron/send-notifications`를 5분마다 호출. 헤더에 기존 `CRON_SECRET`(별도 vault secret으로 저장) 포함.
5. **GitHub Actions 정리**: `.github/workflows/send-notifications.yml` 삭제. (수동 트리거가 필요하면 `workflow_dispatch`만 남기는 대신, pg_cron이 대체하므로 파일 자체 삭제로 충분 — 필요시 사용자 확인)
6. **dev 적용 → 확인 → prod 적용** (Supabase Migration Rule 준수).

## Verification

- dev에서 알림 트리거(예: 제보 승인)로 `pending_notifications`에 row 생성 → 수 초 내 `status`가 `pending → receipt_pending`으로 바뀌는지 확인 (트리거+Edge Function 동작).
- dev 실기기에서 push 실제 수신 확인 (지연 없이 즉시 도착하는지).
- pg_cron job이 5분마다 실행되는지 `cron.job_run_details`로 확인, Phase B(영수증 확인 → `sent`/`failed` 확정)가 정상 동작하는지 확인.
- Edge Function 인증 실패 케이스(잘못된 secret) 401 확인.
- 트리거 실패/Edge Function 다운 상황을 가정해 row를 `pending`으로 남겨두고 5분 후 pg_cron 안전망이 처리하는지 확인 (fallback 동작 검증).
- prod 적용 후 동일 시나리오 1회 재확인.
- `.github/workflows/send-notifications.yml` 삭제 후 Actions 탭에 해당 스케줄 실행이 더 이상 생성되지 않는지 확인.

## Risks / Questions

- **pg_net 비동기 실행 신뢰성**: `pg_net`은 트랜잭션 커밋 후 백그라운드 워커가 처리 — 워커가 밀리면 지연 가능. 다만 폴링 주기(기존 1분~2시간 불규칙)보다는 훨씬 나음. 완전한 실시간 보장은 아니고 "수 초 내" 목표.
- **Edge Function cold start**: 트래픽이 드문 편이라 cold start로 인한 수백 ms~1-2초 지연 가능성 있음 — 실사용상 문제 없는 수준으로 판단되나 verification에서 확인.
- **secret 수동 주입 단계**: dev/prod 각각 마이그레이션 적용 후 vault secret 값을 수동으로 넣어야 함 — 잊으면 트리거가 조용히 실패(에러는 나되 알림이 안 감). verification에 명시적으로 포함.
- **비용**: Edge Function 호출 free tier 월 50만 건, pg_cron/pg_net은 Postgres 기능이라 추가 과금 없음. 현재 트래픽 규모에서 무료 범위 내.
- **GitHub Actions 워크플로우 삭제**: 되돌리기 쉬운 변경(git revert)이지만 "삭제" 자체는 파괴적 액션 카테고리라 사용자 확인 후 진행.

## Adversarial Review

codex 검토에서 critical 8건, major 6건 발견. 핵심:

1. **claim 로직 불일치** — row-specific 즉시 클레임은 기존 `claim_pending_notifications`(전역 배치, id 미지정)와 안 맞음. backlog 있으면 새 row가 실시간 처리 안 됨.
2. **fan-out 폭탄** — `FOR EACH ROW` 트리거는 위시리스트 수백~수천 row INSERT 시 그만큼 호출 발생.
3. Edge Function 배포/인증/secrets 설계 누락 (verify_jwt, runtime secrets).
4. `pg_net` 기본 timeout(2초) vs Edge Function 동기 처리(Expo 발송+DB 갱신) 불일치.
5. Vault 활성화 자체가 마이그레이션에 없음.
6. 트리거 함수 예외가 원본 INSERT를 깨뜨릴 수 있음 — 예외 처리 정책 필요.
7. dev/prod URL·secret 하드코딩 위험, 확인 게이트/rollback 부족.
8. Node(`sendPush.ts`)/Deno(Edge Function) 중복 로직 — `delivery_results` shape drift 위험.

## Final Plan

**설계 변경 (Edge Function 제거, 대신 기존 Next.js 엔드포인트를 DB 트리거가 직접 호출)**

Edge Function을 새로 만들어 Expo 발송 로직을 Deno로 재구현하는 대신, DB 트리거가 **기존 `/api/cron/send-notifications`를 그대로 호출**하도록 설계 변경. 이렇게 하면:

- 이슈 #1(claim 불일치) 해결 — 같은 엔드포인트, 같은 배치 claim RPC를 그대로 씀. 트리거는 "지금 실행해" 신호만 줄 뿐, 처리 로직은 100% 재사용.
- 이슈 #3, #8 해결 — Edge Function 자체가 없으니 배포/인증/Deno 중복 구현 문제 소멸.
- 이슈 #4 완화 — `pg_net.http_post`는 애초에 비동기(fire-and-forget)라 응답을 기다리지 않음. 오래 걸려도 트랜잭션에 영향 없음. GitHub Actions가 지금도 동일한 방식(curl 후 대기 안 함)으로 호출 중이라 새로운 리스크 아님.

**트리거 설계 (이슈 #2 해결)**

- `AFTER INSERT ON pending_notifications FOR EACH STATEMENT` (row 아님) — fan-out으로 수천 row가 한 INSERT 문으로 들어와도 트리거는 1번만 발동.
- 트리거 함수는 `BEGIN ... EXCEPTION WHEN OTHERS THEN NULL; END`로 감싸 예외를 삼킴 (이슈 #6 해결) — Vault 조회 실패/네트워크 오류가 있어도 원본 INSERT는 항상 성공.
- **디바운스**: 매분 여러 INSERT가 있을 수 있으므로, 트리거는 단순 실행이 아니라 "마지막 dispatch로부터 3초 이내면 스킵" 정도의 최소 가드를 추가 (같은 세션 내 advisory lock 또는 별도 `last_dispatch_at` 테이블로 처리). 과호출 방지.

**Secret/URL 관리 (이슈 #5, #7 해결)**

- 마이그레이션에 `create extension if not exists supabase_vault;` 포함 (dev에 이미 설치돼 있지만 명시).
- 기존 `CRON_SECRET`을 재사용하지 않고, DB 트리거 전용 새 secret `DB_CRON_SECRET` 발급 → `route.ts`의 `verifyCronAuth`를 `token === CRON_SECRET || token === DB_CRON_SECRET` 형태로 확장 (기존 GitHub Actions cron secret과 분리 — 서로 영향 없음).
- dev/prod 각각 Vault에 `push_trigger_url`(해당 환경의 배포 URL), `db_cron_secret` 저장. **git에 실제 값 커밋 안 함** — 마이그레이션 파일은 트리거 함수 구조만 정의하고, 실제 secret/URL 값은 적용 후 MCP `execute_sql`로 프로젝트별 수동 주입.
- URL은 사용자 확인 후 Vercel 프로젝트에서 조회(비민감 정보), secret 값은 새로 생성해 사용자에게 Vercel env 등록을 요청.

**pg_cron 안전망 (기존 계획 유지)**

- `cron.schedule('send-pending-notifications', '*/5 * * * *', ...)`로 동일 엔드포인트를 5분마다 호출 — 트리거가 실패/누락한 row를 훑는 안전망 + Phase B(영수증 확인) 담당.
- `cron.job_run_details` + `net._http_response`(요청 enqueue 성공과 실제 HTTP 응답 코드는 별개이므로 둘 다 확인) + Vercel 함수 로그로 검증.

**카테고리 확장 반영 (major #3)**

- 현재 DB에는 v1의 5종 외 `wishlist_product_update`, `product_wishlist_restock`이 이미 존재 — 이번 작업은 트리거 발동 조건에 카테고리 화이트리스트를 두지 않고 `status='pending'`이면 전부 대상으로 하여 자동으로 커버 (카테고리 목록을 하드코딩하지 않음).

**Lease 경합 (major #4)**

- `update_notification_delivery_results` RPC가 `WHERE id = $1`만 쓰는 문제 — 트리거 즉시 호출과 5분 pg_cron 안전망이 겹칠 가능성은 낮지만(트리거가 먼저 처리하면 status가 `pending`이 아니게 되어 안전망이 재클레임 안 함 — `claim_pending_notifications`가 이미 `FOR UPDATE SKIP LOCKED` + status 조건으로 걸러냄), 별도 RPC 수정 없이 기존 SKIP LOCKED 메커니즘으로 충분히 방어됨을 확인. 코드 변경 불필요.

**확인 게이트 / Rollback**

- dev 마이그레이션 적용 전: 사용자에게 dev 적용 확인.
- prod 적용 전: 별도로 재확인 (CLAUDE.md 마이그레이션 규칙).
- `.github/workflows/send-notifications.yml` 삭제는 dev/prod 양쪽 검증 끝난 뒤, 별도로 사용자 확인 후 진행 (파괴적 변경).
- Rollback 절차 문서화: `drop trigger`, `select cron.unschedule('send-pending-notifications')`, workflow 파일 `git revert`.

**실행 순서**

1. dev 프로젝트에 `DB_CRON_SECRET` 생성 (내가 랜덤 생성) → 사용자에게 Vercel dev 환경변수 등록 요청.
2. `route.ts`의 `verifyCronAuth`에 `DB_CRON_SECRET` 지원 추가 (코드 변경, PR 아님 — 이 브랜치에 커밋).
3. dev 마이그레이션 적용: extension, statement-level trigger(예외 처리+디바운스 포함), pg_cron job.
4. dev Vault에 URL/secret 수동 주입 (execute_sql).
5. dev에서 실제 알림 트리거 → 수 초 내 발송 확인 (Verification 섹션 기준).
6. 문제 없으면 사용자 확인 받고 prod 동일 적용.
7. 안정화 확인 후 사용자 확인 받고 GitHub Actions 워크플로우 삭제.
