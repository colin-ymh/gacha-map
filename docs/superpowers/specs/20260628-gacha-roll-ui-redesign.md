# 가챠 뽑기 UI/UX 개선 (Approach B)

## Request

뽑기 UI/UX 전면 개선:
- 버튼 스타일 앱 기준(borderRadius 8, height 44)으로 통일
- 이모티콘 과용 제거
- 닫기 방식 단일화
- idle 화면 문구 간소화
- 핑크 과용 감소
- `already_rolled` 시 상세 페이지에서 인라인 결과 카드 표시

## Scope

- `roll-status` GET API: `rolledVariant` 필드 추가 (already_rolled + daily_limit 모두)
- `GachaRollModal.view.tsx`: 시각적 개선
- `GachaRollModal.tsx`: `onRolled` 콜백 prop 추가
- `app/gacha/[id].tsx`: 버튼 규격, 인라인 카드, 버그 수정
- `roll/route.ts`: reason 통일 (`product_limit` → `already_rolled`)

## Out of Scope

- 스와이프 다운 dismiss
- 뽑기 히스토리 화면
- `useGachaRoll.ts` 에러 메시지 i18n (기존 부채, 별도 처리)
- 하드코딩 색상 전수 정리 (일러스트 전용 색상은 제외)
- Penpot 동기화 (레이아웃 구조 변경 있음 → 작업 후 필수)

## Relevant Files

| 파일 | 역할 |
|---|---|
| `apps/web/src/app/api/gacha-products/[id]/roll-status/route.ts` | GET API |
| `apps/web/src/app/api/gacha-products/[id]/roll/route.ts` | POST API |
| `apps/mobile/app/gacha/[id].tsx` | 상세 페이지 |
| `apps/mobile/components/organisms/gacha/GachaRollModal.tsx` | 모달 컨테이너 |
| `apps/mobile/components/organisms/gacha/GachaRollModal.view.tsx` | 모달 View |
| `apps/mobile/hooks/useGachaRoll.ts` | 뽑기 훅 |
| `apps/mobile/messages/ko.json` | i18n |
| `apps/mobile/messages/en.json` | i18n |
| `apps/mobile/constants/colors.ts` | 색상 상수 |

## Plan

### 1. `roll-status` GET API 확장

**변경**: `already_rolled` 케이스에서 count만 조회하던 것을 실제 row + variant 정보 조회로 변경.
`daily_limit` 케이스에서도 해당 상품의 오늘 뽑기 기록을 추가 조회해 `rolledVariant` 반환.

새 응답 형태 (`rolledVariant` 포함 시):
```ts
{
  canRoll: false,
  reason: "already_rolled" | "daily_limit",
  nextAvailableAt: string,
  rolledVariant?: {
    id: string
    name: string
    name_ko: string | null
    image_url: string | null
  }
}
```

구현 순서:
- `already_rolled` 브랜치: `.select("variant_id, gacha_product_variants(id, name, name_ko, image_url)")` 로 variant 내포 조회 (FK: `variant_id → gacha_product_variants.id`)
- `daily_limit` 브랜치: 동일 상품 오늘 뽑기 기록 추가 조회. 있으면 `rolledVariant` 포함, 없으면 생략.

### 2. `roll/route.ts` reason 통일

line 66 `reason: "product_limit"` → `reason: "already_rolled"` 로 변경.
`@gacha-map/shared` 타입에 `"already_rolled"` 포함 확인.

### 3. `[id].tsx` 변경

**즉시 수정 (버그):**
- `Promise.all` 내 roll-status fetch에 `.catch(() => null)` 추가
- `onLoginRequired` 콜백에 `setRollOpen(false)` 추가

**rollStatus 타입 확장:**
```ts
{
  canRoll: boolean
  reason?: "no_variants" | "already_rolled" | "daily_limit"
  nextAvailableAt?: string
  rolledVariant?: {
    id: string
    name: string
    name_ko: string | null
    image_url: string | null
  }
}
```

**하단 버튼 규격 수정:** height 52 → 44, borderRadius 14 → 8

**인라인 결과 카드 추가:**
- 위치: ScrollView 내, 상품 정보 블록 아래 (구분선 위)
- 조건: `rollStatus?.rolledVariant` 존재 시 표시
- 내용: variant 이미지(48×48, borderRadius 8) + variant name(`name_ko ?? name`) + "오늘 뽑음" 레이블
- 배경: GRAY_100, borderRadius 8, padding 12

**onRolled 콜백 처리:**
```ts
// GachaRollModal에서 받은 GachaRollResult → rollStatus 즉시 업데이트
// 모달은 닫지 않음 — 유저가 result 화면 확인 후 X/텍스트 링크로 직접 닫음
onRolled={(result) => {
  setRollStatus({
    canRoll: false,
    reason: "already_rolled",
    nextAvailableAt: result.permission.nextAvailableAt,
    rolledVariant: {
      id: result.variant.id,
      name: result.variant.name,
      name_ko: result.variant.name_ko ?? null,
      image_url: result.variant.image_url ?? null,
    },
  })
}}
```

### 4. `GachaRollModal.tsx` (컨테이너)

`onRolled?: (result: GachaRollResult) => void` prop 추가.
`status === "result"` 전환 시 (애니메이션 완료 + API 응답 수신 직후) `onRolled(rollResult)` 호출.
모달 닫기는 기존 `onClose` 그대로 유지 — `onRolled`는 모달을 닫지 않음.

### 5. `GachaRollModal.view.tsx` 시각 개선

**제거:**
- `stateEmoji` (64px 텍스트 이모지) — already_rolled/daily_limit/no_variants/error 4개 상태에서 제거
  - 대체: `Ionicons` 아이콘 (28-32px, TEXT_GRAY)
  - already_rolled: `time-outline`
  - daily_limit: `checkmark-circle-outline`
  - no_variants: `help-circle-outline`
  - error: `alert-circle-outline`
- `freeBadge` ("하루 최대 5회 무료 뽑기" 핑크 pill) — 제거
- "닫기" outline 버튼 — result 상태에서만 텍스트 링크 형태로 유지, 나머지 상태에서는 제거

**변경:**
- `bottomNote` 텍스트 간소화: "상품별 1회 · 하루 최대 5회 · 매일 자정 초기화" → i18n key 업데이트
- `nextAtValue` 색상: `PRIMARY` → `TEXT_DARK`
- 모든 버튼 height 56 → 44, borderRadius 16 → 8
- `DAILY_LIMIT` 상수: view.tsx 직접 선언 제거 → prop으로 전달 또는 hook에서 주입
- result 상태의 "닫기" 버튼: outline 버튼 → `TouchableOpacity` 텍스트 링크 (color TEXT_GRAY, no border)

**유지:**
- `CyclingIcon` (80px 이모지 애니메이션) — 건드리지 않음
- GachaMachine LinearGradient 일러스트
- animating 상태 X 버튼 숨김 처리

### 6. i18n

`bottomNote` key 업데이트 (ko/en 동시).
신규 key 불필요 (기존 key 재활용).

## Verification

- [ ] roll-status API: already_rolled 시 rolledVariant 반환 확인
- [ ] roll-status API: daily_limit + 이 상품 뽑은 경우 rolledVariant 반환 확인
- [ ] roll-status API: daily_limit + 이 상품 안 뽑은 경우 rolledVariant 없음 확인
- [ ] 상세 페이지: rollStatus.rolledVariant 있을 때 카드 렌더링
- [ ] 상세 페이지: onRolled 콜백 → rollStatus 즉시 업데이트 → 카드 표시
- [ ] 상세 페이지: Promise.all roll-status 실패 시 페이지 정상 로드
- [ ] 상세 페이지: 로그인 이동 시 모달 닫힘
- [ ] 모달: stateEmoji 4곳 아이콘으로 대체
- [ ] 모달: freeBadge 없음, bottomNote 간소화
- [ ] 모달: result 상태만 하단 텍스트 링크, 나머지 X만
- [ ] 모달: 버튼 height 44, borderRadius 8
- [ ] 모달: nextAtValue 색상 TEXT_DARK
- [ ] 모달: CyclingIcon 정상 동작
- [ ] 버튼 규격: 상세 페이지 height 44, borderRadius 8
- [ ] POST API reason "already_rolled" 통일
- [ ] ko/en i18n 동기화

## Risks / Questions

1. **FK 내포 조회 컬럼명**: Supabase 내포 select 시 FK 관계명이 `gacha_product_variants`인지 확인 필요. 스키마 조회 후 진행.
2. **Penpot 동기화**: 레이아웃 구조 변경(인라인 카드, 버튼 위치)이 있으므로 구현 완료 후 Penpot 업데이트 필수.
3. **`CyclingIcon` 경계**: stateEmoji와 CyclingIcon 혼동 금지. CyclingIcon은 `animating` 상태 전용 컴포넌트, stateEmoji는 나머지 상태의 정적 이모지.

## Final Plan

위 Plan 섹션이 최종 계획. 작업 순서:

1. **API**: roll-status GET + roll POST reason 통일 (백엔드)
2. **모바일 버그 수정**: Promise.all catch, 로그인 모달 닫힘
3. **모달 view 개선**: stateEmoji → 아이콘, 버튼 규격, 닫기 통일, freeBadge 제거, bottomNote 간소화
4. **상세 페이지**: 버튼 규격, 인라인 카드, onRolled 콜백
5. **컨테이너**: onRolled prop 연결
6. **i18n**: bottomNote 업데이트
7. **검증**: Verification 체크리스트 순서대로
