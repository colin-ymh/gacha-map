# Browse sticky shortcuts

## Request
- 상단 바로가기 카드 다음 항목 일부를 보이게 하여 가로 스크롤을 드러낸다.
- 둘러보기 본문을 위로 스크롤하면 바로가기는 화면 밖으로 이동하고 왼쪽 분류와 오른쪽 목록은 검색창 아래까지 함께 올라온다. 이후 분류는 고정되고 오른쪽 목록은 계속 스크롤한다.
- 레일 탭의 부드러운 이동과 수동 스크롤의 활성 분류 추적을 유지한다.

## Scope
- 네이티브 둘러보기 탭의 바로가기 크기와 스크롤 좌표/배치.
- 공유 컴포넌트의 기존 검색 오버레이 사용처 회귀 방지.
- 메인 세션이 확인한 Notion 「가챠 카테고리·시리즈 탐색 기획」 §3의 좌측 분류/우측 스크롤스파이를 따른다. 구체적인 바로가기 스크롤 동작은 이번 사용자 요청을 따른다.
- Penpot 선행 확인/동기화는 이번 작업에서 사용자가 면제했다는 메인 세션 전달에 따른다.

## Out of Scope
- API, 데이터, Redux 구조, DB/스키마, 웹, 검색 결과 목록, 최근 기록 UX 변경.
- 새로운 애니메이션/제스처 라이브러리 도입.

## Relevant Files
- `apps/mobile/components/organisms/search/GachaBrowseSections.tsx`
- `apps/mobile/app/(tabs)/browse.view.tsx`
- `apps/mobile/components/organisms/search/SearchOverlay.tsx` (사용처 확인)
- `apps/mobile/components/organisms/search/SearchHistoryOverlay.tsx` (부모 스크롤 확인)

## Plan
1. 기존 바로가기 선택/데이터/레일 순서를 유지한다. 실제 컴포넌트 가용 너비 W를 측정하고 카드 폭을 정한다. 예: 좌측 여백 20, gap 8, 세 장과 다음 카드 25% 노출 기준 `cardSize = (W - 20 - 24) / 3.25`. 작은 화면/큰 화면에서 다음 카드가 잘리지 않고 완전히 맞아떨어지는 기존 고정 폭 문제를 피한다. 카드 수가 적으면 불필요한 자리 채움은 하지 않는다.
2. 둘러보기 탭에서만 활성화하는 선택적 `collapsibleShortcuts` prop을 추가한다. 기본값 false로 검색 오버레이 기존 흐름을 유지한다. BrowseView에서 true로 전달한다. 카드 폭 조정은 공통 적용 가능하다.
3. 활성 경로에서 가용 높이 V와 전체 너비를 차지하는 단일 세로 Animated.ScrollView를 둔다. 첫 자식은 실제 바로가기 가로 ScrollView이며 그 다음 섹션 wrapper에 marginLeft 104를 적용한다. 높이를 매 프레임 변경하지 않는다. 실제 헤더이므로 세로 스크롤에 자연스럽게 함께 이동한다.
4. 왼쪽 레일만 absolute top 0, bottom 0으로 겹쳐 놓고 세로 위치 `H - clamp(y, 0, H)`를 native Animated.event 기반으로 적용한다. 부모 overflow hidden으로 아래 영역 침범을 막는다. 레일 폭은 104로 제한하여 우측 터치를 가리지 않는다. 스크롤 최상단에서 레일은 헤더 아래에 있고 H 이후 상단에 고정된다.
5. 좌표를 하나로 통일한다. 섹션 wrapper 내부 onLayout의 상대 localOffset을 저장한다. 탭 목표에는 H를 한 번만 더한다. 화면 좌표는 `H + localOffset - y`, 레일 top은 `H - clamp(y,0,H)`다. 레일 탭 목표는 `H + localOffset`; 실제 scrollTo는 `[0, contentHeight - V]`로 제한한다. 수동 스크롤스파이는 `max(y - H, 0) + ACTIVE_OFFSET`와 localOffset을 비교한다.
6. `selectedRailKey` 잠금은 탭 직후 설정하여 이동 중/최하단 clamp 때도 선택을 유지하고 수동 onScrollBeginDrag에서만 해제한다. 잠금 중에도 애니메이션 y는 항상 갱신한다. 분류 변경이 없으면 React 상태 갱신을 생략한다.
7. 짧은 목록에서도 헤더를 숨길 수 있도록 콘텐츠 minHeight를 최소 `V + H`로 두며 기존 bottomPadding은 유지한다. H=0(바로가기 없음)도 정상 처리한다. 회전/너비 변경 시 H와 viewport 측정값을 반영하며 불필요한 반복 layout을 만들지 않는다.

## Verification
- 모바일 workspace 타입 검사/변경 파일 lint와 formatting 검사. 기존 실패는 이번 변경과 구분한다.
- 가능하면 실기기/시뮬레이터에서 시작, H/2, H, H 이후 위치를 확인한다. 검색창 고정, 바로가기/레일 동시 이동, H 이후 레일 고정, 오른쪽 연속 스크롤을 검증한다.
- 레일 탭 도중 중간 섹션 활성 깜빡임 없음, 마지막 분류 clamp 후 선택 유지, 직접 드래그 후 scrollspy 재개.
- 좁은/넓은 화면의 다음 카드 일부 노출, 가로 스와이프와 탭 유지, 스크롤 끝 하단 탭바 가림 없음.
- 바로가기 없음/짧은 목록/로딩/오류 및 검색 오버레이 최근 기록 유무 회귀 확인.
- 접근성에서 숨은 바로가기 포커스/터치가 화면 밖에 남지 않는지 확인. 완전히 사라지면 접근성 트리 제외가 필요하면 임계점에서만 상태 변경한다.

## Risks / Questions
- SearchHistoryOverlay는 footer를 세로 ScrollView에 넣는다. 이 사용처에 full-height sticky 구조를 무조건 적용하면 비제한 높이/중첩 제스처 문제가 생긴다. opt-in으로 차단한다. 기존 검색 오버레이 중첩 스크롤 개선은 별도 범위다.
- 세로 ScrollView 안의 가로 바로가기에서 대각선 드래그 방향 잠금은 네이티브에서 확인한다. 별도 세로 PanGesture는 추가하지 않는다.
- 접근성 글꼴 확대 시 레일 전체가 viewport보다 커질 수 있다. 기존 동작보다 악화되지 않는지 확인하며 별도 세로 레일 스크롤은 이번에 추가하지 않는다.
- 네이티브 실행 접근이 없으면 실제 제스처/성능 검증 미완료를 명시한다.

## Adversarial Review
- 중첩된 외부/내부 세로 ScrollView로 구현하면 드래그 인계가 불안정해진다: 단일 세로 owner와 레일 overlay transform을 사용한다.
- 헤더 높이를 매 스크롤마다 줄이면 viewport와 maxOffset이 바뀌어 점프한다: 높이를 유지하고 transform만 움직인다.
- 기존 scrollspy 잠금의 early return이 헤더 애니메이션도 막을 수 있다: 애니메이션 업데이트와 선택 잠금을 분리한다.
- H를 section offset에 두 번 더하면 레일 탭/활성 추적이 어긋난다: 실제 onLayout 부모 기준을 확인하여 섹션 wrapper 상대 좌표만 저장하고 탭 목표에서만 H를 더한다.
- 레일 overlay가 우측 터치를 가리지 않도록 폭을 고정하고 토큰 배경을 사용한다. 헤더는 실제 스크롤 콘텐츠여서 별도 overlay가 필요 없다.
- 검색 오버레이 기존 사용처를 놓치면 공유 컴포넌트의 높이가 사라질 수 있다: 탭에만 opt-in한다.

## Final Plan
- 공통 바로가기 너비를 실제 viewport에 맞추고, BrowseView opt-in 경로에서 단일 전체 너비 세로 ScrollView + 실제 헤더 + 레일 native transform을 구현한다.
- 데이터/API/탐색 콜백과 수동 선택 잠금 동작을 유지하고, offset/minHeight/clip으로 짧은 목록과 경계를 처리한다.
- 메인 세션이 최종 diff, 모바일 검사 결과, 가능한 네이티브 상호작용 검증과 사용자 Penpot 면제 상태를 보고한다. 자동 커밋하지 않는다.

## Implementation and verification
- Sol 구현 후 Astra 최종 좌표/회귀 검토 Pass. 단일 세로 스크롤, 실제 바로가기 헤더, native 레일 transform, BrowseView opt-in 구현.
- 마지막 섹션 높이에 따른 하단 padding으로 마지막 분류가 상단까지 도달하도록 보장한다. 별도 minHeight보다 강한 길이 보장이어서 계획을 이 방식으로 구체화했다.
- 대상 파일 ESLint 통과. 전체 모바일 lint 0 errors/기존 73 warnings. typecheck 변경 전후 진단 동일: 기존 4개 파일 오류 유지, 신규 오류 없음.
- diff 공백 검사 통과, tunnel 정상 응답 확인. 설치된 formatter 없음; 수동 정렬. 실제 아이폰 제스처·회전·접근성 확인은 남아 있다.
- Penpot은 앞선 사용자 생략 요청에 따라 확인/동기화 미수행. 커밋/배포/DB 변경 없음.

## Corrective review — right sticky headers and overscroll
- User reported right headings were not sticky and iOS pull-down moved scroll content below an independently clamped rail, causing overlap. Prior implementation did not satisfy the expected right-header behavior.
- Astra corrective plan: opt-in vertical list direct children are [shortcut wrapper, section header, rows wrapper, ...]. Preserve index0 even without shortcuts. Use native stickyHeaderIndices [1,3,5,...] with opaque WHITE headers restricted to the right column.
- Use actual content-absolute header layout.y for both rail targets and scrollspy. Do not subtract measured H in onLayout: initial H=0 can capture stale offsets if layout does not repeat. Legacy offsets are already relative to their own scroll content and need no H adjustment.
- Measure last header and rows heights separately to preserve final-section top alignment. Footer padding is on the scroll content container.
- Disable bounce/alwaysBounceVertical/Android overscroll only for the opt-in vertical list. Preserve horizontal cards and existing noncollapsible search path.
- Verify changed file lint, full mobile checks against baseline, native header indices/coordinates by review. Actual iOS pull-down/section transitions remain device verification requirements.
- Corrective implementation verified: right native sticky headers, stable direct-child indices, absolute offsets, separate last header/rows measurement, opt-in overscroll disabled. Astra final review Pass. React Native installed StickyHeader source confirms child onLayout receives wrapper layout event (content-absolute coordinates).
- Target ESLint and diff check pass; full mobile lint 0 errors/73 existing warnings, typecheck diagnostics identical to corrective baseline. Dev tunnel responds normally. Actual iOS pull-down and header transition verification remains pending; no device pass claimed.
