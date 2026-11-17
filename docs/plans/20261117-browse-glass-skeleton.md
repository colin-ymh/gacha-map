# 둘러보기 선택 강조와 스켈레톤

## Request
왼쪽의 선택 분류에 메인 분홍색과 LiquidGlass를 적용하고, 카테고리 탭 로딩 상태를 스켈레톤으로 표시한다.

## Scope
둘러보기 탭의 선택 버튼과 시리즈·제품 라인·상품 종류·소재·장르 로딩 상태. 검색창은 그대로 표시한다.

## Out of Scope
검색 오버레이, 전체 목록, 데이터 API와 대표 이미지 선정.

## Relevant Files
- `apps/mobile/components/organisms/search/GachaBrowseSections.tsx`
- `apps/mobile/components/molecules/BrowseListRow.tsx`
- 모바일 메시지 카탈로그, Notion 기획 §3 및 Penpot 둘러보기 보드.

## Plan
선택 버튼에 공용 LiquidGlass와 메인 분홍 반투명 틴트를 사용하고, 기존 진한 글씨로 대비를 확보한다. 스켈레톤은 104px 분류, 섹션 제목, 40px 썸네일과 텍스트 두 줄 형태를 재현한다.

## Verification
다섯 요청의 로딩 상태, 오류 및 재시도, 섹션 구조와 선택 접근성, 네 언어 번역, 모바일 lint·타입 검사, Penpot과 실제 간격을 대조한다.

## Risks / Questions
일부 요청이 늦어도 분류나 섹션 좌표가 로딩 중에 바뀌지 않도록 처음에 함께 기다린다. 로드가 끝나면 응답을 받은 분류를 표시하고, 전체 실패 시 다시 시도할 수 있게 한다.

## Adversarial Review
스켈레톤은 접근성 트리에서 도형이 개별로 탐색되지 않도록 하나의 로딩 상태로 제공한다. 글래스 레이어는 터치를 가로채지 않으며, 기존 선택 버튼이 높이와 접근성 상태를 유지한다. 검색 오버레이는 기존 분기에서만 렌더링한다.

## Final Plan
Penpot에서 선택 강조와 로딩 보드를 확인한 후 공용 LiquidGlass와 SkeletonBone으로 구현한다. 정적 검사와 시각 검증 결과를 보고한다.
