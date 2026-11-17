# 탐색 전체 목록 행 통일

## Request

- 네이티브 카테고리 전체 목록에도 대표 사진·이름·상품 수를 표시하고 시리즈 전체 목록과 행 표현을 통일한다.
- 사용자 요청에 따라 Astra가 계획하고 Sol이 구현한다. 이 문서는 계획 산출물이며 구현 착수를 의미하지 않는다.
- 메인 세션이 확인한 Notion 원본: `3c4203d520db81b4bfc7edb79627a3b4`. §4의 기존 텍스트 전용 카테고리 행은 사용자의 사진 행 요청으로 변경한다. §6 시리즈 기준은 썸네일 48×48, 기본 행 높이 68, 제목 14/700, 보조문구 11/400이다.

## Scope

- `product_type`, `subject`, `genre`, `line` 네 축의 카테고리 전체 목록 및 시리즈 전체 목록.
- 두 화면이 쓰는 최소 공용 molecule 행: 대표 이미지, 이름, 상품 수, 선택적 하위 시리즈 수, 누름 동작.
- 이미지 누락·로드 실패 대체 아이콘, 긴 이름 말줄임, 접근성, 기존 색상 토큰과 번역 키 재사용.

## Out of Scope

- 탐색 랜딩, 상세 화면, 웹, 필터 종류·순서, 정렬·페이지네이션·데이터 수집 변경.
- API/공유 타입/DB 스키마/마이그레이션/환경 변수/배포 설정 변경.
- 새로운 상태 관리·스타일 라이브러리, 자동 커밋, 무관한 리팩터링.

## Relevant Files

- 변경: `apps/mobile/app/browse/categories.tsx`, `apps/mobile/app/browse/series.tsx`.
- 추가 예정: `apps/mobile/components/molecules/BrowseListRow.tsx`.
- 참조: `apps/mobile/hooks/useGachaBrowseLists.ts`, `apps/mobile/components/molecules/BrowseChip.tsx`, `apps/mobile/constants/colors.ts`, `apps/mobile/lib/i18n.ts`.
- 계약 참조: `packages/shared/src/types/index.ts`, `apps/web/src/app/api/gacha-browse/categories/route.ts`, `apps/web/src/app/api/gacha-browse/series/route.ts`.
- 규칙 참조: `AGENTS.md`, `docs/agent-rules.md`, `docs/codex/workflows.md`, `docs/codex/agent-additions.md`, `.codex/agents/frontend-agent.md`, `docs/workflow.md`, `docs/architecture.md`.
- 오래된 웹 중심 아키텍처 설명보다 현재 네이티브 구현과 AGENTS 플랫폼 규칙을 우선한다.

## Plan

1. 메인 세션이 Penpot 연결 및 UI 확인을 완료하거나 사용자의 명시적 예외 승인을 기록한 뒤 구현을 시작한다. 2026-11-16 사용자가 “펜팟 지금은 생략하자”라고 명시하여 이번 작업의 Penpot 선행 확인과 동기화를 생략한다.
2. 공용 행에 `name`, nullable `imageUrl`, `productCount`, 선택적 `childCount`, `onPress`만 전달한다. 라우팅·필터·fetch는 화면과 기존 훅에 남긴다. 행 내부의 이미지 실패 상태는 로컬 상태로 관리한다.
3. 기본 행 높이 68, 가로 여백 16, 이미지 48×48/반경 8, 간격 12, 제목 14/700, 보조문구 11/400을 적용한다. 이미지 `contain`으로 상품 잘림을 피한다. 네이티브의 기존 `StyleSheet`와 색상 상수를 사용한다. 글자 확대에서 잘리지 않도록 고정 높이 대신 최소 높이 및 수직 여백 사용을 검토한다.
4. 이미지 URL이 없거나 요청이 실패하면 같은 크기 영역에 기존 아이콘 방식과 토큰으로 대체 표시한다. URL 변경 후 정상 이미지가 다시 표시되도록 실패 상태를 URL별로 처리한다. 장식 이미지/아이콘의 별도 접근성 포커스를 제거한다.
5. 제목은 한 줄 말줄임과 축소 가능한 텍스트 영역을 사용하고 전체 이름·상품 수·하위 수를 행 접근성 라벨에 포함한다. `browse.productCount`, `browse.series.childCount`를 재사용하며 하위 수는 양수일 때만 표시한다. 상품 0개도 숨기지 않는다.
6. 카테고리는 `representative_image_url`, `name_ko`, `product_count`를 매핑하고 기존 카테고리 ID 이동을 유지한다. 시리즈는 같은 이미지·이름 및 `rollup_product_count`, `child_count`를 매핑한다. 썸네일 다음 텍스트 시작 위치에 맞춰 두 화면의 구분선도 통일한다.
7. 시리즈 칩, unknown의 전체 노출, 페이지 추가 로드·푸터·재시도와 양쪽 로딩/오류 처리를 그대로 보존한다. 공용 행 추출 후 각 화면의 중복 행 스타일/import만 정리한다.
8. 메인 세션이 검증하고 Penpot을 최종 구현에 동기화한다. 명시적 예외로 구현했다면 동기화 미완료를 최종 보고에 남긴다.

## Verification

- 변경 파일에 설치된 포매터를 적용하고 diff 범위·색상 하드코딩·i18n·공유 행 사용·라우팅·API 무변경을 확인한다.
- `pnpm --filter @gacha-map/mobile typecheck`, `pnpm --filter @gacha-map/mobile lint` 실행. 기존 실패와 새 실패를 구분한다. 모바일 테스트 스크립트가 없어 이 단순 UI 작업을 위한 신규 테스트 기반은 추가하지 않는다.
- 가능한 기기/시뮬레이터에서 네 축 목록과 시리즈를 확인한다: 정상 이미지, null URL, 깨진 URL, URL 변경, 긴 이름, 큰 글자, 상품 0개, 하위 수 0/양수, 좁은 화면, 버튼 스크린리더 라벨.
- 기존 ID 상세 이동, 뒤로가기, 시리즈 필터 전환, 무한 스크롤, 최초 로딩/실패/재시도 및 추가 로딩 푸터를 확인한다. 빈 응답의 기존 동작도 회귀 확인한다.
- 직접 실행하지 못한 기기 검증과 Penpot 확인/동기화는 미완료로 보고한다. 문서만 변경한 계획 단계에서는 경로·내용·diff 확인만 수행한다.

## Risks / Questions

- **Penpot 예외 승인:** 2026-11-16 사용자 요청으로 이번 확인·동기화를 생략한다. 기존 시리즈 목록 디자인을 기준으로 구현하고 미동기화 상태를 보고한다.
- API의 `GachaBrowseCategory`와 `GachaBrowseSeries` 모두 nullable `representative_image_url`을 이미 제공한다. 선택적 `representative_image_urls` 후보 목록은 이번 작업에 필요 없다. 사진을 위해 백엔드/DB를 변경할 이유가 없다.
- 기존 `name_ko` 선택은 유지한다. 이름 현지화 정책 확대는 별도 범위다.
- 기존 시리즈 훅의 추가 페이지 요청은 최초 요청과 별도 abort controller를 사용한다. 빠른 칩 전환 중 경합 가능성은 기존 로직에 있으므로 UI 추출과 함께 무리하게 수정하지 않고 검증 중 재현되면 별도로 보고한다.
- 기기 접근 및 Penpot 동기화 가능 여부에 따라 시각 검증 완료 범위가 제한될 수 있다.

## Adversarial Review

- 범위 과다 위험: 랜딩까지 통일하거나 공용 리스트 프레임워크를 만들 필요가 없다. 두 전체 목록의 행 한 개만 추출한다.
- 계약 혼동 위험: 시리즈의 직접 상품 수 대신 기존 rollup 수를 유지하고 카테고리는 product_count를 사용한다. 이미지 후보 선택이나 랜딩의 중복 제거 정책을 가져오지 않는다.
- 규칙 충돌: Notion의 텍스트 전용 §4는 명시적 사용자 변경 요청으로 해소되지만 Penpot 선행 조건까지 자동으로 해소되지는 않는다. 별도 게이트를 유지한다.
- 누락 위험: 단순 null 대체로는 깨진 URL을 처리하지 못한다. 오류 대체와 URL 변경 복구를 포함한다. 긴 제목은 화면에서만 줄이고 접근성 라벨에는 원문을 유지한다.
- 회귀 위험: 시리즈 고유 하위 수·필터·페이지 로딩을 공용 컴포넌트에 옮기지 않는다. 스타일 통일과 도메인 동작을 분리한다.
- 검증 공백: 웹 루트 검사만으로 모바일 검증을 대체할 수 없다. 모바일 typecheck/lint와 실행 가능한 기기 확인을 명시한다.

## Final Plan

최소 세 구현 파일에서 공용 이미지 행을 도입한다. 기존 API와 훅, 필터, 페이지네이션, 라우팅을 유지하고 카테고리 네 축까지 동일한 표현을 적용한다. 계획 검토 완료. **사용자의 Penpot 생략 승인을 기록했으므로 구현 선행 조건이 충족되었다.** 이후 Sol 구현 → 메인 세션 검증 → Penpot 동기화/미완료 명시 → 변경 보고 순서로 진행한다.


## Implementation and verification

- 2026-11-16 Sol 구현 및 메인 diff 검토 완료. 공용 `BrowseListRow`/구분선을 카테고리·시리즈 전체 목록에 적용했다. 48px contain 이미지, 누락/실패 아이콘, URL별 오류 상태 초기화, 기존 번역 키, 전체 이름 접근성 라벨을 포함한다.
- 기존 ID 이동, 데이터 훅, 시리즈 필터 및 추가 로딩은 변경하지 않았다. DB/API/환경 설정 변경 없음.
- 대상 3개 파일 ESLint 통과. 전체 모바일 lint 0 errors/기존 73 warnings. `git diff --check` 통과.
- 모바일 typecheck는 변경 전후 결과가 동일하다. 기존 GachaRollModal.view.tsx, ReviewCard.view.tsx, BlurViewCompat.tsx, LiquidGlass.tsx 오류가 남아 전체 통과는 아니다.
- 설치된 formatter가 없어 기존 형식으로 수동 정렬했다. 모바일 테스트 스크립트는 없으며 신규 테스트 기반은 추가하지 않았다.
- 개발 서버 정상 응답 확인. 실물 아이폰의 이미지·큰 글자·VoiceOver·필터 전환 시각 검증은 미실행이다.
- 사용자 명시적 요청으로 Penpot 확인/동기화 생략. 자동 커밋·배포 없음.
