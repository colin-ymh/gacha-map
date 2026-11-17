# 둘러보기 상단 바로가기 제거

## Request
모바일 둘러보기 탭 검색창 아래의 큰 이미지 카드 줄을 제거한다.

## Scope
검색창 아래에서 좌측 분류와 우측 썸네일 목록을 바로 시작한다. 오른쪽 제목 고정과 분류 탭 이동을 유지한다.

## Out of Scope
검색 오버레이의 바로가기, 전체 목록, 이미지 데이터 및 API.

## Relevant Files
- `apps/mobile/app/(tabs)/browse.view.tsx`
- `apps/mobile/components/organisms/search/GachaBrowseSections.tsx`
- Notion 가챠 카테고리·시리즈 탐색 기획, Penpot 둘러보기 개선 보드.

## Plan
Penpot에서 바로가기 레이어를 숨기고 본문을 검색창 아래로 이동한다. 탭 경로에서 카드와 레일 이동 애니메이션을 제거하고, 검색 오버레이 경로의 카드 렌더링을 유지한다.

## Verification
탭 경로의 첫 제목이 인덱스 0에 있고 다음 제목들이 두 칸 간격인지, 마지막 분류의 하단 여백 계산이 유지되는지, 기본 검색 경로가 기존 카드를 렌더링하는지 검토한다. 모바일 lint·타입 검사와 Penpot 위치를 확인한다.

## Risks / Questions
제목 인덱스에 기존 카드 줄의 오프셋을 남기면 제목 대신 항목 목록이 고정될 수 있다.

## Adversarial Review
제목과 행은 직접 자식으로 유지한다. 분류 탭 이동과 수동 스크롤 추적은 기존 onLayout 좌표를 계속 사용하고, 첫 분류의 오프셋 0을 허용한다.

## Final Plan
Penpot 배치를 먼저 확인하고 탭의 고정 섹션 경로에서만 카드와 관련 측정을 제거한다. 검색 오버레이의 카드와 탭의 40×40 썸네일을 대조한다.
