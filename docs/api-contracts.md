# API Contracts

gacha-map 백엔드 엔드포인트 명세서입니다.
엔드포인트를 추가하거나 수정할 때 반드시 이 문서를 함께 업데이트하세요.

---

## 목차

- [Shops](#shops)

---

## Shops

> 데이터 소스: `public.shops` 테이블 (RLS 적용, `status = 'approved'` 고정)

### `GET /api/shops`

승인된 샵 목록을 반환합니다. 지도/목록 화면 공통으로 사용합니다.

#### Query Parameters

| 파라미터 | 타입   | 필수 | 설명 |
|----------|--------|------|------|
| `q`      | string | 아니오 | 이름/주소 부분 검색 (대소문자 무시) |
| `tag`    | string | 아니오 | 태그 필터 (배열 포함 여부 검사) |
| `swLat`  | number | 아니오 | 지도 뷰포트 남서쪽 위도 |
| `swLng`  | number | 아니오 | 지도 뷰포트 남서쪽 경도 |
| `neLat`  | number | 아니오 | 지도 뷰포트 북동쪽 위도 |
| `neLng`  | number | 아니오 | 지도 뷰포트 북동쪽 경도 |
| `offset` | number | 아니오 | 페이지네이션 시작 인덱스 (기본값: 0) |
| `limit`  | number | 아니오 | 한 번에 반환할 최대 수 (기본값: 20) |

> bbox 필터(`swLat` ~ `neLng`)는 4개 모두 있어야 적용됩니다.

#### Response

```ts
{
  shops: ShopSummary[]
  total: number   // 조건에 맞는 전체 수 (무한 스크롤 종료 판단용)
  offset: number
  limit: number
}

interface ShopSummary {
  id: string        // uuid
  name: string
  address: string | null
  lat: number
  lng: number
  tags: string[]
  image_urls: string[]
  is_authorized: boolean
}
```

#### Examples

```
GET /api/shops
GET /api/shops?q=가챠
GET /api/shops?tag=피규어
GET /api/shops?q=가챠&tag=피규어
GET /api/shops?swLat=37.4&swLng=126.9&neLat=37.6&neLng=127.1
GET /api/shops?offset=20&limit=20
```

#### Error Response

```ts
{ error: string }  // HTTP 500
```

#### Source

- Route: `src/app/api/shops/route.ts`
- Table: `public.shops` (Supabase, RLS)
- Updated: 2026-04-09

---

### `GET /api/shops/[id]`

샵 상세 정보를 반환합니다. 마커 클릭 시 상세 데이터 fetch에 사용합니다.

#### Path Parameters

| 파라미터 | 타입   | 필수 | 설명 |
|----------|--------|------|------|
| `id`     | string | 예   | 샵 UUID |

#### Response

```ts
{
  shop: ShopDetail
}

interface ShopDetail {
  id: string
  name: string
  address: string | null
  lat: number
  lng: number
  description: string | null
  tags: string[]
  image_urls: string[]
  is_authorized: boolean
  created_at: string
  updated_at: string
}
```

#### Error Response

```ts
{ error: string }  // HTTP 404 (없는 ID) | HTTP 500
```

#### Source

- Route: `src/app/api/shops/[id]/route.ts`
- Table: `public.shops` (Supabase, RLS)
- Updated: 2026-04-09

