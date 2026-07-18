# 가챠 뽑기 UI/UX 개선 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 뽑기 UI를 앱 스타일로 통일하고, `already_rolled` 시 상세 페이지에서 오늘 뽑은 결과 카드를 인라인으로 표시한다.

**Architecture:** 백엔드 `roll-status` API에 `rolledVariant` 필드를 추가해 상세 페이지에서 결과 카드를 렌더링한다. 모달에서 뽑기 성공 시 `onRolled` 콜백으로 부모 상태를 즉시 업데이트해 stale state를 방지한다. 모달 View는 시각적 개선만 담당하며 비즈니스 로직 상수를 직접 보유하지 않는다.

**Tech Stack:** Next.js API Routes, Supabase (adminClient embedded select), React Native, expo-vector-icons (Ionicons), react-i18next

## Global Constraints

- 색상은 반드시 `apps/mobile/constants/colors.ts`에서 import해 사용한다. 하드코딩 금지.
- `CyclingIcon` 컴포넌트(animating 상태 전용, 80px 이모지 애니메이션)는 절대 건드리지 않는다.
- `stateEmoji` style(64px 텍스트 이모지)만 제거 대상이다.
- 버튼 규격 앱 기준: `height: 44`, `borderRadius: 8`
- i18n 키 변경 시 ko.json과 en.json 동시 수정 필수.
- `already_rolled` vs `daily_limit` 서버 판정 순서: daily_limit 먼저 체크 → already_rolled 체크. 5번째 뽑기 후에는 daily_limit으로 반환됨. `rolledVariant`는 두 케이스 모두에서 반환된다.

---

## File Map

| 파일 | 변경 유형 |
|---|---|
| `apps/web/src/app/api/gacha-products/[id]/roll-status/route.ts` | Modify |
| `apps/web/src/app/api/gacha-products/[id]/roll/route.ts` | Modify |
| `apps/mobile/app/gacha/[id].tsx` | Modify |
| `apps/mobile/components/organisms/gacha/GachaRollModal.tsx` | Modify |
| `apps/mobile/components/organisms/gacha/GachaRollModal.view.tsx` | Modify |
| `apps/mobile/messages/ko.json` | Modify |
| `apps/mobile/messages/en.json` | Modify |

---

## Task 1: roll-status GET API — rolledVariant 추가

**Files:**
- Modify: `apps/web/src/app/api/gacha-products/[id]/roll-status/route.ts`

**Interfaces:**
- Produces: `GET /api/gacha-products/:id/roll-status` 응답에 `rolledVariant?: { id: string; name: string; name_ko: string | null; image_url: string | null }` 필드 추가 (reason이 "already_rolled" 또는 "daily_limit"이고 오늘 이 상품을 뽑은 경우)

- [ ] **Step 1: already_rolled 브랜치 쿼리 변경**

현재 코드(line 49-63)에서 `productRollCount` (count만 조회)를 실제 row + variant로 교체한다.

```ts
// 기존 (line 49-63) 전체를 아래로 교체
const { data: productRoll, error: productError } = await adminClient
  .from("gacha_roll_results")
  .select("variant_id, gacha_product_variants!variant_id(id, name, name_ko, image_url)")
  .eq("user_id", user.id)
  .eq("product_id", productId)
  .eq("roll_type", "free_daily")
  .gte("rolled_at", todayStart)
  .limit(1)
  .maybeSingle();

if (productError) {
  return NextResponse.json({ error: productError.message }, { status: 500 });
}

if (productRoll) {
  const v = productRoll.gacha_product_variants as {
    id: string;
    name: string;
    name_ko: string | null;
    image_url: string | null;
  } | null;
  return NextResponse.json({
    canRoll: false,
    reason: "already_rolled",
    nextAvailableAt: tomorrowKSTString(),
    ...(v ? { rolledVariant: v } : {}),
  });
}

return NextResponse.json({ canRoll: true });
```

- [ ] **Step 2: daily_limit 브랜치에 rolledVariant 추가**

현재 daily_limit 반환 코드(line 45-47)를 아래로 교체한다:

```ts
// 기존 if ((todayCount ?? 0) >= DAILY_LIMIT) 블록 교체
if ((todayCount ?? 0) >= DAILY_LIMIT) {
  // 이 상품을 오늘 뽑은 기록이 있으면 variant 포함 반환
  const { data: productRollForLimit } = await adminClient
    .from("gacha_roll_results")
    .select("variant_id, gacha_product_variants!variant_id(id, name, name_ko, image_url)")
    .eq("user_id", user.id)
    .eq("product_id", productId)
    .eq("roll_type", "free_daily")
    .gte("rolled_at", todayStart)
    .limit(1)
    .maybeSingle();

  const v = productRollForLimit?.gacha_product_variants as {
    id: string;
    name: string;
    name_ko: string | null;
    image_url: string | null;
  } | null | undefined;

  return NextResponse.json({
    canRoll: false,
    reason: "daily_limit",
    nextAvailableAt: tomorrowKSTString(),
    ...(v ? { rolledVariant: v } : {}),
  });
}
```

- [ ] **Step 3: 로컬 API 서버 실행 후 curl 테스트**

```bash
# 웹 서버 실행 (앱/gacha-map 루트에서)
cd /Users/colin/Git/gacha-map && pnpm dev --filter web &

# 비로그인 → canRoll: true
curl -s "http://localhost:3000/api/gacha-products/<product_id>/roll-status" | jq .

# 로그인된 유저 (이미 뽑은 상품) → already_rolled + rolledVariant
# Authorization 헤더는 실제 세션 토큰 사용
curl -s -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/gacha-products/<product_id>/roll-status" | jq .
```

Expected (already_rolled 케이스):
```json
{
  "canRoll": false,
  "reason": "already_rolled",
  "nextAvailableAt": "2026-06-29T00:00:00+09:00",
  "rolledVariant": {
    "id": "...",
    "name": "...",
    "name_ko": "...",
    "image_url": "..."
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/gacha-products/\[id\]/roll-status/route.ts
git commit -m "feat(api): roll-status에 rolledVariant 필드 추가 (already_rolled, daily_limit)"
```

---

## Task 2: roll POST API — reason 통일

**Files:**
- Modify: `apps/web/src/app/api/gacha-products/[id]/roll/route.ts:66`

**Interfaces:**
- Produces: 409 unique constraint 위반 시 `reason: "already_rolled"` 반환 (`"product_limit"` → 변경)

- [ ] **Step 1: reason 문자열 수정**

`apps/web/src/app/api/gacha-products/[id]/roll/route.ts` line 66:

```ts
// 기존
{ reason: "product_limit", nextAvailableAt: tomorrowKSTString(), remainingToday: DAILY_LIMIT - (todayCount ?? 0) }

// 변경
{ reason: "already_rolled", nextAvailableAt: tomorrowKSTString(), remainingToday: DAILY_LIMIT - (todayCount ?? 0) }
```

- [ ] **Step 2: useGachaRoll.ts 확인**

`apps/mobile/hooks/useGachaRoll.ts` line 87:
```ts
setStatus(j.reason === "daily_limit" ? "daily_limit" : "already_rolled");
```
이 코드는 `"product_limit"` → `"already_rolled"` 변경과 함께 정확히 동작함. 수정 불필요.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/gacha-products/\[id\]/roll/route.ts
git commit -m "fix(api): roll POST 409 reason을 already_rolled로 통일"
```

---

## Task 3: 상세 페이지 버그 수정

**Files:**
- Modify: `apps/mobile/app/gacha/[id].tsx`

**Interfaces:**
- 없음 (독립 버그픽스)

- [ ] **Step 1: Promise.all roll-status 비방어 fetch 수정**

`apps/mobile/app/gacha/[id].tsx` line 150:

```ts
// 기존
fetch(`${API_BASE}/api/gacha-products/${id}/roll-status`, { headers: authHeaders }),

// 변경
fetch(`${API_BASE}/api/gacha-products/${id}/roll-status`, { headers: authHeaders }).catch(() => null),
```

- [ ] **Step 2: 로그인 이동 시 모달 미닫힘 수정**

`apps/mobile/app/gacha/[id].tsx` line 438:

```tsx
// 기존
onLoginRequired={() => router.push("/login" as never)}

// 변경
onLoginRequired={() => { setRollOpen(false); router.push("/login" as never); }}
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/gacha/\[id\].tsx
git commit -m "fix(mobile): roll-status fetch 비방어 수정, 로그인 이동 시 모달 닫기"
```

---

## Task 4: i18n 업데이트

**Files:**
- Modify: `apps/mobile/messages/ko.json`
- Modify: `apps/mobile/messages/en.json`

**Interfaces:**
- Produces: `gacha.roll.rollNote` — `{limit}` 파라미터 없는 단순 문구
- Produces: `gacha.roll.dailyLimitSubtitle` — `{limit}` 파라미터 없는 단순 문구

- [ ] **Step 1: ko.json 업데이트**

`apps/mobile/messages/ko.json`에서 다음 두 키 값 변경:

```json
// 기존
"freeBadge": "하루 최대 {{limit}}회 무료 뽑기",
"rollNote": "상품별 1회 · 하루 최대 {{limit}}회 · 매일 자정 초기화",
"dailyLimitSubtitle": "하루 최대 {{limit}}회 뽑기가 가능해요",

// 변경 (freeBadge 키는 유지, 값만 단순화)
"freeBadge": "하루 최대 5회 무료 뽑기",
"rollNote": "하루 최대 5회 무료",
"dailyLimitSubtitle": "하루 최대 5회 뽑기가 가능해요",
```

- [ ] **Step 2: en.json 업데이트**

`apps/mobile/messages/en.json`에서 동일한 키 값 변경:

```json
// 기존
"freeBadge": "Up to {{limit}} free rolls per day",
"rollNote": "1 roll per product · Max {{limit}} rolls/day · Resets at midnight",
"dailyLimitSubtitle": "Maximum {{limit}} rolls per day",

// 변경
"freeBadge": "Up to 5 free rolls per day",
"rollNote": "Up to 5 free rolls per day",
"dailyLimitSubtitle": "Maximum 5 rolls per day",
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/messages/ko.json apps/mobile/messages/en.json
git commit -m "i18n: rollNote 간소화, dailyLimitSubtitle limit 파라미터 제거"
```

---

## Task 5: GachaRollModal View 시각 개선

**Files:**
- Modify: `apps/mobile/components/organisms/gacha/GachaRollModal.view.tsx`

**Interfaces:**
- Consumes: `gacha.roll.rollNote` — `{limit}` 파라미터 없음 (Task 4 완료 후)
- Consumes: `gacha.roll.dailyLimitSubtitle` — `{limit}` 파라미터 없음 (Task 4 완료 후)

**Prerequisites:** Task 4 완료 후 진행

- [ ] **Step 1: DAILY_LIMIT 상수 및 freeBadge 제거, stateEmoji 제거**

`apps/mobile/components/organisms/gacha/GachaRollModal.view.tsx`에서 다음 변경:

**1a. line 315 `const DAILY_LIMIT = 5;` 삭제**

**1b. idle 상태 freeBadge View 블록 제거 (line 377-380):**
```tsx
// 삭제 대상
<View style={styles.freeBadge}>
  <Text style={styles.freeBadgeText}>{t("gacha.roll.freeBadge", { limit: DAILY_LIMIT })}</Text>
</View>
```

**1c. already_rolled 상태 stateEmoji 제거 (line 419):**
```tsx
// 삭제
<Text style={styles.stateEmoji}>⏰</Text>
// 추가 (stateEmoji 바로 자리에)
<Ionicons name="time-outline" size={32} color={TEXT_GRAY} />
```

**1d. daily_limit 상태 (line 434):**
```tsx
// 삭제
<Text style={styles.stateEmoji}>🎯</Text>
// 추가
<Ionicons name="checkmark-circle-outline" size={32} color={TEXT_GRAY} />
```

**1e. no_variants 상태 (line 449):**
```tsx
// 삭제
<Text style={styles.stateEmoji}>❓</Text>
// 추가
<Ionicons name="help-circle-outline" size={32} color={TEXT_GRAY} />
```

**1f. error 상태 (line 458):**
```tsx
// 삭제
<Text style={styles.stateEmoji}>😵</Text>
// 추가
<Ionicons name="alert-circle-outline" size={32} color={TEXT_GRAY} />
```

**1g. `rollNote` t() 호출에서 `{limit: DAILY_LIMIT}` 파라미터 제거 (line 472):**
```tsx
// 기존
<Text style={styles.bottomNote}>{t("gacha.roll.rollNote", { limit: DAILY_LIMIT })}</Text>
// 변경
<Text style={styles.bottomNote}>{t("gacha.roll.rollNote")}</Text>
```

**1h. `dailyLimitSubtitle` t() 호출에서 `{limit: DAILY_LIMIT}` 파라미터 제거 (line 436):**
```tsx
// 기존
<Text style={styles.stateSubtitle}>{t("gacha.roll.dailyLimitSubtitle", { limit: DAILY_LIMIT })}</Text>
// 변경
<Text style={styles.stateSubtitle}>{t("gacha.roll.dailyLimitSubtitle")}</Text>
```

- [ ] **Step 2: 닫기 버튼 정리 — result만 텍스트 링크, 나머지 제거**

line 475-479의 `bottomSection` 내 닫기 버튼 블록:

```tsx
// 기존
{(status === "result" || status === "already_rolled" || status === "daily_limit" || status === "no_variants" || status === "error") && (
  <TouchableOpacity style={styles.closeOutlineBtn} onPress={onClose}>
    <Text style={styles.closeOutlineBtnText}>{t("gacha.roll.close")}</Text>
  </TouchableOpacity>
)}

// 변경 — result 상태에서만 텍스트 링크
{status === "result" && (
  <TouchableOpacity
    onPress={onClose}
    style={{ alignItems: "center", paddingVertical: 12 }}
  >
    <Text style={{ fontSize: 15, color: TEXT_GRAY }}>{t("gacha.roll.close")}</Text>
  </TouchableOpacity>
)}
```

- [ ] **Step 3: 버튼 규격 통일 (height, borderRadius)**

`styles.ctaBtn` (line 790-801):
```ts
ctaBtn: {
  backgroundColor: PRIMARY,
  borderRadius: 8,      // 16 → 8
  height: 44,           // 56 → 44
  alignItems: "center",
  justifyContent: "center",
  shadowColor: PRIMARY,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 8,
  elevation: 4,
},
ctaBtnText: { fontSize: 16, fontWeight: "700", color: WHITE },  // 18 → 16
```

`styles.closeOutlineBtn` 및 `closeOutlineBtnText` 스타일: result 상태 닫기를 인라인 스타일로 교체했으므로 두 스타일 항목 삭제.

- [ ] **Step 4: nextAtValue 색상 변경**

`styles.nextAtValue` (line 781):
```ts
nextAtValue: { fontSize: 18, fontWeight: "700", color: TEXT_DARK },  // PRIMARY → TEXT_DARK
```

- [ ] **Step 5: stateEmoji 스타일 삭제**

`styles.stateEmoji` (line 758) 항목 삭제:
```ts
// 삭제
stateEmoji: { fontSize: 64, marginBottom: 8 },
```

- [ ] **Step 6: freeBadge 스타일 삭제**

`styles.freeBadge`와 `styles.freeBadgeText` 항목 삭제 (line 607-618).

- [ ] **Step 7: TypeScript 타입 체크**

```bash
cd /Users/colin/Git/gacha-map && rtk tsc --project apps/mobile/tsconfig.json --noEmit 2>&1 | head -30
```

Expected: 에러 없음

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/components/organisms/gacha/GachaRollModal.view.tsx
git commit -m "feat(mobile): GachaRollModal 시각 개선 — 이모지 제거, 버튼 통일, 닫기 단순화"
```

---

## Task 6: GachaRollModal 컨테이너 — onRolled prop

**Files:**
- Modify: `apps/mobile/components/organisms/gacha/GachaRollModal.tsx`

**Interfaces:**
- Produces: `onRolled?: (result: GachaRollResult) => void` prop — status가 "result"로 전환되는 시점에 호출됨. 모달을 닫지 않음.

- [ ] **Step 1: onRolled prop 추가 및 useEffect로 트리거**

`apps/mobile/components/organisms/gacha/GachaRollModal.tsx` 전체를 아래로 교체:

```tsx
import { useEffect } from "react";
import { useGachaRoll } from "@/hooks/useGachaRoll";
import GachaRollModalView from "./GachaRollModal.view";
import type { GachaRollResult } from "@gacha-map/shared";

interface Props {
  productId: string;
  isLoggedIn: boolean;
  onClose: () => void;
  onLoginRequired: () => void;
  onRolled?: (result: GachaRollResult) => void;
}

const GachaRollModal = ({
  productId,
  isLoggedIn,
  onClose,
  onLoginRequired,
  onRolled,
}: Props) => {
  const { status, result, nextAvailableAt, errorMessage, roll } =
    useGachaRoll(productId);

  useEffect(() => {
    if (status === "result" && result && onRolled) {
      onRolled(result);
    }
  }, [status, result, onRolled]);

  return (
    <GachaRollModalView
      status={status}
      result={result}
      nextAvailableAt={nextAvailableAt}
      errorMessage={errorMessage}
      isLoggedIn={isLoggedIn}
      onRoll={roll}
      onClose={onClose}
      onLoginRequired={onLoginRequired}
    />
  );
};

export default GachaRollModal;
```

- [ ] **Step 2: 타입 체크**

```bash
cd /Users/colin/Git/gacha-map && rtk tsc --project apps/mobile/tsconfig.json --noEmit 2>&1 | head -30
```

Expected: 에러 없음

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/organisms/gacha/GachaRollModal.tsx
git commit -m "feat(mobile): GachaRollModal에 onRolled 콜백 prop 추가"
```

---

## Task 7: 상세 페이지 — 버튼 규격 + rollStatus 확장 + 인라인 카드

**Files:**
- Modify: `apps/mobile/app/gacha/[id].tsx`

**Interfaces:**
- Consumes: `GachaRollModal.onRolled` (Task 6)
- Consumes: `roll-status` API `rolledVariant` 필드 (Task 1)

**Prerequisites:** Task 3, Task 6 완료 후 진행

- [ ] **Step 1: rollStatus 타입 확장**

`apps/mobile/app/gacha/[id].tsx` line 135-139의 `rollStatus` state 타입 교체:

```ts
const [rollStatus, setRollStatus] = useState<{
  canRoll: boolean;
  reason?: "no_variants" | "already_rolled" | "daily_limit";
  nextAvailableAt?: string;
  rolledVariant?: {
    id: string;
    name: string;
    name_ko: string | null;
    image_url: string | null;
  };
} | null>(null);
```

- [ ] **Step 2: 하단 버튼 규격 수정**

line 409-422의 버튼 스타일:
```tsx
<TouchableOpacity
  style={{
    backgroundColor: blocked ? GRAY_200 : PRIMARY,
    borderRadius: 8,    // 14 → 8
    height: 44,         // 52 → 44
    alignItems: "center",
    justifyContent: "center",
  }}
  onPress={blocked ? undefined : () => setRollOpen(true)}
  disabled={!!blocked}
>
  <Text style={{ fontSize: 15, fontWeight: "700", color: blocked ? TEXT_GRAY : WHITE }}>
    {t("gacha.roll.rollBtn")}
  </Text>
</TouchableOpacity>
```

- [ ] **Step 3: 인라인 결과 카드 컴포넌트 추가**

`GachaDetailScreen` 컴포넌트 위, `ShopThumb` 함수 아래에 추가:

```tsx
function RolledResultCard({
  variant,
}: {
  variant: { id: string; name: string; name_ko: string | null; image_url: string | null };
}) {
  const { t } = useTranslation();
  const [imgError, setImgError] = useState(false);
  const displayName = variant.name_ko ?? variant.name;
  const showImg = !imgError && !!variant.image_url;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        backgroundColor: GRAY_100,
        borderRadius: 8,
        padding: 12,
        marginHorizontal: 16,
        marginTop: 12,
      }}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 8,
          backgroundColor: THUMBNAIL_PLACEHOLDER,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {showImg ? (
          <Image
            source={{ uri: variant.image_url! }}
            style={{ width: 48, height: 48 }}
            resizeMode="cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <Ionicons name="gift-outline" size={22} color={GRAY_400} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 11, color: TEXT_GRAY, marginBottom: 2 }}>
          {t("gacha.roll.todayResult")}
        </Text>
        <Text numberOfLines={2} style={{ fontSize: 13, fontWeight: "700", color: TEXT_DARK }}>
          {displayName}
        </Text>
      </View>
    </View>
  );
}
```

- [ ] **Step 4: i18n 키 "todayResult" 추가**

`apps/mobile/messages/ko.json`의 `gacha.roll` 섹션에 추가:
```json
"todayResult": "오늘 뽑은 상품"
```

`apps/mobile/messages/en.json`:
```json
"todayResult": "Today's result"
```

- [ ] **Step 5: ScrollView 내 카드 삽입**

`apps/mobile/app/gacha/[id].tsx`의 ScrollView 내, 상품 정보 블록(`{/* 구분선 */}`) 바로 위에 추가:

```tsx
{/* 오늘 뽑은 결과 카드 */}
{rollStatus?.rolledVariant && (
  <RolledResultCard variant={rollStatus.rolledVariant} />
)}

{/* 구분선 */}
<View style={{ height: 8, backgroundColor: GRAY_100 }} />
```

- [ ] **Step 6: onRolled 콜백 처리**

`GachaRollModal` 사용 부분(line 433-440)에 `onRolled` prop 추가:

```tsx
{id && rollOpen && (
  <GachaRollModal
    productId={id}
    isLoggedIn={!!isLoggedIn}
    onClose={() => setRollOpen(false)}
    onLoginRequired={() => { setRollOpen(false); router.push("/login" as never); }}
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
      });
    }}
  />
)}
```

- [ ] **Step 7: 타입 체크**

```bash
cd /Users/colin/Git/gacha-map && rtk tsc --project apps/mobile/tsconfig.json --noEmit 2>&1 | head -30
```

Expected: 에러 없음

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/app/gacha/\[id\].tsx apps/mobile/messages/ko.json apps/mobile/messages/en.json
git commit -m "feat(mobile): 뽑기 상세 페이지 — 버튼 규격 통일, 결과 인라인 카드, onRolled 콜백"
```

---

## Self-Review

### Spec Coverage

| 스펙 항목 | 커버 Task |
|---|---|
| roll-status GET `rolledVariant` 추가 | Task 1 |
| roll POST reason 통일 | Task 2 |
| Promise.all .catch() 버그픽스 | Task 3 |
| 로그인 이동 시 모달 닫힘 | Task 3 |
| i18n bottomNote 간소화 | Task 4 |
| stateEmoji → Ionicons | Task 5 |
| freeBadge 제거 | Task 5 |
| 닫기 버튼 통일 | Task 5 |
| 버튼 height 44 / borderRadius 8 | Task 5 (모달), Task 7 (상세) |
| nextAtValue TEXT_DARK | Task 5 |
| DAILY_LIMIT view에서 제거 | Task 4 + Task 5 |
| GachaRollModal onRolled prop | Task 6 |
| 상세 페이지 rollStatus 타입 확장 | Task 7 |
| 인라인 결과 카드 | Task 7 |
| onRolled 콜백 처리 | Task 7 |

### Verification Checklist

- [ ] roll-status API: already_rolled 시 rolledVariant 반환
- [ ] roll-status API: daily_limit + 이 상품 뽑은 경우 rolledVariant 반환
- [ ] roll-status API: daily_limit + 이 상품 안 뽑은 경우 rolledVariant 없음
- [ ] 상세 페이지: rollStatus.rolledVariant 있을 때 카드 렌더링
- [ ] 상세 페이지: onRolled 콜백 → rollStatus 즉시 업데이트 → 카드 표시
- [ ] 상세 페이지: Promise.all roll-status 실패 시 페이지 정상 로드
- [ ] 상세 페이지: 로그인 이동 시 모달 닫힘
- [ ] 모달: stateEmoji 4곳 아이콘으로 대체 (CyclingIcon 건드리지 않음)
- [ ] 모달: freeBadge 없음, bottomNote 간소화
- [ ] 모달: result 상태만 하단 텍스트 링크, 나머지 X만
- [ ] 모달: 버튼 height 44, borderRadius 8
- [ ] 모달: nextAtValue 색상 TEXT_DARK
- [ ] 모달: CyclingIcon 정상 동작
- [ ] POST API reason "already_rolled" 통일
- [ ] ko/en i18n 동기화
