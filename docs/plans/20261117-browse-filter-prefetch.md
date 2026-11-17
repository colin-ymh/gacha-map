# 상세 필터 선택창과 미리 로드

## Request
상세 화면의 소재·장르·시리즈 필터 오버레이를 줄이고 옵션 대기 시간을 줄인다.

## Scope
카테고리·시리즈 상세 공용 시트 높이와 딤, 옵션 선로딩/캐시, 옵션 오류 처리와 예상 결과 수.

## Out of Scope
필터 논리, 축 구성, 정렬, 상품 API 및 데이터 변경.

## Relevant Files
- `apps/mobile/hooks/useBrowseAxisOptions.ts`
- `apps/mobile/components/organisms/browse/{BrowseProductList,AxisPickerSheet}.tsx`
- 모바일 다국어 메시지, Notion §18 및 Penpot 소재 선택 시트.

## Plan
딤을 16%로 낮추고 시트 높이를 화면 절반으로 제한한다. 노출할 축 옵션을 화면 진입 시 병렬 요청해 캐시한다. 시트 내부 목록은 FlatList로 렌더링하고, 필요한 경우에만 스켈레톤이나 재시도를 표시한다. 시트를 처음 열 때 기존 결과 수를 재사용한다.

## Verification
요청 중복, 성공/실패/빈 목록, 시트를 빨리 여는 경우, 오래된 예상 결과 수의 응답, 연속 선택, 큰 목록 스크롤과 적용 동작을 검토한다. 모바일 lint·타입 검사와 Penpot 대조를 실행한다.

## Risks / Questions
처음 요청이 완료되기 전에 열면 옵션이 잠시 로딩된다. 요청 실패는 빈 목록과 구분하고 실패한 축만 다시 요청한다.

## Adversarial Review
동시에 진행되는 축 요청을 개별 추적한다. 캐시 여부와 빈 배열을 구분한다. 예상 결과 수 요청은 닫기와 변경 시 취소해서 지난 선택의 0건이 새 선택을 막지 않게 한다.

## Final Plan
Penpot에서 축 선택 시트를 먼저 축소한다. 세 축 선로딩과 간소화한 시트를 적용하고, 기존 필터 동작 및 Notion 규격을 대조한다.
