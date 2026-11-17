# 카테고리 상세 필터와 결과 바 정리

## Request
카테고리 상세 필터와 상단 결과 바를 기존 앱 디자인에 맞춘다.

## Scope
카테고리·시리즈 상품 목록이 공유하는 필터 칩, 적용된 값과 초기화, 결과 수와 정렬의 시각 표현.

## Out of Scope
상품 행, 필터 시트, 뒤로가기 헤더와 API·정렬 로직.

## Relevant Files
- `apps/mobile/components/organisms/browse/BrowseProductList.tsx`
- `apps/mobile/components/molecules/BrowseChip.tsx`
- Notion §15-2 및 §17, Penpot 카테고리 상품 목록과 시리즈 전체 목록 보드.

## Plan
기본 필터는 기존 32px 회색 BrowseChip을 쓰고, 선택 시 공용 핑크 배경과 글씨를 쓴다. 열기·해제·초기화는 Ionicons로 표현한다. 결과 바는 흰 바탕과 얇은 구분선으로 정리하고, 정렬은 기존 순환 동작에 맞는 아이콘을 표시한다.

## Verification
Penpot의 375px 보드와 색·간격·위계를 대조한다. 진입 축 제외, 적용·제거·초기화와 정렬 순환이 유지되는지 검토하고 모바일 lint와 타입 검사를 실행한다.

## Risks / Questions
세 칩의 현지화 폭은 달라질 수 있어 기존 가로 스크롤을 유지한다. 공용 칩의 아이콘은 선택 사항이며 기존 시리즈 목록 호출부는 그대로 사용한다.

## Adversarial Review
상품 행까지 바꾸면 한 화면의 시각 피드백이 목록 전체 변경으로 확대된다. 공유 화면의 상단 컨트롤만 수정하고 표시 순서와 상태 동작을 유지한다. 정렬에는 메뉴를 뜻하는 아래 화살표 대신 순환 조작에 맞는 아이콘을 사용한다.

## Final Plan
Penpot 보드에서 공용 칩의 색과 간격을 먼저 반영하고, 코드와 Notion §17을 같은 규격으로 맞춘다.
