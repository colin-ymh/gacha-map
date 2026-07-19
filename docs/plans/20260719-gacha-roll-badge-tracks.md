# 가챠 뽑기 배지 트랙 구현 계획

> Spec: `docs/superpowers/specs/2026-07-19-gacha-roll-badge-design.md`

## Request

뽑기(가챠 뽑아보기) 행동 기반 배지 트랙 2개 신설: 뽑은 상품 종류 개수, 뽑기 시도한 날짜 수. threshold 달성 시 자동으로 배지 부여.

## Scope

- `badge_definitions`에 `gacha_roll_variety`, `gacha_roll_days` 트랙 6개 row 추가
- 기존 app-layer 어워드 엔진(`checkAndAwardBadge`)에 두 트랙 카운트 로직 훅킹
- 롤 API 라우트에서 롤 성공 직후 `checkAndAwardBadge` 호출
- 기존 데이터 대상 1회성 소급 부여 (마이그레이션 내 포함)
- `BadgeTrack` 공유 타입, 모바일/웹 `BADGE_TRACKS` 배열에 신규 트랙 2개 추가

## Out of Scope

- 기존 6개 트랙(quick_report 등)의 어워드 로직 변경
- 롤 직후 즉시 모달 표시 (실시간 피드백) — 기존 세션 로드 시점 알림 흐름 그대로 사용
- 배지 아이콘 에셋
- 다국어 배지 카피

## Relevant Files

- `supabase/migrations/20260608_badge_system.sql` — `badge_definitions`, `user_badges` 스키마 원본
- `supabase/migrations/20260627_gacha_roll_results.sql` — 카운트 소스 테이블
- `supabase/migrations/20260706_remove_gacha_roll_unique_constraint.sql`, `..._day_unique_index.sql` — 기존 unique index 제거 이력 (신규 인덱스 필요 사유)
- `apps/web/src/lib/badges/earn.ts` — `checkAndAwardBadge()`, 기존 어워드 엔진
- `apps/web/src/lib/badges/count.ts` — `getBadgeCount()`, 카운트 로직
- `apps/web/src/app/api/gacha-products/[id]/roll/route.ts` — 롤 API, insert 성공 지점(L75-97)
- `packages/shared/src/types/badge.ts` — `BadgeTrack` union
- `apps/mobile/app/badges.tsx:51-58`, `apps/web/src/app/[locale]/mypage/badges/page.tsx:370-377` — `BADGE_TRACKS` 배열

## Global Constraints

- DB 변경은 dev 먼저 적용 → 확인 → prod 적용 (Supabase MCP `apply_migration`, 메인 세션에서만)
- 마이그레이션 파일은 `supabase/migrations/`에 커밋
- 색상 하드코딩 금지 — 이번 작업은 색상 변경 없음, 해당 없음

---

## Adversarial Review

codex adversarial-review 실행 결과 (verdict: needs-attention), 검증 완료:

1. **[High, 확인됨]** `gacha_roll_results`는 `20260706_remove_gacha_roll_unique_constraint.sql` / `..._day_unique_index.sql`에서 기존 unique index가 제거된 이후 `user_id` 계열 인덱스가 없는 상태. 카운트 쿼리가 롤 API의 쓰기 경로에서 매번 실행되므로 인덱스 없이는 데이터 증가 시 롤 자체가 느려질 위험. → 마이그레이션에 인덱스 추가.
2. **[Medium, 확인됨]** `packages/shared/src/types/badge.ts`의 `BadgeTrack`이 closed union인데 최초 계획에서 빠져 있었음 → DB가 반환하는 새 track 값이 타입상 불가능한 상태가 되어 schema drift 발생. → 추가.
3. **[Medium, 확인됨]** `apps/web/src/app/[locale]/mypage/badges/page.tsx`에 웹 전용 배지 화면이 실제로 존재 (최초 조사 누락, `apps/web` 하위 파일 검색이 불완전했음) → 웹도 `BADGE_TRACKS` 갱신 필요.

세 건 모두 확인 후 아래 Final Plan에 반영. 추가로 리뷰 과정에서 **"어워드 엔진 자체가 없다"는 스펙의 최초 전제가 틀렸음**을 별도로 발견 (`apps/web/src/lib/badges/earn.ts`에 이미 존재) — 트리거 신설 대신 기존 엔진 재사용으로 아키텍처 변경. (자세한 내용: 스펙 문서 Context 섹션 정정 내역 참고)

## Final Plan

### Task 1: 공유 타입 갱신

**Files:**

- Modify: `packages/shared/src/types/badge.ts`

**변경:**

```typescript
export type BadgeTrack =
  | "quick_report"
  | "shop_review"
  | "new_shop_report"
  | "closed_shop_report"
  | "fix_info_report"
  | "wishlist"
  | "gacha_roll_variety"
  | "gacha_roll_days"
  | "operator"
  | "admin";
```

- [x] Step 1: union에 두 값 추가
- [x] Step 2: `rtk tsc -p apps/web/tsconfig.json --noEmit` / `rtk tsc -p apps/mobile/tsconfig.json --noEmit` 실행 — 기존 pre-existing 에러(BlurViewCompat 등, badges 무관) 외 신규 에러 없는지 확인

### Task 2: 카운트 로직 추가

**Files:**

- Modify: `apps/web/src/lib/badges/count.ts`

**Interfaces:**

- Consumes: `SupabaseClient`, `BadgeTrack`(Task 1)
- Produces: `getBadgeCount(supabase, userId, track): Promise<number>` — 기존 시그니처 유지, 내부 분기만 추가

**변경 후 `getBadgeCount`:**

```typescript
export async function getBadgeCount(
  supabase: SupabaseClient,
  userId: string,
  track: BadgeTrack,
): Promise<number> {
  if (track === "gacha_roll_variety" || track === "gacha_roll_days") {
    return getGachaRollCount(supabase, userId, track);
  }

  const { count } = await supabase
    .from("badge_count_log")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("action_type", track);
  return count ?? 0;
}

async function getGachaRollCount(
  supabase: SupabaseClient,
  userId: string,
  track: "gacha_roll_variety" | "gacha_roll_days",
): Promise<number> {
  const { data } = await supabase
    .from("gacha_roll_results")
    .select("product_id, rolled_at")
    .eq("user_id", userId);

  if (!data?.length) return 0;

  if (track === "gacha_roll_variety") {
    return new Set(data.map((r) => r.product_id)).size;
  }

  const kstDates = data.map((r) =>
    new Date(new Date(r.rolled_at).getTime() + 9 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10),
  );
  return new Set(kstDates).size;
}
```

- [x] Step 1: 위 코드로 `count.ts` 수정 (`tryLogBadgeCount`는 변경 없음, gacha 트랙에서 호출 안 함)

### Task 3: 마이그레이션 — 배지 정의 + 인덱스 + 소급 부여

**Files:**

- Create: `supabase/migrations/20260719_gacha_roll_badges.sql`

```sql
-- 뽑기 행동 기반 배지 트랙: gacha_roll_variety(뽑은 상품 종류), gacha_roll_days(뽑기 시도한 날짜 수)
-- 어워드는 기존 app-layer 엔진(apps/web/src/lib/badges/earn.ts::checkAndAwardBadge) 재사용.
-- DB 트리거 없음 — roll API 라우트에서 롤 성공 직후 checkAndAwardBadge를 직접 호출한다.

INSERT INTO badge_definitions (track, tier, name, description, threshold) VALUES
  ('gacha_roll_variety', 1, '뽑기 입문자', '처음으로 가챠를 뽑아봤어요', 1),
  ('gacha_roll_variety', 2, '가챠 탐식가', '다양한 상품을 뽑아보고 있어요', 20),
  ('gacha_roll_variety', 3, '가챠 컬렉터', '온갖 가챠를 섭렵했어요', 50),
  ('gacha_roll_days', 1, '첫 방문', '처음 뽑기를 시도했어요', 1),
  ('gacha_roll_days', 2, '단골 뽑기러', '꾸준히 가챠를 뽑고 있어요', 10),
  ('gacha_roll_days', 3, '가챠 중독자', '가챠 뽑기가 일상이 됐어요', 30)
ON CONFLICT (track, tier) DO NOTHING;

-- gacha_roll_results 카운트 쿼리(user_id 필터 + product_id/rolled_at 조회) 지원용 인덱스.
-- 20260706_remove_gacha_roll_unique_constraint.sql / ..._day_unique_index.sql 에서
-- 기존 unique index가 제거된 이후로 user_id 계열 인덱스가 없는 상태였음.
CREATE INDEX IF NOT EXISTS gacha_roll_results_user_id_rolled_at_idx
  ON gacha_roll_results (user_id, rolled_at)
  INCLUDE (product_id);

-- 마이그레이션 적용 이전에 이미 뽑기 기록이 있는 유저 대상 1회성 소급 부여.
-- checkAndAwardBadge는 롤 1회당 트랙별로 최고 미획득 티어 1개만 주므로
-- (다음 롤을 하지 않으면 영영 못 받음), 기존 데이터는 여기서 한 번에 모든 자격 티어를 채워준다.
INSERT INTO user_badges (user_id, badge_definition_id)
SELECT grr.user_id, bd.id
FROM (
  SELECT
    user_id,
    count(DISTINCT product_id) AS variety_count,
    count(DISTINCT date(rolled_at AT TIME ZONE 'Asia/Seoul')) AS days_count
  FROM gacha_roll_results
  GROUP BY user_id
) grr
JOIN badge_definitions bd
  ON (bd.track = 'gacha_roll_variety' AND bd.threshold <= grr.variety_count)
  OR (bd.track = 'gacha_roll_days' AND bd.threshold <= grr.days_count)
ON CONFLICT DO NOTHING;
```

- [x] Step 1: 파일 생성
- [ ] Step 2: `mcp__supabase__apply_migration`으로 **dev** 프로젝트 적용
- [ ] Step 3: dev에서 `EXPLAIN`으로 인덱스 사용 확인

```sql
EXPLAIN SELECT product_id, rolled_at FROM gacha_roll_results WHERE user_id = '<any_existing_user_id>';
```

Expected: `Index Only Scan` 또는 `Index Scan` on `gacha_roll_results_user_id_rolled_at_idx` (Seq Scan이면 재검토)

- [ ] Step 4: 정의 row 확인

```sql
SELECT track, tier, name, threshold FROM badge_definitions
WHERE track IN ('gacha_roll_variety', 'gacha_roll_days')
ORDER BY track, tier;
```

Expected: 6 rows, threshold 1/20/50 (variety), 1/10/30 (days)

- [ ] Step 5: 소급 부여 확인 (dev에 기존 뽑기 기록 있는 유저가 있다면)

```sql
SELECT ub.user_id, bd.track, bd.tier FROM user_badges ub
JOIN badge_definitions bd ON bd.id = ub.badge_definition_id
WHERE bd.track IN ('gacha_roll_variety', 'gacha_roll_days');
```

Expected: 기존 뽑기 횟수/종류에 맞는 티어가 이미 채워져 있음

### Task 4: 롤 라우트에서 어워드 엔진 호출

**Files:**

- Modify: `apps/web/src/app/api/gacha-products/[id]/roll/route.ts`

**Interfaces:**

- Consumes: `checkAndAwardBadge(supabase, userId, track)` from `@/lib/badges/earn` (기존 함수, 시그니처 불변)

**변경 (import 추가):**

```typescript
import { checkAndAwardBadge } from "@/lib/badges/earn";
```

**변경 (insert 성공 후, `remainingToday` 계산 이전에 삽입):**

```typescript
try {
  await checkAndAwardBadge(adminClient, user.id, "gacha_roll_variety");
  await checkAndAwardBadge(adminClient, user.id, "gacha_roll_days");
} catch {
  // badge award failure must not affect the roll result
}
```

주의: `insertError.code === "23505"` 분기(ephemeral 결과, 실제 insert 안 됨)에서는 호출하지 않음 — 실제 row가 생성된 성공 경로에서만 호출.

- [x] Step 1: import 추가
- [x] Step 2: insert 성공 분기에 호출 삽입 (23505 분기 아님 확인)
- [ ] Step 3: dev 환경에서 테스트 계정으로 실제 롤 API 호출 (`curl` 또는 앱) → `user_badges`에 두 트랙 row 생성 확인

### Task 5: 클라이언트 트랙 등록 (모바일 + 웹)

**Files:**

- Modify: `apps/mobile/app/badges.tsx:51-58`
- Modify: `apps/web/src/app/[locale]/mypage/badges/page.tsx:370-377`

두 파일의 `BADGE_TRACKS` 배열에 동일하게 추가:

```typescript
const BADGE_TRACKS = [
  "quick_report",
  "shop_review",
  "new_shop_report",
  "closed_shop_report",
  "fix_info_report",
  "wishlist",
  "gacha_roll_variety",
  "gacha_roll_days",
] as const;
```

- [x] Step 1: `apps/mobile/app/badges.tsx` 수정
- [x] Step 2: `apps/web/src/app/[locale]/mypage/badges/page.tsx` 수정
- [ ] Step 3: 웹 dev 서버로 `/mypage/badges` 화면에서 두 트랙 잠금 상태 렌더링 확인
- [ ] Step 4: 커밋

```bash
git add packages/shared/src/types/badge.ts apps/web/src/lib/badges/count.ts \
  apps/web/src/app/api/gacha-products/\[id\]/roll/route.ts \
  apps/mobile/app/badges.tsx apps/web/src/app/\[locale\]/mypage/badges/page.tsx \
  supabase/migrations/20260719_gacha_roll_badges.sql
git commit -m "feat: add gacha roll badge tracks (variety, days)"
```

### Task 6: prod 적용

- [ ] Step 1: dev 검증(Task 3~5) 전부 통과 후 `mcp__supabase__apply_migration`으로 동일 마이그레이션을 **prod** 프로젝트에 적용
- [ ] Step 2: prod에서 Task 3 Step 4 쿼리로 `badge_definitions` 6 row 확인
- [ ] Step 3: prod에서 Task 3 Step 5 쿼리로 소급 부여 결과 확인 (있는 경우)

---

## Verification

1. dev에서 신규 유저 1회 뽑기(API 호출) → `gacha_roll_variety` tier1, `gacha_roll_days` tier1 동시 획득 확인 (`user_badges` 조회)
2. 기존 유저(마이그레이션 이전 이미 뽑기 기록 있는 계정) → 마이그레이션 적용 즉시 소급 배지 부여 확인
3. 같은 유저가 두 번째 롤(다른 상품) → 아직 tier2 미달이면 중복 insert 없음 확인
4. `apps/mobile/app/badges.tsx`, `apps/web/.../mypage/badges/page.tsx` 둘 다 신규 트랙 잠금/해제 렌더링 확인
5. `rtk tsc` 양쪽(web/mobile) 신규 에러 없음 확인
6. prod 적용 후 `badge_definitions` 6 row + 인덱스 존재 확인

## Risks / Questions

- `getBadgeCount`가 유저별 `gacha_roll_results` 전체 row를 읽어 JS에서 distinct 계산 — 인덱스로 완화했으나 유저당 롤 수가 크게 늘면 SQL 집계(RPC)로 전환 검토
- 클라이언트 변경(모바일 `BADGE_TRACKS`)은 OTA 미설정으로 다음 정기 스토어 배포에 포함되어야 반영 — 배포 일정 확인 필요
- 카피 최종 확정 필요 (스펙 초안 그대로 진행, 추후 어드민에서 수정 가능)
