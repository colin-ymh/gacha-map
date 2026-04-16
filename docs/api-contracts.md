# API Contracts

gacha-map 백엔드 엔드포인트 명세서입니다.
엔드포인트를 추가하거나 수정할 때 반드시 이 문서를 함께 업데이트하세요.

---

## 목차

- [Shops](#shops)
- [Reports](#reports)
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

## Reports

> 제보 API는 **로그인 필수**. 비로그인 요청은 401을 반환합니다.

### `POST /api/reports`

제보를 제출합니다.

#### Request Body

```ts
{
  report_type: "new_shop" | "fix_info" | "closed" | "other";
  content: string; // 10~1000자
  shop_id?: string; // 관련 샵 UUID (선택)
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
// 400 — report_type 유효하지 않음 | content 길이 조건 미충족
// 401 — 비로그인
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

### `GET /api/admin/reports`

제보(`temporal_shops`) 목록을 반환합니다.

#### Query Parameters

| 파라미터 | 타입                            | 필수   | 설명                        |
| -------- | ------------------------------- | ------ | --------------------------- |
| `status` | pending \| approved \| rejected | 아니오 | 상태 필터 (기본값: pending) |
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
  name: string
  address: string | null
  lat: number | null
  lng: number | null
  description: string | null
  tags: string[]
  submitter_name: string | null
  submitter_contact: string | null
  shop_id: string | null       // 연결된 기존 샵 ID (승인 후 채워짐)
  status: 'pending' | 'approved' | 'rejected'
  admin_note: string | null
  created_at: string
}
```

---

### `POST /api/admin/reports/[id]/approve`

제보를 승인합니다. 신규 샵 생성 또는 기존 샵 연결(인증 부여) 중 하나를 선택합니다.

#### Request Body

```ts
// 신규 샵으로 등록
{ mode: 'new' }

// 기존 샵에 연결 + is_authorized = true
{ mode: 'link', shopId: string }
```

#### 처리 로직

| mode   | 동작                                                                                                  |
| ------ | ----------------------------------------------------------------------------------------------------- |
| `new`  | `temporal_shops` 데이터로 `shops` INSERT (`status = 'active'`), `temporal_shops.status = 'approved'`  |
| `link` | `shops.is_authorized = true`, `temporal_shops.shop_id = shopId`, `temporal_shops.status = 'approved'` |

#### Response

```ts
{
  report: AdminReportItem;
  shop: AdminShopItem; // 생성되거나 업데이트된 샵
}
```

#### Error Response

```ts
{
  error: string;
} // HTTP 400 (shopId 없음 등) | HTTP 404 | HTTP 500
```

---

### `POST /api/admin/reports/[id]/reject`

제보를 거부합니다.

#### Request Body

```ts
{
  adminNote: string; // 거부 사유 (필수)
}
```

#### Response

```ts
{
  report: AdminReportItem;
}
```

#### Error Response

```ts
{
  error: string;
} // HTTP 400 | HTTP 404 | HTTP 500
```
