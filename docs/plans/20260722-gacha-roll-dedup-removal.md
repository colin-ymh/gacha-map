# 가챠 뽑기 중복 강제 회피(soft-shuffle) 로직 제거

## Request

사용자 피드백: "가챠라는게 중복도 좀 나와줘야하는데, 지금 너무 억지로 중복을 피해가려는게 문제되는거같아. 물론 완벽한 랜덤이란 없겠지만 어떻게 해결할 수 있을까?"

가챠 뽑기 결과가 진짜 랜덤처럼 느껴지지 않고 인위적으로 다양성을 강제하는 느낌을 준다는 지적. 원인 로직을 제거/완화하는 계획.

## Scope

- `apps/web/src/app/api/gacha-products/[id]/roll/route.ts`의 "soft shuffle"(최근 뽑은 variant 최대 5개를 pool에서 제외) 로직 제거.
- 그에 딸린 `recentRolls` DB 쿼리 제거.
- 순수 균등분포(uniform random, `Math.random()`) 방식으로 복귀.

## Out of Scope

- rarity/weight/drop_rate 기반 확률 시스템 도입 (스키마 변경 필요, 별도 기획 필요 — 이번 요청은 "억지 중복회피 제거"이지 "확률 시스템 재설계"가 아님).
- product 단위 다양성 배지(`gacha_roll_variety`) 로직 변경 — 이건 variant 단위가 아닌 product 단위 트랙이라 이번 이슈와 무관, 그대로 둠.
- daily limit / roll-status 관련 로직 — 무관.

## Relevant Files

- `apps/web/src/app/api/gacha-products/[id]/roll/route.ts` (line 54-120대) — 수정 대상. 현재 `Promise.all`로 todayCount/variants/recentRolls 3개 쿼리를 병렬 조회하고, `recentRolls`로 만든 `recentIds`를 pool에서 필터링한 뒤 그 pool에서 `Math.random()` 선택.
- `apps/web/src/lib/gacha/rollStats.ts` — 변경 불필요 (모든 roll 기록을 독립적으로 집계하는 통계 로직이라 영향 없음).
- `packages/shared/src/types/index.ts`의 `GachaProductVariant` — 참고만, 변경 없음 (weight/rarity 필드 없음, 현재도 uniform random 전제).

## 배경 조사 요약

- soft-shuffle은 `3d0f404`(직전 1개만 제외)→`018cdc7`(최대 5개로 확장) 두 커밋으로 도입됨, 커밋 메시지는 "재뽑기 지역성 개선".
- variant(같은 상품 안 개별 아이템) 개수는 실제로 적음(테스트 mock 5개, 통상 3~8개 추정). `excludeCount = min(variants.length - 1, 5)`라서 variant 5~6개짜리 상품은 거의 전부를 제외 → 사실상 결정론적 순환 뽑기가 되어버림. 이게 "억지로 중복 회피"로 느껴지는 원인.
- `20260706_remove_gacha_roll_unique_constraint.sql`로 무제한 재뽑기가 허용된 상태라 이 왜곡이 사용자에게 바로 노출됨(연속으로 여러 번 뽑아보면 항상 "새 아이템"만 나오는 게 보임).
- 가중치/확률 필드는 DB에 없음 — 지금도 uniform random이라 "완전 제거"해도 통계적으로 더 복잡해지지 않음, 오히려 원래 의도한 순수 랜덤으로 되돌아감.

## Plan

1. `route.ts`의 `Promise.all` 3개 쿼리 중 `recentRolls` 쿼리(최근 5개 variant_id 조회) 제거.
2. soft-shuffle 필터링 블록(`let pool = ...`부터 `if (filtered.length > 0) pool = filtered;`까지) 삭제.
3. 최종 선택을 `variants[Math.floor(Math.random() * variants.length)]`로 직접 변경 (pool 변수 제거).
4. 중복 삽입 시 ephemeral 처리 분기(23505 unique constraint) 쪽은 이 로직과 무관하므로 손대지 않음.

## Verification

- `pnpm --filter web typecheck`, lint 통과 확인.
- 로컬에서 같은 product로 10~20회 연속 POST 호출 스크립트 실행 → variant_id 분포 확인, 연속 동일 결과가 자연스럽게 섞여 나오는지 확인(있어야 정상).
- 모바일 앱에서 실제로 여러 번 뽑아보고 결과창이 정상 동작하는지(연속 중복 시에도 애니메이션/결과 표시가 매번 명확히 갱신되는지) 확인.

## Risks / Questions

- 연속 동일 결과가 나올 때 "버튼이 안 눌린 줄" 착각할 수 있음 — 다만 이미 애니메이션(2.5초 회전) + 결과 카드가 매번 새로 마운트되는 구조라 시각적으로는 구분됨. UI 변경은 이번 스코프 아님.
- variant 개수가 매우 적은(예: 2개) 상품은 연속 중복 체감 빈도가 높아짐(50%) — 이건 실제 가챠도 마찬가지라 정상 동작으로 간주.

## Adversarial Review

**Codex 검토 결과: approve with changes.**

- 코드 영향 분석 확인: `recentRolls`는 soft-shuffle 블록에만, `pool`은 최종 선택에만 쓰임. `rollStats.ts`는 저장된 roll을 독립 집계하므로 영향 없음. `variants.length === 0` 가드가 이미 있어 `variants[Math.floor(...)]` 전환은 안전.
- **요구 변경 1 — 테스트 보강 필요**: 10~20회 POST로 분포 보는 건 smoke check일 뿐 회귀 방지가 안 됨. `Math.random`을 mock해서 "최근에 나온 variant도 다시 선택될 수 있음"을 결정적으로 검증하는 테스트 추가 필요 (예: variants A/B/C, 과거 recent가 C여도 random index가 C를 가리키면 C가 반환돼야 함). `recentRolls` 쿼리 자체가 사라졌는지도 query mock으로 확인.
- **요구 변경 2 — roll-status를 "무관"으로 단정하지 말 것**: `roll-status/route.ts`는 당일 기록이 있으면 `canRoll: false, reason: "already_rolled"`를 반환하는 기존 로직이 있음(이번 변경과 무관하게 이미 존재). 다른 클라이언트가 `canRoll`을 신뢰하면 "재뽑기 가능" UX와 충돌할 여지가 있는 기존 inconsistency — 이번 스코프에 포함하지 않되 known issue로 문서에 남겨야 함.
- **요구 변경 3 — "실제 가챠도 그렇다" 근거 톤 다운**: 앱의 uniform-with-replacement 모델은 타당하지만, 물리 캡슐 머신은 재고/비복원 추첨 요소가 있어 완전히 같은 모델은 아님. 무료·무제한 뽑기에서 연속 중복이 "랜덤답다"와 "버튼이 안 눌린 것 같다" 사이 UX 리스크가 있으므로, 결과 애니메이션/보유 개수 증가가 명확히 보이는지만 확인하면 충분.
- **요구 변경 4 — middle ground(직전 1개만 제외) 언급 명시**: PO가 "바로 직전 동일 결과만 싫다"고 말한 게 아니므로 pure uniform이 더 일관됨. 다만 3~8개짜리 variant 풀에서는 "직전 1개 제외"도 여전히 왜곡이 커서 채택 안 함 — 이 판단을 계획에 명시.
- `Math.random()`은 현재 코드 기준(서버사이드 free roll, 실머니/유료 재화/공식 확률 보장 없음) 허용 가능. 향후 유료 뽑기·rarity odds·보상성 컬렉션이 붙으면 `crypto.randomInt` + 감사 가능한 확률 테이블로 전환 필요 — Out of Scope로 명시.

## Final Plan

1. `route.ts`의 `Promise.all` 3개 쿼리 중 `recentRolls`(최근 5개 variant_id) 쿼리 제거.
2. soft-shuffle 필터링 블록(`let pool = ...` ~ `if (filtered.length > 0) pool = filtered;`) 삭제, `pool` 변수 제거.
3. 최종 선택을 `variants[Math.floor(Math.random() * variants.length)]`로 직접 변경.
4. (구현 시 변경) route.ts 전체를 mock하는 대신, 선택 로직을 `_utils.ts`의 순수 함수 `pickRandomVariant(variants)`로 추출 — 기존 `createSupabaseMock`이 테이블별 응답을 구분하지 못해 route 레벨 mock 비용이 컸음. `__tests__/_utils.test.ts`에서 `Math.random`을 mock해 마지막 인덱스(= "방금 뽑힌 variant"에 해당하는 자리)도 정상적으로 다시 선택됨을 검증. `recentRolls` 쿼리는 route.ts에서 심볼 자체가 삭제되어 컴파일 타임에 미참조가 증명됨(grep으로도 재확인).
5. 문서화: 이 커밋/PR 설명에 "roll-status의 `already_rolled` 판정 로직은 기존 동작이며 이번 변경과 무관, 알려진 잠재 UX 불일치로 남겨둠"을 명시.
6. Out of Scope 재확인: rarity/weight 필드, `crypto.randomInt` 전환 — 유료 뽑기 도입 시 별도 작업.

### Verification (최종)

- `pnpm --filter web typecheck`, lint 통과.
- 신규 mock 기반 단위 테스트 통과.
- 로컬에서 동일 product로 10~20회 연속 POST 실행 → 연속 동일 결과가 자연스럽게 섞여 나오는지 육안 확인(스모크 체크, 자동화 테스트를 대체하지 않음).
- 모바일 앱에서 실제 뽑기 여러 번 진행, 연속 중복 시에도 애니메이션/결과 카드가 매번 갱신되는지 확인.
