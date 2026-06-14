# 마이페이지 레이블 변경 + 제보 FAB 강조

## Request

- "샵 신청 내역" 레이블이 사용자가 좋아하는 샵을 신청하는 것처럼 읽힘 → "내 샵 신청 현황"으로 명확화
- 서비스 초기 새 샵 제보 유입 극대화를 위해 제보 FAB을 더 눈에 띄게 강조

## Scope

1. 번역 파일에서 "샵 신청 내역" → "내 샵 신청 현황" (ko/en, mobile/web)
2. 홈 지도 화면 제보 FAB: 흰 배경+핑크 아이콘 → 핑크 배경+흰 아이콘

## Out of Scope

- 마이페이지에 제보하기 CTA 카드 추가 (검토했으나 제외)
- Extended FAB (텍스트+아이콘) 형태 변경
- 웹 헤더 제보하기 링크 변경

## Relevant Files

### 레이블 변경

| 파일                           | 라인 | 키                         | 현재값                     | 변경값                       |
| ------------------------------ | ---- | -------------------------- | -------------------------- | ---------------------------- |
| `apps/mobile/messages/ko.json` | 10   | `shopApplicationsMenu`     | "샵 신청 내역"             | "내 샵 신청 현황"            |
| `apps/mobile/messages/ko.json` | 230  | `myShopApplications.title` | "샵 신청 내역"             | "내 샵 신청 현황"            |
| `apps/mobile/messages/en.json` | 10   | `shopApplicationsMenu`     | "Shop Applications"        | "My Shop Applications"       |
| `apps/mobile/messages/en.json` | 230  | `myShopApplications.title` | "Shop Application History" | "My Shop Application Status" |
| `apps/web/messages/ko.json`    | 160  | `shopApplicationsMenu`     | "샵 신청 내역"             | "내 샵 신청 현황"            |
| `apps/web/messages/ko.json`    | 497  | `myShopApplications.title` | "샵 신청 내역"             | "내 샵 신청 현황"            |
| `apps/web/messages/en.json`    | 160  | `shopApplicationsMenu`     | "Shop Applications"        | "My Shop Applications"       |
| `apps/web/messages/en.json`    | 497  | `myShopApplications.title` | "Shop Application History" | "My Shop Application Status" |

### FAB 색상 변경

| 파일                               | 라인 | 현재                     | 변경                       |
| ---------------------------------- | ---- | ------------------------ | -------------------------- |
| `apps/mobile/app/(tabs)/index.tsx` | 524  | `backgroundColor: WHITE` | `backgroundColor: PRIMARY` |
| `apps/mobile/app/(tabs)/index.tsx` | 535  | `color={PRIMARY}`        | `color={WHITE}`            |

색상 상수: `apps/mobile/constants/colors.ts`

- `PRIMARY = "#E94B8C"`
- `WHITE = "#FFFFFF"`

## Plan

1. 4개 번역 파일에서 해당 키 값 교체
2. `index.tsx` FAB 스타일 2줄 수정

## Verification

- 모바일: 마이페이지 진입 → "내 샵 신청 현황" 메뉴 표시 확인
- 모바일: 신청 현황 화면 진입 → 페이지 타이틀 "내 샵 신청 현황" 확인
- 웹: 마이페이지 진입 → 동일 레이블 확인
- 모바일 홈/지도 화면: 제보 FAB이 핑크 채워진 원으로 표시되는지 확인
- 영문 앱 전환 후 레이블 "My Shop Applications" / "My Shop Application Status" 확인

## Risks

- 없음. 번역 파일 텍스트 교체 + 색상 상수 교체만. 로직 변경 없음.
