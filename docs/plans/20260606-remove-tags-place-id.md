# shops 테이블에서 tags, place_id 컬럼 제거

## Request

`tags`와 `place_id` 컬럼을 shops 테이블에서 제거한다.

- `tags`: 앞으로 사용하지 않기로 결정, 현재 100% 비어있음
- `place_id`: 카카오 기반 서비스에서 Google Places 연동 불필요, 83.9% 비어있음

## Scope

- DB: `shops` 테이블에서 두 컬럼 DROP
- DB 함수: `get_shops_by_name`, `search_shops` RETURNS TABLE 및 SELECT에서 제거
- 타입 정의: 모든 인터페이스에서 필드 제거
- Web 컴포넌트: 태그 렌더링 블록 제거
- Web API route: 태그 필터링 로직, place_id 타입 제거
- Mobile 컴포넌트: 태그 렌더링 블록 제거

## Out of Scope

- `candidate_group_id` 컬럼 — 유지
- 태그 관련 i18n 문자열 — 실제 사용 중인지 확인 후 결정
- Admin 페이지 UI (테이블 컬럼 등) — 별도 확인 필요

## Relevant Files

### DB

- `supabase/migrations/` — 새 migration 추가

### Web

- `apps/web/src/types/index.ts` — tags(6곳), place_id(1곳) 필드 제거
- `apps/web/src/app/api/shops/route.ts` — place_id 타입, tag 필터링 로직 제거
- `apps/web/src/app/api/admin/shops/route.ts` — SELECT 문자열에서 tags 제거
- `apps/web/src/app/api/admin/shops/[id]/route.ts` — SELECT 문자열에서 tags, image_urls, image_thumbnails 제거 (image_urls도 이미 DROP된 컬럼)
- `apps/web/src/app/api/wishlist/route.ts` — SELECT 문자열에서 tags 제거
- `apps/web/src/app/[locale]/search/page.tsx` — tag 필터 쿼리 제거
- `apps/web/src/components/molecules/common/shop-card.tsx` — 태그 렌더링 블록 제거
- `apps/web/src/components/organisms/shop/shop-detail.tsx` — place_id 기본값, tags 매핑 제거
- `apps/web/src/components/organisms/shop/shop-detail.view.tsx` — 태그 렌더링 블록 제거

### Mobile

- `apps/mobile/app/(tabs)/index.tsx` — 태그 렌더링 2곳 제거
- `apps/mobile/app/shop-search.tsx` — 태그 렌더링 제거
- `apps/mobile/app/(tabs)/search.view.tsx` — 태그 렌더링 제거
- `apps/mobile/app/shop/[id].tsx` — 태그 렌더링 제거
- `apps/mobile/components/organisms/map/shop-bottom-sheet.view.tsx` — 태그 렌더링 제거

## Plan

### Step 1: DB Migration 작성 및 prod 적용

```sql
-- shops 테이블 컬럼 DROP
ALTER TABLE public.shops DROP COLUMN IF EXISTS tags;
ALTER TABLE public.shops DROP COLUMN IF EXISTS place_id;
```

### Step 2: DB 함수 재정의

`get_shops_by_name`:

- RETURNS TABLE에서 `tags text[]`, `place_id text` 제거
- SELECT에서 `s.tags,`, `s.place_id,` 제거

`search_shops`:

- RETURNS TABLE에서 `tags text[]` 제거
- 두 SELECT 블록에서 `s.tags,` 제거

### Step 3: 타입 정의 수정

`apps/web/src/types/index.ts`에서 모든 인터페이스의 `tags: string[]`, `place_id: string | null` 필드 제거

### Step 4: Web API 수정

- `api/shops/route.ts`: `place_id?: string` 제거, tag 파라미터 수신·필터링·countQuery 전체 제거
- `api/admin/shops/route.ts`: SELECT 문자열에서 `tags` 제거
- `api/admin/shops/[id]/route.ts`: SELECT 문자열에서 `tags`, `image_urls`, `image_thumbnails` 제거
- `api/wishlist/route.ts`: SELECT 문자열에서 `tags` 제거
- `[locale]/search/page.tsx`: tag 필터 쿼리 제거

### Step 5: Web 컴포넌트 수정

- `shop-card.tsx`: tags.length > 0 조건부 렌더링 블록 제거
- `shop-detail.tsx`: `place_id: null` 기본값, `tags: shop.tags` 매핑 제거
- `shop-detail.view.tsx`: tags 렌더링 블록 제거

### Step 6: Mobile 컴포넌트 수정

- `index.tsx`, `shop-search.tsx`, `search.view.tsx`, `shop/[id].tsx`, `shop-bottom-sheet.view.tsx`: 태그 렌더링 블록 제거

## Verification

- `rtk tsc` — 타입 에러 없음 확인
- DB 함수 호출 테스트: `SELECT * FROM get_shops_by_name(...)` 및 `SELECT * FROM search_shops(...)` 정상 반환 확인
- prod API `/api/shops` 정상 응답 확인

## Risks / Questions

1. `api/shops/route.ts`의 `tag` 쿼리 파라미터 — 현재 실제로 사용 중인 클라이언트 있는지 확인 필요
2. admin 페이지에서 태그 컬럼 노출 여부 — admin route SELECT에서 제거하면 admin UI에서 tags 표시가 사라짐
3. `image_urls`, `image_thumbnails`가 admin/shops/[id]/route.ts에 여전히 참조됨 — 이미 DROP된 컬럼이므로 함께 정리

## Adversarial Review

**누락된 파일:**

1. **테스트 파일** — `types/index.ts`에서 `tags`, `place_id` 제거 시 타입 체크 실패. `map-client.test.tsx`, `shop-card.test.tsx`, `shop-list.test.tsx`, `route.test.ts` 파일들의 mock 데이터에서 해당 필드 제거 필요.
2. **i18n 파일 4개** — `apps/web/messages/{ko,en,ja,zh}.json`에 `tagFilter` 키 존재. `search/page.tsx` 제거 시 함께 정리.
3. **`[locale]/search/page.tsx` Tag import** — `import Tag from "@/components/atoms/common/tag"` 제거 필요.

**순서 리스크:**

- DB 함수 업데이트(tags 제거) → 컬럼 DROP → 코드 배포 순서 권장.
- 현재 함수에 `s.tags` 여전히 존재 (image_urls는 수정했지만 tags는 아직 미수정).

**Scope 명확화:**

- `api/shops/route.ts`의 `?tag=` 파라미터는 현재 어떤 프론트엔드도 생성하지 않음 → 제거 안전.
- admin route의 `image_urls`, `image_thumbnails` 참조 — 이미 DROP된 컬럼. 현재 admin API 호출 시 에러 발생 가능성 있으므로 함께 정리.

## Final Plan

### 완료 조건

- `rtk tsc` 에러 없음
- `get_shops_by_name`, `search_shops` RPC 정상 호출
- prod 서비스 샵 목록 정상 로드 (태그 없이)

### 실행 순서

**[메인 세션] Step 1: DB 함수 업데이트 + 컬럼 DROP (prod MCP)**

```sql
-- 함수 재정의 (tags, place_id 제거)
DROP FUNCTION IF EXISTS public.get_shops_by_name(...);
CREATE OR REPLACE FUNCTION public.get_shops_by_name(...) -- tags, place_id 없음
DROP FUNCTION IF EXISTS public.search_shops(...);
CREATE OR REPLACE FUNCTION public.search_shops(...) -- tags 없음
-- 컬럼 DROP
ALTER TABLE public.shops DROP COLUMN IF EXISTS tags;
ALTER TABLE public.shops DROP COLUMN IF EXISTS place_id;
```

**[Sonnet 서브에이전트] Step 2: 코드 변경**

변경 파일 목록:

- `supabase/migrations/20260606_remove_tags_place_id.sql` — migration 파일 기록
- `apps/web/src/types/index.ts` — tags(6곳), place_id(1곳) 제거
- `apps/web/src/app/api/shops/route.ts` — place_id 타입, tag 필터 전체 제거
- `apps/web/src/app/api/admin/shops/route.ts` — tags 제거
- `apps/web/src/app/api/admin/shops/[id]/route.ts` — tags, image_urls, image_thumbnails 제거
- `apps/web/src/app/api/wishlist/route.ts` — tags 제거
- `apps/web/src/app/[locale]/search/page.tsx` — tag 파라미터, Tag import, tagFilter 렌더링 제거
- `apps/web/messages/{ko,en,ja,zh}.json` — tagFilter 키 제거
- `apps/web/src/components/molecules/common/shop-card.tsx` — tags 렌더링 블록 제거
- `apps/web/src/components/organisms/shop/shop-detail.tsx` — place_id 기본값, tags 매핑 제거
- `apps/web/src/components/organisms/shop/shop-detail.view.tsx` — tags 렌더링 블록 제거
- `apps/mobile/app/(tabs)/index.tsx` — tags 렌더링 2곳 제거
- `apps/mobile/app/shop-search.tsx` — tags 렌더링 제거
- `apps/mobile/app/(tabs)/search.view.tsx` — tags 렌더링 제거
- `apps/mobile/app/shop/[id].tsx` — tags 렌더링 제거
- `apps/mobile/components/organisms/map/shop-bottom-sheet.view.tsx` — tags 렌더링 제거
- 테스트 파일 (mock 데이터에서 tags, place_id 필드 제거):
  - `apps/web/src/app/__tests__/map-client.test.tsx`
  - `apps/web/src/components/molecules/common/__tests__/shop-card.test.tsx`
  - `apps/web/src/components/organisms/common/__tests__/shop-list.test.tsx`
  - `apps/web/src/app/api/shops/__tests__/route.test.ts`
  - `apps/web/src/app/api/shops/[id]/__tests__/route.test.ts`
  - `apps/web/src/app/api/admin/shops/__tests__/route.test.ts`
  - `apps/web/src/app/api/admin/shops/[id]/__tests__/route.test.ts`
  - `apps/web/src/app/api/admin/reports/__tests__/route.test.ts`
  - `apps/web/src/app/api/admin/reports/[id]/reject/__tests__/route.test.ts`
