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

(codex 검토 결과 대기)

## Final Plan

(codex 검토 반영 후 확정)
