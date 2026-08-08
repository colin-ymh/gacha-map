# 신상 가챠: featured_week_start 기반으로 전환

## Request

gacha-collector 쪽에서 `gacha_products`에 발매 스케줄 정규화 필드(`release_start_date`, `release_end_date`, `release_precision`, `featured_week_start`)를 추가하는 마이그레이션을 만듦. 어제 shipping한 `get_new_arrival_gacha`(created_at 롤링 윈도우 방식)를 이 새 필드 기반으로 교체.

## Scope

1. **스키마**: collector 마이그레이션(`/Users/colin/Git/gacha-collector/supabase/migrations/20260721_add_gacha_product_release_schedule.sql`)을 gacha-map `supabase/migrations/`에 복사, dev→prod 순으로 적용. 적용 전 dry-run SELECT로 정규화 로직을 실제 데이터에 검증(사용자가 준 통계와 정확히 일치: prod 2026-07 기준 week 116/month 82/mid 1/early 1 = 200).
2. **RPC 재작성**: `get_new_arrival_gacha()` — `featured_week_start = date_trunc('week', p_date)::date` 기준으로 필터. 기존 7일/14일 확장 로직 제거(collector가 이미 월단위 상품을 주별로 분산 배정해서 물량 안정성을 보장하므로 불필요). 기존 3-파라미터 오버로드는 dev/prod 둘 다 DROP.
3. **API**: `sort=new_arrivals` 응답에서 `label_month`/`label_week_of_month` 제거(더 이상 의미 없음) — `release_start_date`/`release_end_date`/`release_precision`이 상품 필드로 자연스럽게 pass-through.
4. **타입**: `packages/shared`, `apps/web/src/types`에 `GachaProductReleasePrecision` + 새 필드 추가.
5. **모바일**: `useNewArrivalGacha` 훅에서 label 관련 상태 제거. `lib/releaseLabel.ts` 신규 — precision별 i18n key/params 매핑 순수 함수. `GachaRollCard`에 `releaseLabel?` optional prop 추가(오늘의 가챠 카드는 영향 없음). 섹션 제목은 고정 "이번 주 신상 가챠"로 변경(더 이상 계산 불필요). 4개 locale에 `roll.releaseLabel.*` 키 추가.

## Out of Scope

- gacha-collector 쪽 코드/마이그레이션 작성 — 이미 그쪽에서 완료된 것을 가져다 씀.
- release_week_text 원문 파싱 로직 자체를 gacha-map에서 재작성 — 정규화는 전적으로 collector 책임, gacha-map은 결과 필드만 소비.

## Relevant Files

- `supabase/migrations/20260721_add_gacha_product_release_schedule.sql` (collector 원본 복사)
- `supabase/migrations/20260721_get_new_arrival_gacha_featured_week.sql` (RPC 재작성)
- `apps/web/src/app/api/gacha-products/route.ts`
- `packages/shared/src/types/index.ts`, `apps/web/src/types/index.ts`
- `apps/mobile/hooks/useNewArrivalGacha.ts`, `apps/mobile/lib/releaseLabel.ts` (신규)
- `apps/mobile/components/molecules/gacha/GachaRollCard.tsx`
- `apps/mobile/app/(tabs)/index.tsx`
- `apps/mobile/messages/{ko,en,ja,zh}.json`

## Plan / Verification

1. dev/prod 컬럼 존재 여부 사전 확인(사용자 주의사항 그대로 이행) — 적용 전엔 둘 다 없었음 확인.
2. dry-run SELECT로 정규화 로직 검증 → dev 적용 → 분포 확인 → 사용자 확인 후 prod 적용.
3. RPC 재작성 → dev 적용/검증 → prod 적용/검증(이번 주 51건).
4. API/타입/모바일 코드 수정 → 웹 tsc(파일 저장 훅이 자동 실행)/모바일 tsc·eslint 확인 → dev API 실제 curl로 응답 스키마 확인(release_precision/release_start_date 포함, label_month 필드 제거 확인).
5. codex 2차 검증 진행 중.

## Risks / Questions

- RN UI 시각 검증 불가(환경 제약, 어제와 동일).

## 2차 codex 검증 결과 및 수정

codex가 실제 버그 3건 발견:

1. **prod가 gacha-map이 적용한 마이그레이션과 다른 걸로 확인됨.** gacha-collector 저장소의 마이그레이션 파일이 내가 최초 복사한 이후 갱신됨(month-precision 분산 배정 해시가 1-hex digit → 2-hex digit 조합 방식으로 변경). 직접 쿼리로 확인한 결과 **prod는 이미 새 2-hex 공식으로 채워져 있었음**(gacha-map 세션이 아닌 다른 경로로 prod에 반영된 것으로 보임) — dev는 구버전(1-hex)에 머물러 있어서 dev/prod 불일치 상태였음. gacha-collector 최신 파일로 gacha-map 쪽 마이그레이션 파일 교체 + dev 재백필해서 prod와 동일한 값 나오는지 20건 샘플로 직접 대조 확인함.
2. **RPC 정렬이 month-precision 상품을 사실상 배제함.** `ORDER BY release_start_date DESC`를 쓰면 week-precision 상품(주 중 실제 날짜)이 month-precision 상품(항상 월 1일로 고정된 release_start_date)보다 항상 먼저 옴 — LIMIT 15에 걸려서 month 상품이 사실상 노출 안 됨(prod 실측: 이번 주 전체 33 week/2 month인데 상위 15개 전부 week였음). `get_daily_featured_gacha`와 동일한 패턴(`ORDER BY md5(p_date::text || id::text)`, 날짜별 결정적 셔플)으로 교체해서 precision 편향 없이 뽑히도록 수정. 수정 후 재확인: 전체 후보 35개 중 15개 뽑을 때 month가 안 걸리는 것도 확률상 정상 범위(2/35개뿐이라 32%가량은 안 뽑힘) — "안정적 물량"은 여기까진 보장되지만, month-precision 상품 중 실제로 이미지+variant 조건까지 만족하는 건 매우 적다는 것도 함께 확인(7월 전체 82개 중 이번 주 배정 2개뿐).
3. **3-arg RPC 오버로드 DROP이 마이그레이션 파일에 기록 안 됨.** 어제 만든 3-parameter 버전을 ad-hoc `apply_migration` 호출로만 지웠고 커�밋되는 `.sql` 파일엔 반영 안 해서, 마이그레이션을 처음부터 재생하면(fresh dev 등) 두 오버로드가 공존해서 PostgREST 호출이 모호해질 수 있었음. `DROP FUNCTION IF EXISTS ...(date,integer,integer)`를 마이그레이션 파일 본문에 포함시켜서 재현 가능하게 수정.

세 가지 다 dev 먼저 재적용/검증 → prod 재적용/검증 완료(단일 오버로드만 남은 것, 정렬 수정된 것 둘 다 prod에서 직접 재확인).
