# 둘러보기 항목 대표 이미지

## Request
모바일 둘러보기 오른쪽 항목에 대표 이미지를 표시한다.

## Scope
시리즈와 카테고리 미리보기 행의 40×40 썸네일, 이미지가 없거나 실패했을 때의 표시, 긴 이름의 두 줄 배치.

## Out of Scope
상단 바로가기, 검색 오버레이, 전체 목록, 대표 이미지 선정 및 API.

## Relevant Files
- `apps/mobile/components/molecules/BrowseListRow.tsx`
- `apps/mobile/components/organisms/search/GachaBrowseSections.tsx`
- Notion 가챠 카테고리·시리즈 탐색 기획 §3 및 Penpot 모바일 둘러보기 개선 보드.

## Plan
Penpot에서 기존 행 안에 40×40 이미지와 간격 10을 배치한다. 공용 BrowseListRow의 둘러보기 행 스타일로 적용하고 API의 대표 이미지 URL을 전달한다.

## Verification
이미지 유무 및 실패 처리, 375px 화면에서 행 텍스트 폭과 줄바꿈, 검색·전체 목록 호출부, 고정 스크롤 측정, 모바일 lint 및 타입 검사 전후를 확인한다.

## Risks / Questions
상품 안내지처럼 세로가 긴 이미지는 40px에서 세부 글자가 작다. 기존 전체 목록과 같은 contain으로 이미지 전체를 표시한다.

## Adversarial Review
375px 기준 텍스트 폭은 181px이다. 두 줄 이름은 행 높이를 늘릴 수 있으므로 기존 onLayout 측정을 유지한다. 전체 목록의 한 줄 이름 및 48px 썸네일은 기본값으로 유지한다. 기존 검색 오버레이 행에는 미리보기 스타일을 적용하지 않는다.

## Final Plan
Penpot의 기존 행 위치에 썸네일을 추가하고, 공용 행에 `preview` 변형을 적용한 다음 동일한 이미지·텍스트 규격과 회귀 여부를 대조한다.
