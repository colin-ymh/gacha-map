# 둘러보기 상세 스켈레톤

## Request
카테고리·시리즈 상세에서 메타데이터와 상품 목록을 불러올 때 스켈레톤을 표시한다.

## Scope
두 상세 라우트의 제목, 카테고리 진입 축, 결과 수, 상품 첫 페이지 및 추가 페이지.

## Out of Scope
이미 스켈레톤이 있는 상품·샵·컬렉션 상세, 하위 시리즈 탐색, API 변경.

## Relevant Files
- `apps/mobile/app/browse/category/[id].tsx`
- `apps/mobile/app/browse/series/[id].tsx`
- `apps/mobile/components/organisms/browse/BrowseProductList.tsx`
- 모바일 번역, Notion §5·§7·§12, Penpot 상세 로딩 보드.

## Plan
상세 제목과 진입 축을 조회하는 동안 해당 부분의 자리표시자를 보여준다. 공용 상세 목록은 실제 56px 썸네일 행의 배치를 재사용한다. 첫 페이지는 전체 행, 추가 페이지는 목록 끝에만 스켈레톤을 표시한다.

## Verification
메타데이터가 상품보다 먼저/나중에 도착하는 경우, 오류와 빈 상태, 필터 변경, 다음 페이지 추가를 검토한다. Penpot 배치와 모바일 lint·타입 검사를 확인한다.

## Risks / Questions
카테고리 진입 축을 알기 전에 임시 필터를 노출하면 잘못된 축을 선택할 수 있다. 축 확정까지 칩 스켈레톤을 표시하고 상품 데이터는 병렬로 조회한다.

## Adversarial Review
제목 요청이 실패하면 제목 스켈레톤을 종료한다. 실제 0개와 조회 중을 구분하고, 추가 페이지를 불러올 때 이미 표시된 상품을 유지한다. 시리즈 진입 축은 이미 고정되어 있으므로 즉시 실제 칩을 보여준다.

## Final Plan
Penpot에 공용 상세 로딩 상태를 먼저 만들고, 두 상세 라우트와 공용 목록에 반영한다.
