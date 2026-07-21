# 신상 가챠 메인화면 노출 (+ 콜렉터 주간 수집 전환)

## Request

모바일 홈(`apps/mobile/app/(tabs)/index.tsx`)에 "N월 O째주 신상 가챠" 섹션 추가. 콜렉터 상품 파이프라인을 주간화해서 "이번 주 신상" 배치가 자연스럽게 나오도록 함.

## Scope

1. **gacha-collector 핸드오프 문서** (`docs/collector-handoff/20260720-weekly-product-collection.md`, 완료) — guard job 분리 방법 문서화. 실제 워크플로우 수정은 사용자가 별도 세션에서 진행.
2. **gacha-map RPC**: `get_new_arrival_gacha()` 신규 — `get_daily_featured_gacha` 패턴 재사용(SECURITY DEFINER, search_path, GRANT EXECUTE, NOTIFY pgrst). 조건: status=active, source_type=official, official_image_url not null, active variant 존재. 오늘 `daily_featured_gacha`에 뽑힌 상품 제외. 윈도우: KST 기준 latest(created_at) - 6일(6개 미만이면 -13일로 확장). `window_start` 반환.
3. **API**: `apps/web/src/app/api/gacha-products/route.ts`에 `sort=new_arrivals` 분기. 응답 `{ products, total, offset, limit, label_month, label_week_of_month }`.
4. **모바일**: i18n 라벨 템플릿(ko/en/ja/zh) + `useNewArrivalGacha.ts`(캐싱 없음) + `index.tsx`에 오늘의 가챠 바로 아래 섹션 삽입(GachaRollCard/캐러셀/도트 패턴 재사용).

## Out of Scope

- release_week_text 파싱, 실시간 webhook, 샵 파이프라인 주기 변경, 오늘의 가챠 로직 변경.

## Relevant Files

- `supabase/migrations/2026072X_get_new_arrival_gacha.sql` (신규)
- `apps/web/src/app/api/gacha-products/route.ts`
- `apps/mobile/hooks/useNewArrivalGacha.ts` (신규)
- `apps/mobile/app/(tabs)/index.tsx`
- `apps/mobile/messages/{ko,en,ja,zh}.json`

## Plan

1. RPC 마이그레이션 → dev 적용 → SQL 직접 검증(윈도우 확장, variant 조건, 중복 제외).
2. `route.ts`에 `sort=new_arrivals` 배선.
3. i18n 키 + 훅 + `index.tsx` 섹션.
4. typecheck/lint.
5. Expo 앱 실기기 확인.
6. dev 검증 끝나면 prod 마이그레이션 적용(사용자 승인 후).

## Verification

- RPC 윈도우 확장 로직(6개 미만 → 14일) SQL로 직접 확인.
- API 응답 계약 확인(0건일 때 null 라벨).
- Expo 앱에서 실제 렌더링, 캐러셀/도트/라벨 확인.

## Risks / Questions

- Notion 미문서화 상태로 진행(사용자 확인 완료, docs/plans 상위 대화 참고).
- 홈 대시보드가 Notion 화면목록에 없음 — 후속으로 문서화 제안.

## Adversarial Review

1차 codex 검토 완료(RPC 권한, API 계약, variant 조건, 중복 제외, 윈도우/라벨 정의, 콜렉터 manual dispatch 시맨틱, 캐시 미러링 부적합 지적) — 전부 반영해서 아래 Final Plan에 확정 사항으로 포함. 상세 내역은 `/Users/colin/.claude/plans/encapsulated-finding-taco.md`(세션 plan 파일) 참고.

**2차 구현 검증(codex, 코드 작성 후):** 실제 버그 1건 발견 — `get_new_arrival_gacha()`에서 "오늘의 가챠 제외" 조건이 최종 SELECT에만 있고 `latest`/7일 카운트 계산에는 빠져 있어서, 오늘의 가챠로 이미 뽑힌 상품이 최신이거나 7일 윈도우 카운트에 영향을 주는 경우 14일 확장 판단이 어긋날 수 있었음. `eligible` CTE와 `v_count_7` 쿼리에도 동일한 제외 조건 추가해서 수정, dev 재배포 후 회귀 없음 확인, prod에도 수정본 적용 완료. 나머지(권한/API 계약/i18n/캐시 없음/섹션 숨김 조건)는 전부 계획대로 구현됨. RN UI는 이 환경에 react-native-web/시뮬레이터가 없어서 스크린샷으로 시각 검증은 못 함(RPC/API는 실제 dev·prod 데이터로 end-to-end 확인).

## Final Plan

위 Plan 섹션과 동일. RPC/API/모바일 구현 시 아래 확정 사항 반드시 반영:

- RPC: `SECURITY DEFINER`, 고정 `search_path`, `GRANT EXECUTE ... TO anon, authenticated`, 끝에 `NOTIFY pgrst, 'reload schema'`.
- RPC 조건: `status='active' AND source_type='official' AND official_image_url IS NOT NULL` + active variant 존재(`get_daily_featured_gacha` 168행 조건 재사용) + 오늘 `daily_featured_gacha`에 이미 뽑힌 product 제외.
- 윈도우: KST 자정 기준 `latest := max(created_at)`, `[latest-6d, latest]` inclusive, 6개 미만이면 `[latest-13d, latest]`로 확장, 그래도 0건이면 빈 배열.
- API 응답: `{ products, total, offset, limit, label_month, label_week_of_month }`. `week_of_month = floor((day-1)/7)+1` (window_start의 KST 일자 기준). 0건이면 label 필드 null.
- 라벨은 백엔드가 숫자만 내려주고 프론트가 i18n 템플릿으로 렌더링(한국어 하드코딩 금지 — en/ja/zh 화면 오염 방지).
- 모바일 훅은 `useFeaturedGacha`와 달리 로컬 캐싱 없이 단순 fetch.
- 홈 화면 신규 섹션 배치: "오늘의 가챠"(423-506행) 바로 아래, "근처 샵"(508행) 위.
