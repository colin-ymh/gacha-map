# 찜한 샵 우선 정렬 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 로그인 유저가 찜한 샵이 recommended 정렬 시 뷰포트 내에서 최상단에 노출되도록 한다.

**Architecture:** `get_shops_by_score` RPC에 선택적 `p_user_id` 파라미터를 추가해 찜 여부를 ORDER BY 첫 번째 키로 적용. API route가 서버 세션에서 유저 ID를 추출해 RPC에 전달. 비로그인 시 `null` 전달로 기존 동작 유지.

**Tech Stack:** PostgreSQL (Supabase RPC), Next.js API Route, TypeScript, Vitest

---

> ⚠️ **Main session 전용 단계:** Task 1에서 마이그레이션 파일을 작성하고 커밋한 뒤, **메인 세션에서 Supabase MCP로 직접 적용**해야 한다. 서브에이전트는 MCP 도구를 사용할 수 없다.

---

## File Map

| File                                                              | Action | 역할                                                           |
| ----------------------------------------------------------------- | ------ | -------------------------------------------------------------- |
| `supabase/migrations/20260609_wishlist_priority_in_score_rpc.sql` | Create | `get_shops_by_score` RPC에 `p_user_id` 추가                    |
| `apps/web/src/app/api/shops/route.ts`                             | Modify | recommended 분기에서 `auth.getUser()` 호출 후 `p_user_id` 전달 |
| `apps/web/src/test/mocks/supabase.ts`                             | Modify | `createSupabaseMock`에 `auth.getUser` 추가                     |
| `apps/web/src/app/api/shops/__tests__/route.test.ts`              | Modify | recommended+bbox 분기 테스트 추가                              |

---

## Task 1: 마이그레이션 파일 작성

**Files:**

- Create: `supabase/migrations/20260609_wishlist_priority_in_score_rpc.sql`

- [ ] **Step 1: 마이그레이션 파일 생성**

```sql
-- supabase/migrations/20260609_wishlist_priority_in_score_rpc.sql
CREATE OR REPLACE FUNCTION public.get_shops_by_score(
  sw_lat double precision,
  sw_lng double precision,
  ne_lat double precision,
  ne_lng double precision,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0,
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  name text,
  address text,
  lat double precision,
  lng double precision,
  is_authorized boolean,
  candidate_group_id bigint,
  wishlist_count bigint,
  opening_hours text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT
    s.id,
    s.name,
    s.address,
    s.lat,
    s.lng,
    s.is_authorized,
    s.candidate_group_id,
    COUNT(DISTINCT w.id) AS wishlist_count,
    s.opening_hours
  FROM shops s
  LEFT JOIN wishlists w ON w.shop_id = s.id
  LEFT JOIN wishlists uw ON uw.shop_id = s.id AND uw.user_id = p_user_id
  LEFT JOIN reviews r ON r.shop_id = s.id
  LEFT JOIN shop_gacha_products sgp ON sgp.shop_id = s.id
  LEFT JOIN shop_quick_reports qr
    ON qr.shop_id = s.id AND qr.kind = 'gacha_present'
  WHERE s.status = 'active'
    AND s.lat >= sw_lat AND s.lat <= ne_lat
    AND s.lng >= sw_lng AND s.lng <= ne_lng
  GROUP BY s.id, uw.user_id
  ORDER BY
    (CASE WHEN uw.user_id IS NOT NULL THEN 1 ELSE 0 END) DESC,
    (
      COUNT(DISTINCT w.id) +
      COUNT(DISTINCT r.id) +
      COUNT(DISTINCT sgp.id) +
      COUNT(DISTINCT qr.id)
    ) DESC,
    s.name ASC
  LIMIT p_limit OFFSET p_offset;
$$;
```

- [ ] **Step 2: 커밋**

```bash
rtk git add supabase/migrations/20260609_wishlist_priority_in_score_rpc.sql
rtk git commit -m "feat(db): add p_user_id to get_shops_by_score for wishlist priority sort"
```

> ⚠️ **이 이후 메인 세션이 직접 마이그레이션 적용 필요 (Supabase MCP). 서브에이전트는 여기서 대기.**

---

## Task 2: Supabase Mock에 auth 추가

**Files:**

- Modify: `apps/web/src/test/mocks/supabase.ts`

현재 `createSupabaseMock`에는 `auth.getUser`가 없다. route.ts가 recommended 분기에서 `supabase.auth.getUser()`를 호출하게 되므로, 테스트 mock에도 추가해야 한다.

- [ ] **Step 1: `createSupabaseMock`에 `auth` 필드 추가**

`apps/web/src/test/mocks/supabase.ts`에서 `createSupabaseMock` return 객체에 추가:

```ts
export function createSupabaseMock(
  data: unknown,
  error: { message: string; code?: string } | null = null,
  count: number = 0,
  authUser: { id: string } | null = null, // 신규 파라미터
) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    contains: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue({ data, error, count }),
    single: vi.fn().mockResolvedValue({ data, error }),
    then: (
      resolve: (value: {
        data: unknown;
        error: typeof error;
        count: number;
      }) => void,
      reject?: (reason: unknown) => void,
    ) => Promise.resolve({ data, error, count }).then(resolve, reject),
  };

  return {
    from: vi.fn().mockReturnValue(chain),
    rpc: vi.fn().mockResolvedValue({ data, error }),
    auth: {
      getUser: vi
        .fn()
        .mockResolvedValue({ data: { user: authUser }, error: null }),
    },
    _chain: chain,
  };
}
```

기존 호출부는 4번째 인수를 생략하면 `authUser = null`이 되므로 변경 없이 동작한다.

- [ ] **Step 2: 커밋**

```bash
rtk git add apps/web/src/test/mocks/supabase.ts
rtk git commit -m "test: add auth.getUser to createSupabaseMock"
```

---

## Task 3: 실패 테스트 작성

**Files:**

- Modify: `apps/web/src/app/api/shops/__tests__/route.test.ts`

- [ ] **Step 1: recommended+bbox 테스트 2개 추가**

`apps/web/src/app/api/shops/__tests__/route.test.ts`의 `describe("GET /api/shops")` 블록 내 마지막 테스트 뒤에 추가:

```ts
it("recommended 정렬+bbox: 로그인 유저의 ID가 p_user_id로 전달된다", async () => {
  const mock = createSupabaseMock(
    [mockShops[0]],
    null,
    1,
    { id: "user-abc-123" }, // authUser
  );
  mockCreateClient.mockReturnValue(mock);

  const { GET } = await import("../route");
  await GET(
    makeRequest({
      sort: "recommended",
      swLat: "37.0",
      swLng: "126.5",
      neLat: "38.0",
      neLng: "127.5",
    }),
  );

  expect(mock.rpc).toHaveBeenCalledWith("get_shops_by_score", {
    sw_lat: 37.0,
    sw_lng: 126.5,
    ne_lat: 38.0,
    ne_lng: 127.5,
    p_limit: 20,
    p_offset: 0,
    p_user_id: "user-abc-123",
  });
});

it("recommended 정렬+bbox: 비로그인 시 p_user_id가 null로 전달된다", async () => {
  const mock = createSupabaseMock(
    [mockShops[0]],
    null,
    1,
    null, // 비로그인
  );
  mockCreateClient.mockReturnValue(mock);

  const { GET } = await import("../route");
  await GET(
    makeRequest({
      sort: "recommended",
      swLat: "37.0",
      swLng: "126.5",
      neLat: "38.0",
      neLng: "127.5",
    }),
  );

  expect(mock.rpc).toHaveBeenCalledWith("get_shops_by_score", {
    sw_lat: 37.0,
    sw_lng: 126.5,
    ne_lat: 38.0,
    ne_lng: 127.5,
    p_limit: 20,
    p_offset: 0,
    p_user_id: null,
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd apps/web && rtk vitest run src/app/api/shops/__tests__/route.test.ts
```

Expected: 새로 추가한 2개 테스트 FAIL (route가 아직 `p_user_id`를 전달하지 않으므로)

- [ ] **Step 3: 커밋**

```bash
rtk git add apps/web/src/app/api/shops/__tests__/route.test.ts
rtk git commit -m "test: add failing tests for wishlist priority in recommended sort"
```

---

## Task 4: API Route 수정

**Files:**

- Modify: `apps/web/src/app/api/shops/route.ts:96-125`

- [ ] **Step 1: recommended 분기에 `auth.getUser()` 추가 및 `p_user_id` 전달**

`apps/web/src/app/api/shops/route.ts`에서 아래 블록을 찾아:

```ts
  // recommended sort — composite score RPC
  if (sort === "recommended" && swLat && swLng && neLat && neLng) {
    const bounds = {
      swLat: parseFloat(swLat),
      swLng: parseFloat(swLng),
      neLat: parseFloat(neLat),
      neLng: parseFloat(neLng),
    };
    const { data, error } = await supabase.rpc("get_shops_by_score", {
      sw_lat: bounds.swLat,
      sw_lng: bounds.swLng,
      ne_lat: bounds.neLat,
      ne_lng: bounds.neLng,
      p_limit: limit,
      p_offset: offset,
    });
```

아래로 교체:

```ts
  // recommended sort — composite score RPC
  if (sort === "recommended" && swLat && swLng && neLat && neLng) {
    const bounds = {
      swLat: parseFloat(swLat),
      swLng: parseFloat(swLng),
      neLat: parseFloat(neLat),
      neLng: parseFloat(neLng),
    };
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await supabase.rpc("get_shops_by_score", {
      sw_lat: bounds.swLat,
      sw_lng: bounds.swLng,
      ne_lat: bounds.neLat,
      ne_lng: bounds.neLng,
      p_limit: limit,
      p_offset: offset,
      p_user_id: user?.id ?? null,
    });
```

- [ ] **Step 2: 테스트 실행 — 통과 확인**

```bash
cd apps/web && rtk vitest run src/app/api/shops/__tests__/route.test.ts
```

Expected: 전체 테스트 PASS (기존 테스트 포함)

- [ ] **Step 3: TypeScript 타입 확인**

```bash
cd apps/web && rtk tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 4: 커밋**

```bash
rtk git add apps/web/src/app/api/shops/route.ts
rtk git commit -m "feat(api): pass user id to get_shops_by_score for wishlist-first sorting"
```

---

## Task 5: 마이그레이션 적용 (메인 세션 전용)

> ⚠️ **이 Task는 서브에이전트가 실행할 수 없다. 메인 세션에서 Supabase MCP로 직접 수행.**

- [ ] **Step 1: dev 브랜치에 마이그레이션 적용**

메인 세션에서 Supabase MCP `apply_migration` 호출:

- 파일: `supabase/migrations/20260609_wishlist_priority_in_score_rpc.sql`
- 내용 그대로 적용

- [ ] **Step 2: 동작 검증**

로컬 앱 실행 후 다음 시나리오 확인:

1. 로그인 상태에서 찜한 샵이 있는 지역 → 추천 정렬 목록 최상단에 해당 샵 표시
2. 비로그인 상태 또는 찜 없는 유저 → 기존 composite score 순서 그대로

- [ ] **Step 3: prod 적용 확인 후 메인 브랜치 머지**
