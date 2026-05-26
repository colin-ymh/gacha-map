# API Contracts

gacha-map 백엔드 엔드포인트 명세서입니다.
엔드포인트를 추가하거나 수정할 때 반드시 이 문서를 함께 업데이트하세요.

---

## 목차

- [Shops](#shops)
- [Gacha Products](#gacha-products)
- [Reports](#reports)
- [Shop Applications](#shop-applications)
- [Admin](#admin)

---

## Shops

> 데이터 소스: `public.shops` 테이블 (RLS 적용, `status = 'active'` 고정)

### `GET /api/shops`

승인된 샵 목록을 반환합니다. 지도/목록 화면 공통으로 사용합니다.

#### Query Parameters

| 파라미터 | 타입   | 필수   | 설명                                 |
| -------- | ------ | ------ | ------------------------------------ |
| `q`      | string | 아니오 | 이름/주소 부분 검색 (대소문자 무시)  |
| `tag`    | string | 아니오 | 태그 필터 (배열 포함 여부 검사)      |
| `swLat`  | number | 아니오 | 지도 뷰포트 남서쪽 위도              |
| `swLng`  | number | 아니오 | 지도 뷰포트 남서쪽 경도              |
| `neLat`  | number | 아니오 | 지도 뷰포트 북동쪽 위도              |
| `neLng`  | number | 아니오 | 지도 뷰포트 북동쪽 경도              |
| `offset` | number | 아니오 | 페이지네이션 시작 인덱스 (기본값: 0) |
| `limit`  | number | 아니오 | 한 번에 반환할 최대 수 (기본값: 20)  |

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
{
  error: string;
} // HTTP 500
```

#### Source

- Route: `src/app/api/shops/route.ts`
- Table: `public.shops` (Supabase, RLS)
- Updated: 2026-04-09

---

### `GET /api/shops/[id]`

샵 상세 정보를 반환합니다. 마커 클릭 시 상세 데이터 fetch에 사용합니다.

#### Path Parameters

| 파라미터 | 타입   | 필수 | 설명    |
| -------- | ------ | ---- | ------- |
| `id`     | string | 예   | 샵 UUID |

#### Response

```ts
{
  shop: ShopDetail;
}

interface ShopDetail {
  id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  description: string | null;
  tags: string[];
  image_urls: string[];
  is_authorized: boolean;
  created_at: string;
  updated_at: string;
}
```

#### Error Response

```ts
{
  error: string;
} // HTTP 404 (없는 ID) | HTTP 500
```

#### Source

- Route: `src/app/api/shops/[id]/route.ts`
- Table: `public.shops` (Supabase, RLS)
- Updated: 2026-04-09

---

## Gacha Products

> 데이터 소스: `public.gacha_products` 테이블 (RLS 적용, `status = 'active'` 고정)

### `GET /api/gacha-products`

사용자 등록 선택 목록과 공개 상품 검색에서 공통으로 사용하는 상품 목록을 반환합니다.

#### Query Parameters

| 파라미터       | 타입   | 필수   | 설명                                 |
| -------------- | ------ | ------ | ------------------------------------ |
| `q`            | string | 아니오 | 상품명/JAN/product code 부분 검색    |
| `manufacturer` | string | 아니오 | 제조사 필터                          |
| `offset`       | number | 아니오 | 페이지네이션 시작 인덱스 (기본값: 0) |
| `limit`        | number | 아니오 | 한 번에 반환할 최대 수 (기본값: 20)  |

#### Response

```ts
{
  products: GachaProduct[]
  total: number
  offset: number
  limit: number
}

interface GachaProduct {
  id: string
  manufacturer: string
  name: string
  name_ja: string | null
  name_ko: string | null
  name_en: string | null
  jan_code: string | null
  product_code: string | null
  price_jpy: number | null
  release_month: string | null
  release_week_text: string | null
  types_count: number | null
  official_image_url: string | null
  source_url: string
  source_type: 'official'
  status: 'active'
  created_at: string
  updated_at: string
  last_seen_at: string
}
```

---

### `GET /api/gacha-products/[id]`

공개 상품 상세 정보를 반환합니다.

#### Response

```ts
{
  product: GachaProduct;
}
```

#### Error Response

```ts
{
  error: string;
} // HTTP 404 | HTTP 500
```

---

## Reports

> 제보 API는 비로그인도 제출할 수 있습니다. 로그인 사용자는 `user_id`가 기록되고, 익명/로그인 요청 모두 남용 방지를 위한 rate limit이 적용됩니다.

### `POST /api/reports`

제보를 제출합니다.

#### Request Body

```ts
{
  report_type: "new_shop" | "fix_info" | "closed" | "other";
  content: string; // 10~1000자
  shop_id?: string; // 관련 샵 UUID (선택)
  reporter_name?: string; // 선택, 50자 이하
  reporter_contact?: string; // 선택, 100자 이하
}
```

#### Response

```ts
{
  id: string; // 생성된 제보 UUID
} // HTTP 201
```

#### Error Response

```ts
{
  error: string;
}
// 400 — report_type 유효하지 않음 | content 길이 조건 미충족 | shop_id 형식 오류 | reporter 필드 길이 초과
// 429 — rate limit 초과
// 500 — DB 오류
```

#### Source

- Route: `src/app/api/reports/route.ts`
- Table: `public.reports` (Supabase, RLS)
- Updated: 2026-04-16

---

## Auth

### `GET /api/auth/callback`

Supabase PKCE 콜백 (Google OAuth). `?code=` 파라미터를 세션으로 교환 후 홈으로 리다이렉트.

### `GET /api/auth/kakao`

Kakao OAuth 진입. 카카오 인증 페이지로 리다이렉트.

### `GET /api/auth/kakao/callback`

Kakao OAuth 콜백. 코드 교환 → 사용자 upsert → 세션 생성 → 앱으로 리다이렉트.

### `GET /api/auth/naver`

Naver OAuth 진입. 네이버 인증 페이지로 리다이렉트.

### `GET /api/auth/naver/callback`

Naver OAuth 콜백. 코드 교환 → 사용자 upsert → 세션 생성 → 앱으로 리다이렉트.

**필요한 환경 변수:**

| 변수                  | 설명                     |
| --------------------- | ------------------------ |
| `KAKAO_CLIENT_ID`     | 카카오 앱 REST API 키    |
| `KAKAO_CLIENT_SECRET` | 카카오 앱 시크릿 키      |
| `NAVER_CLIENT_ID`     | 네이버 애플리케이션 ID   |
| `NAVER_CLIENT_SECRET` | 네이버 클라이언트 시크릿 |

---

## Admin

> 모든 어드민 엔드포인트는 `user_profiles.role = 'admin'` 인 사용자만 접근 가능합니다.
> (미들웨어는 빠른 응답을 위해 `app_metadata.role`로 1차 확인, API는 `user_profiles` 테이블로 최종 확인)
> Supabase `service_role` 키를 사용하여 RLS를 bypass합니다.

---

### `GET /api/admin/shops`

어드민용 샵 전체 목록을 반환합니다. status 필터로 전체/무시된 샵을 구분합니다.

#### Query Parameters

| 파라미터 | 타입             | 필수   | 설명                                 |
| -------- | ---------------- | ------ | ------------------------------------ |
| `status` | active \| hidden | 아니오 | 상태 필터 (기본값: active)           |
| `q`      | string           | 아니오 | 이름/주소 부분 검색                  |
| `offset` | number           | 아니오 | 페이지네이션 시작 인덱스 (기본값: 0) |
| `limit`  | number           | 아니오 | 한 번에 반환할 최대 수 (기본값: 50)  |

#### Response

```ts
{
  shops: AdminShopItem[]
  total: number
  offset: number
  limit: number
}

interface AdminShopItem {
  id: string
  name: string
  address: string | null
  lat: number
  lng: number
  tags: string[]
  is_authorized: boolean
  status: 'active' | 'hidden' | 'archived'
  created_at: string
}
```

---

### `PATCH /api/admin/shops/[id]`

샵의 상태 또는 인증 여부를 변경합니다. 무시(hidden) on/off와 인증 부여 모두 이 엔드포인트로 처리합니다.

#### Request Body

```ts
{
  status?: 'active' | 'hidden'
  is_authorized?: boolean
}
```

#### Response

```ts
{
  shop: AdminShopItem;
}
```

#### Error Response

```ts
{
  error: string;
} // HTTP 400 (유효하지 않은 값) | HTTP 404 | HTTP 500
```

---

### `GET /api/admin/gacha-products`

어드민용 상품 마스터 목록을 반환합니다.

#### Query Parameters

| 파라미터       | 타입                         | 필수   | 설명                                 |
| -------------- | ---------------------------- | ------ | ------------------------------------ |
| `status`       | active \| hidden \| archived | 아니오 | 상태 필터 (기본값: active)           |
| `q`            | string                       | 아니오 | 상품명/JAN/product code 부분 검색    |
| `manufacturer` | string                       | 아니오 | 제조사 필터                          |
| `offset`       | number                       | 아니오 | 페이지네이션 시작 인덱스 (기본값: 0) |
| `limit`        | number                       | 아니오 | 한 번에 반환할 최대 수 (기본값: 50)  |

#### Response

```ts
{
  products: AdminGachaProductItem[]
  total: number
  offset: number
  limit: number
}
```

---

### `PATCH /api/admin/gacha-products/[id]`

상품 마스터의 관리자 보정 필드를 수정합니다.

#### Request Body

```ts
{
  name?: string
  name_ja?: string | null
  name_ko?: string | null
  name_en?: string | null
  status?: 'active' | 'hidden' | 'archived'
  official_image_url?: string | null
}
```

#### Response

```ts
{
  product: AdminGachaProductItem;
}
```

#### Error Response

```ts
{
  error: string;
} // HTTP 400 | HTTP 404 | HTTP 500
```

---

### `GET /api/admin/reports`

제보(`reports`) 목록을 반환합니다.

#### Query Parameters

| 파라미터 | 타입                            | 필수   | 설명                        |
| -------- | ------------------------------- | ------ | --------------------------- |
| `status` | pending \| reviewed \| resolved | 아니오 | 상태 필터 (기본값: pending) |
| `offset` | number                          | 아니오 | 기본값: 0                   |
| `limit`  | number                          | 아니오 | 기본값: 50                  |

#### Response

```ts
{
  reports: AdminReportItem[]
  total: number
  offset: number
  limit: number
}

interface AdminReportItem {
  id: string
  shop_id: string | null
  shop_name: string | null
  report_type: 'new_shop' | 'fix_info' | 'closed' | 'other'
  reporter_name: string | null
  reporter_contact: string | null
  content: string
  status: 'pending' | 'reviewed' | 'resolved'
  created_at: string
}
```

---

### `POST /api/admin/reports/[id]/approve`

제보를 검토 완료 처리합니다.

#### Response

```ts
{
  report: {
    id: string;
    status: "reviewed";
  }
}
```

#### Error Response

```ts
{
  error: string;
} // HTTP 404 | HTTP 500
```

---

### `POST /api/admin/reports/[id]/reject`

제보를 처리 완료 상태로 변경합니다.

#### Response

```ts
{
  report: {
    id: string;
    status: "resolved";
  }
}
```

#### Error Response

```ts
{
  error: string;
} // HTTP 400 | HTTP 404 | HTTP 500
```

---

## Shop Applications

> 사업자 전용 샵 등록/소유권 신청. 일반 사용자 제보(`reports`)와 분리된 흐름.
> 모든 엔드포인트는 인증 필수 (Bearer token).

### `POST /api/shop-applications`

사업자 샵 등록 또는 소유권 주장 신청을 제출합니다.

#### Request Body

```ts
// claim_shop (기존 샵 소유권 주장)
{
  type: "claim_shop";
  shop_id: string; // 필수
  business_registration_number: string;
  representative_name: string;
  phone_number: string;
  message?: string;
}

// new_shop (신규 샵 등록)
{
  type: "new_shop";
  shop_name: string; // 필수
  address: string;   // 필수
  lat?: number;
  lng?: number;
  business_registration_number: string;
  representative_name: string;
  phone_number: string;
  message?: string;
}
```

#### Response

```ts
{
  id: string;
} // HTTP 201
```

#### Error Response

```ts
{
  error: string;
} // HTTP 400 | HTTP 401 | HTTP 409 (중복 pending 신청) | HTTP 500
```

---

### `GET /api/shop-applications`

내 신청 내역을 조회합니다.

#### Response

```ts
{
  applications: ShopOwnerApplication[];
  total: number;
}
```

---

### `GET /api/admin/shop-applications`

> Admin 전용

신청 목록을 조회합니다.

#### Query Parameters

| 파라미터 | 타입   | 필수   | 설명                                  |
| -------- | ------ | ------ | ------------------------------------- |
| `status` | string | 아니오 | `pending` \| `approved` \| `rejected` |
| `type`   | string | 아니오 | `new_shop` \| `claim_shop`            |
| `offset` | number | 아니오 | 페이지 오프셋 (기본값: 0)             |
| `limit`  | number | 아니오 | 최대 100 (기본값: 50)                 |

#### Response

```ts
{
  applications: AdminShopOwnerApplicationItem[];
  total: number;
  offset: number;
  limit: number;
}
```

---

### `PATCH /api/admin/shop-applications/[id]`

> Admin 전용

신청을 승인하거나 거절합니다.

#### Request Body

```ts
{
  action: "approve" | "reject";
  admin_note?: string;
}
```

승인(`approve`) 시:

- `claim_shop`: `shops.owner_id` 업데이트
- `new_shop`: 새 샵 생성 (`is_authorized: true`)
- 신청자의 `user_profiles.role = 'shop_owner'`로 승격

#### Response

```ts
{
  id: string;
  status: "approved" | "rejected";
}
```

#### Error Response

```ts
{
  error: string;
} // HTTP 400 | HTTP 401 | HTTP 403 | HTTP 404 | HTTP 409 | HTTP 500
```
