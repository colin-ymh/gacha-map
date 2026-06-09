# 찜한 샵 우선 정렬

## Request

로그인 유저가 찜한 샵들이 추천(recommended) 정렬 시 가장 먼저 노출되도록 한다.

## Scope

- `get_shops_by_score` RPC에 `p_user_id` 파라미터 추가
- ORDER BY 첫 번째 키로 `is_wishlisted DESC` 적용
- API route (`/api/shops`) recommended 분기에서 유저 ID를 RPC에 전달
- 비로그인 시 기존 동작 그대로 (no-op)

## Out of Scope

- distance / name / wishlist_count 정렬 — 변경 없음
- 찜한 샵 시각적 배지/하이라이트 — 미포함
- 모바일 앱 — 미포함 (웹 전용)

## Relevant Files

- `supabase/migrations/20260608_add_recommended_sort_rpc.sql` — `get_shops_by_score` RPC 원본
- `apps/web/src/app/api/shops/route.ts` — recommended 분기에서 RPC 호출
- `supabase/schema.sql` — wishlists 테이블 참고

## Plan

### 1. DB 마이그레이션

새 마이그레이션 파일: `supabase/migrations/20260609_wishlist_priority_in_score_rpc.sql`

```sql
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

`GROUP BY s.id, uw.user_id`: `uw.user_id`는 NULL 또는 단일 값이므로 그룹당 행 수 변화 없음.

### 2. API Route 수정

`apps/web/src/app/api/shops/route.ts` — recommended 분기:

```ts
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

## Verification

- 로그인 유저: 찜한 샵이 뷰포트 내에 있으면 목록 최상단에 노출
- 비로그인 유저: 기존 composite score 순서 그대로
- `p_user_id = null` 전달 시 RPC 내 `uw.user_id IS NOT NULL` 조건 false → 정렬 키 0 → 기존 동작
- 페이지네이션: offset이 바뀌어도 찜한 샵은 항상 앞 페이지에 위치

## Risks / Questions

- `SECURITY DEFINER` 함수에서 `p_user_id`를 직접 받음 → 임의 유저 ID 전달 가능. 단, 조회만 하므로 데이터 노출 위험 없음 (public 데이터)
- `GROUP BY s.id, uw.user_id` 변경으로 기존 쿼리 플랜 영향 가능. 데이터 규모 작으므로 무시 가능 수준
- RPC 시그니처에 `p_user_id` 추가 시 기존 호출부(파라미터 없이 호출)는 DEFAULT NULL로 그대로 동작

## Final Plan

1. 마이그레이션 파일 작성 (`20260609_wishlist_priority_in_score_rpc.sql`)
2. Supabase dev 브랜치에 적용 후 확인
3. `apps/web/src/app/api/shops/route.ts` recommended 분기 수정
4. 로컬에서 로그인/비로그인 시나리오 검증
5. prod 적용
