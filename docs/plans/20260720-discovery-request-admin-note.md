# 수집큐 needs_review 2건 처리 + 콜렉터 요청 구조

## Request

admin `제보&수집큐` 페이지의 needs_review 2건이 사용자 기억으로는 이미 매칭된 건인데 admin에서 처리할 방법이 없음. 조사 결과 두 건 다 실제로는 처리됐지만 `gacha_product_observations.status`가 갱신되지 않는 dead 필드라 큐에 영원히 남아있는 것으로 확인. 사용자는 이번 2건을 콜렉터(gacha-collector, 별도 프로젝트) 핸드오프 문서로 정리하고, 앞으로 재사용 가능하도록 admin이 discovery_request에 노트를 남기고 콜렉터 재조사 큐로 되돌릴 수 있는 구조를 원함.

## Scope

1. **핸드오프 문서** (`docs/collector-handoff/20260720-observation-followups.md`): 2건의 원본 데이터 + 요청사항을 콜렉터 세션에 붙여넣을 수 있는 형태로 정리.
   - Case 1 (프리렌 카타즌, `573b09b3`): 자동매칭 신뢰도 개선 요청.
   - Case 2 (닥터스톤 카타즌, `3c6f2204`): 카탈로그 미보유 신상품 조사 요청.
2. **gacha-map 재사용 구조**:
   - `gacha_product_discovery_requests.admin_note text` 컬럼 추가.
   - PATCH API에 `admin_note` 지원.
   - admin UI(`DrRow`)에 노트 입력 + "콜렉터 재조사 요청" 버튼 (`status: pending`, `admin_note` 세팅).
   - GET 응답에 `admin_note` 포함.

## Out of Scope

- `gacha_product_observations.status` 자동 동기화 버그 픽스.
- 콜렉터(외부 프로젝트)가 실제로 `admin_note`를 읽어서 활용하도록 만드는 작업.
- `status='hidden'` user_manual 상품 검토/승격 워크플로우 신설.
- 이번 2건 `gacha_product_observations.status` 수동 DB 정정.

## Relevant Files

- `supabase/migrations/20260720_discovery_requests_admin_note.sql` (신규)
- `apps/web/src/app/api/admin/discovery-requests/route.ts` (GET select, PatchBody, PATCH update)
- `apps/web/src/app/[locale]/admin/observations/page.tsx` (`DrRow` 컴포넌트, 311행~)
- `docs/collector-handoff/20260720-observation-followups.md` (신규)

## Plan

1. 마이그레이션 작성 → dev(`epcsyfirxeqzjfnltcai`) 적용 → 확인.
2. `discovery-requests/route.ts`에 `admin_note` 배선.
3. `DrRow`에 노트 입력 + 재조사 요청 버튼 (`apps/web/src/styles/color.ts` 상수 재사용).
4. 이번 2건에 실제로 노트 남기고 재조사 요청 눌러서 동작 확인.
5. 핸드오프 문서 작성.
6. dev 확인 후 prod(`llawvidldrjjqwdbgfxh`)에도 동일 마이그레이션 적용 (main 머지 전 필수).

## Verification

- 마이그레이션 후 `information_schema.columns`로 컬럼 존재 확인 (dev, prod).
- admin UI에서 노트 입력 → 재조사 요청 → DB에서 `status='pending'`, `admin_note` 반영 확인.
- PATCH API: `admin_note`만 보내는 요청 / `status`+`admin_note` 함께 보내는 요청 둘 다 확인, 기존 `error_message`/`candidate_urls` 필드 회귀 없는지 확인.
- 핸드오프 문서가 콜렉터 세션에 그대로 붙여넣어도 이해 가능한 수준인지 재검토.

## Risks / Questions

- `admin_note`는 콜렉터가 실제로 읽지 않으면 효과 없음 — gacha-map 쪽은 구조/데이터 전달까지만 보장.
- `needs_review`/`no_match`/`failed`로 끝난 row를 다시 `pending`으로 되돌리면 콜렉터가 중복 조사하거나 `attempt_count`가 계속 쌓일 수 있음 — 콜렉터 쪽 재시도 로직 미확인 상태. 문서에 재큐잉 사실을 명시.
- DB 스키마 변경 포함 — `apply_migration`은 메인 세션에서만, dev 먼저 → 확인 → prod 순서 필수.

## Adversarial Review

codex 리뷰 결과 (요약):

- **P1** dev/prod 마이그레이션 적용 + 실제 2건 재큐잉은 사전 승인 게이트 필요 (운영 데이터 변경).
- **P1** `DrRow`는 모든 status에서 렌더링됨 — 재조사 요청 버튼을 `needs_review`/`no_match`/`failed`에서만 노출해야 함. 안 그러면 `pending`/`searching`/`imported` 건도 재큐잉 가능해짐.
- **P1** 현재 `patch()`(page.tsx:330)는 `res.ok` 체크 없이 성공 처리. API PATCH(route.ts:84)도 영향 row 0건이어도 `{ok:true}` 반환. 실패/row 없음 케이스 처리 추가 필요.
- **P2** `admin_note` 검증 규칙 필요: string trim, 빈 문자열→null, 최대 길이 제한 (기존 `shop-applications/[id]/route.ts:41` 패턴 참고).
- **P2** 재큐잉 시 기존 필드(`attempt_count`, `error_message`, `candidate_urls`, `matched_product_id`) 처리 기준 필요.
- **P2** UI 변경은 Notion spec → Penpot 순서 규칙 대상인지 검토 필요 — 단, 이 페이지는 기존에도 `ErrInput`(디자인 없는 ad-hoc textarea, page.tsx:265) 같은 비-Penpot 어드민 내부 도구 패턴을 이미 쓰고 있고, CLAUDE.md 자체가 "웹은 어드민/샵관리자 도구로 전환 중, 신규 웹 작업은 어드민 스코프 기본 가정"이라고 명시함. 이번 추가도 동일 패턴(내부 운영 도구)이라 예외로 진행하되, 사용자에게 명시적으로 확인.

반영 결정:

1. 재조사 요청 버튼은 `status in ('needs_review','no_match','failed')`일 때만 노출.
2. `patch()`에 `res.ok` 체크 + 실패 시 알림(alert 또는 에러 상태 표시) 추가. API PATCH는 `.update(...).eq("id", id).select("id")`로 실제 갱신 row 확인, 없으면 404 반환.
3. `admin_note`: string이 아니면 무시, trim, 빈 문자열은 null로 저장, 최대 1000자 제한(초과 시 400).
4. 재큐잉 시 `error_message`는 null로 초기화(새 시도이므로), `attempt_count`/`candidate_urls`/`matched_product_id`는 그대로 보존(콜렉터가 이전 시도 맥락 참고 가능하도록, 콜렉터 로직을 모르므로 임의로 건드리지 않음).
5. UI는 admin 내부 도구 예외로 진행(Penpot 스킵) — 사용자 확인 완료 후 코드 작업 진행.
6. dev 마이그레이션 적용까지는 바로 진행, **prod 마이그레이션 적용과 실제 2건 재큐잉(운영 데이터 변경)은 코드 완성 후 별도로 사용자 승인 받고 진행**.

## Final Plan

1. 마이그레이션: `supabase/migrations/20260720_discovery_requests_admin_note.sql` — `ALTER TABLE gacha_product_discovery_requests ADD COLUMN admin_note text;` → dev(`epcsyfirxeqzjfnltcai`) 적용 → 컬럼 확인.
2. `apps/web/src/app/api/admin/discovery-requests/route.ts`:
   - GET select에 `admin_note` 추가.
   - `PatchBody`에 `admin_note?: string | null` 추가.
   - PATCH 핸들러: `admin_note`가 string이면 trim 후 빈 값→null, 1000자 초과 시 400 에러. `status`가 `pending`으로 재큐잉되는 경우 `error_message: null`도 같이 세팅(재큐잉 전용 분기 또는 클라이언트가 명시적으로 `error_message: null` 전달).
   - `.update(update).eq("id", id).select("id").maybeSingle()`로 변경, row 없으면 404.
3. `apps/web/src/app/[locale]/admin/observations/page.tsx` `DrRow`:
   - `admin_note` 표시용 텍스트 + 편집 textarea (기존 `ErrInput` 스타일 재사용, 색상은 `color.ts` 상수만 사용).
   - "콜렉터 재조사 요청" 버튼: `dr.status`가 `needs_review`/`no_match`/`failed`일 때만 렌더링. 클릭 시 `patch({ status: "pending", admin_note: note, error_message: null })`.
   - `patch()` 함수에 `res.ok` 체크 추가, 실패 시 에러 표시(간단히 `alert` 또는 기존 에러 UI 패턴 확인 후 재사용).
4. 코드 완성 후 typecheck/lint 실행.
5. **여기서 중단하고 사용자에게 확인**: (a) prod 마이그레이션 적용 여부, (b) 실제 2건(`3c6f2204`/`573b09b3`에 연결된 discovery_requests row)을 실제로 재큐잉할지 여부 — 재큐잉하면 콜렉터가 다시 조사를 시도하게 됨(운영 영향).
6. 승인 시: prod 마이그레이션 적용 → 실제 2건 재큐잉(관리자 UI 또는 직접 확인 후 진행) → 핸드오프 문서(`docs/collector-handoff/20260720-observation-followups.md`) 작성.

## Verification

- 마이그레이션 후 `information_schema.columns`로 컬럼 존재 확인 (dev, 이후 prod).
- PATCH API: 정상 케이스(`admin_note`만 / `status`+`admin_note` 함께) + 실패 케이스(존재하지 않는 id → 404, 1001자 노트 → 400) 확인.
- UI: `needs_review`/`no_match`/`failed` 상태에서만 재조사 버튼 노출되는지, 다른 상태에서는 안 보이는지 확인.
- 재큐잉 후 DB에서 `status='pending'`, `admin_note` 반영, `error_message=null` 확인, `attempt_count`/`candidate_urls`/`matched_product_id`는 그대로인지 확인.
- 핸드오프 문서가 콜렉터 세션에 그대로 붙여넣어도 이해 가능한지 재검토.
