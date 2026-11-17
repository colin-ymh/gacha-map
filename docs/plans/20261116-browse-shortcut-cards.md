# 카테고리 상단 바로가기 확대

## Request
카테고리 상단 사진을 키우고 홈 캐러셀처럼 사진 내부 하단에 이름을 표시한다.

## Scope
120×120 바로가기, cover 이미지, 하단 그라데이션과 흰색 두 줄 이름. Astra 계획 후 Sol 구현.

## Out of Scope
데이터 선정/정렬, 분류 스크롤, API/DB, 자동 재생, 신규 라이브러리.

## Relevant Files
- apps/mobile/components/organisms/search/GachaBrowseSections.tsx
- apps/mobile/constants/colors.ts
- 참조: apps/mobile/components/molecules/gacha/GachaRollCard.tsx
- Notion: 3c4203d520db81b4bfc7edb79627a3b4 §3 확인. 이번 사용자 변경 요청 우선.

## Plan
1. 기존 76px 사진을 120px 정사각형 카드로 확대한다.
2. 기존 홈의 radius12, padding10, 흰색13/700·줄높이18 텍스트를 하단 그라데이션 위에 최대 두 줄 표시한다.
3. 필요한 색은 모바일 상수에 정의한다. 항목 선택·수평 스크롤·이동 동작은 유지한다.

## Verification
대상 ESLint, 모바일 lint/typecheck 변경 전후 비교, diff 검사. 작은 화면·밝은 이미지·긴 이름·이동 동작은 기기 검증 범위를 보고한다.

## Risks / Questions
사진 확대에 따라 하단 항목 영역이 줄어든다. Penpot 확인·동기화는 앞선 사용자 생략 요청에 따라 미수행.

## Adversarial Review
홈 상품 카드는 뽑기 버튼 등 도메인 의존성이 있으므로 그대로 재사용하지 않는다. 기존 설치된 LinearGradient와 스타일 패턴만 사용한다. 자동재생 추가 없이 기존 가로 스크롤을 보존한다.

## Final Plan
Astra 검토 완료. 위 최소 범위로 Sol 구현 후 메인 검증. 레이아웃 외 데이터·검색·분류 동작 변경 없음.

## Implementation and verification
- Sol 구현 및 메인 diff 검토 완료. 120px 카드, cover, 하단 그라데이션/흰색 두 줄 텍스트, 전체 접근성 라벨 적용. 색상 상수 2개 추가.
- 대상 ESLint와 diff 공백 검사 통과. 전체 모바일 typecheck 변경 전후 동일한 기존 4개 파일 오류; 신규 진단 없음. 전체 lint 오류 0, 기존 경고 유지.
- 설치된 formatter 없음. 실물 기기 크롭·긴 이름 시각 확인은 미실행. Penpot은 사용자 요청으로 생략.
- 실행 유지: 대화 PTY와 분리한 임시 macOS launchd job `com.gachamap.expo-dev-tunnel`에서 Expo tunnel 실행. 종료 시 5초 후 재시도. 로그 `/private/tmp/gachamap-expo-tunnel.log`, 오류 `/private/tmp/gachamap-expo-tunnel-error.log`. 재부팅/로그아웃 및 시스템 잠자기 중 연결 유지는 보장하지 않음. 중지는 `launchctl remove com.gachamap.expo-dev-tunnel`.
