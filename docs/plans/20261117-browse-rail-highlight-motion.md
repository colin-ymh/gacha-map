# 둘러보기 분류 강조 이동

## Request
선택 분류가 바뀔 때 분홍 글래스 강조 박스가 위아래로 이동하도록 한다.

## Scope
둘러보기 탭의 분류 탭 및 오른쪽 목록 스크롤에 따른 강조 위치 전환.

## Out of Scope
검색 오버레이, 스크롤 목표 계산, 글래스 색과 배치 변경.

## Relevant Files
- `apps/mobile/components/organisms/search/GachaBrowseSections.tsx`
- Notion 카테고리 탐색 기획 §3, Penpot 둘러보기 개선 보드.

## Plan
각 버튼의 레이아웃 좌표를 측정한다. 버튼 뒤에 놓인 단일 배경의 위치와 높이를 Reanimated로 180ms 동안 전환한다.

## Verification
초기 배경이 선택 위치에서 시작하는지, 탭 및 스크롤 선택 모두 배경을 이동시키는지, 긴 라벨 높이와 동작 줄이기 설정을 처리하는지 검토한다. 모바일 lint와 타입 검사를 실행한다.

## Risks / Questions
초기 측정 전에는 배경을 표시하지 않는다. 빠르게 선택이 바뀔 때 현재 애니메이션 값에서 새 위치로 이어진다.

## Adversarial Review
배경의 포인터 이벤트를 차단하고 현재 접근성 선택 상태를 유지한다. 48px 고정 위치 계산을 피해서 긴 번역과 글꼴 확대 시에도 버튼 높이 및 위치를 따른다.

## Final Plan
Penpot 정지 화면의 치수를 유지하고 Notion에 전환을 명시한다. 실제 버튼 높이에 맞춰 단일 글래스 배경을 구현하고 모바일 검사 결과를 확인한다.
