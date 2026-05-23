# Shop 이미지 인프라

## Request

- shop-images Storage 버킷 생성 (public)
- shops 테이블에 image_thumbnails text[] 컬럼 추가
- POST /api/shops/[id]/images 라우트: sharp 리사이즈 + 업로드
- 공유 타입에 image_thumbnails 추가

## Scope

1. `shop-images` 버킷 생성 (dev + prod)
2. `shops.image_thumbnails text[]` 컬럼 추가 migration (dev + prod)
3. `packages/shared/src/types/index.ts` — Shop, ShopSummary, ShopDetail에 `image_thumbnails?: string[]`
4. `apps/web/src/app/api/shops/[id]/route.ts` — GET select에 image_thumbnails 추가
5. `apps/web/src/app/api/shops/[id]/images/route.ts` — POST 신규
6. `apps/web/package.json` — sharp 의존성 추가

## Out of Scope

- 샵 이미지 업로드 UI (어드민 도구 별도)
- 이미지 표시 UI 변경
- 목록 API (마커/검색) image_thumbnails 추가

## Relevant Files

- `apps/web/src/app/api/shops/[id]/route.ts` — GET 응답 수정
- `apps/web/src/lib/supabase/admin.ts` — verifyAdminAuth (재사용)
- `packages/shared/src/types/index.ts` — 타입 추가
- `apps/web/package.json` — sharp 설치

## Plan

### Step 1. sharp 설치

```
pnpm add sharp @types/sharp --filter @gacha-map/web
```

### Step 2. DB migration (dev + prod 동시)

```sql
ALTER TABLE shops ADD COLUMN IF NOT EXISTS image_thumbnails text[] DEFAULT '{}';
```

### Step 3. Storage bucket 생성 (dev + prod 동시)

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('shop-images', 'shop-images', true)
ON CONFLICT (id) DO NOTHING;
```

RLS: public read, admin write (service key로 업로드하므로 별도 RLS 불필요)

### Step 4. 공유 타입 업데이트

`Shop`, `ShopSummary`, `ShopDetail`에 `image_thumbnails?: string[]` 추가

### Step 5. GET 응답 업데이트

`apps/web/src/app/api/shops/[id]/route.ts:19` select 문에 `image_thumbnails` 추가

### Step 6. POST /api/shops/[id]/images 구현

- `verifyAdminAuth` 사용
- `multipart/form-data`로 파일 수신 (최대 5개, 각 10MB)
- `sharp`로 리사이즈:
  - thumb: 300×300 center-crop, JPEG 80%
  - display: 최대 1200px 긴 변, JPEG 85%
- 파일명: `crypto.randomUUID()` (UUID v4)
- 경로: `shop-images/{shopId}/{uuid}.jpg` / `shop-images/{shopId}/{uuid}_thumb.jpg`
- Supabase Storage upload (service key admin client 사용)
- 업로드 후 `?t={timestamp}` 쿼리 추가한 URL DB에 저장
- `image_urls` / `image_thumbnails` 배열에 append (기존값 유지)

## Verification

- dev DB에 컬럼 존재 확인
- prod DB에 컬럼 존재 확인
- 버킷 public 접근 확인
- GET /api/shops/[id] 응답에 image_thumbnails 포함 확인
- TypeScript 타입 에러 없음

## Risks / Questions

- sharp는 Next.js 서버 사이드 전용 (edge runtime 불가). `export const runtime = 'nodejs'` 명시 필요
- 파일 크기 상한: Next.js 기본 body limit 4MB → `export const config = { api: { bodyParser: false } }` 또는 App Router에서는 req.formData() 사용 (Next.js 13+ App Router는 기본 FormData 지원)
- 버킷 RLS: admin client(service key)로 업로드하므로 별도 정책 불필요

## Final Plan

위 6단계를 순서대로 진행. DB는 dev + prod 동시 적용.
