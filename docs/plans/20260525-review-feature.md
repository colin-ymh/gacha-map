# 리뷰 기능 구현

## Request

샵 상세 화면에 리뷰 기능 추가. 사용자가 텍스트+이미지 리뷰를 작성하고, 목록 조회·삭제·사진 모아보기를 할 수 있어야 한다.

---

## Scope

1. **DB** — `reviews` 테이블 + RLS 마이그레이션
2. **API** — 목록/작성/삭제/이미지 모아보기 4개 엔드포인트
3. **Storage** — 리뷰 이미지 업로드 경로 정의 (`shop-images/{shopId}/reviews/{reviewId}/`)
4. **Web Frontend** — 리뷰 섹션(목록 + 작성 버튼), 리뷰 작성 폼(모달), 사진 모아보기
5. **대표 이미지 로직** — `GET /api/shops/[id]` 응답에서 `image_urls`가 비었을 때 첫 번째 리뷰 이미지 반환
6. **i18n** — `apps/web/messages/ko.json`, `apps/mobile/messages/ko.json`에 `review` 키 추가

---

## Out of Scope

- 리뷰 수정 (삭제 후 재작성으로 대체)
- 리뷰 좋아요/신고 기능
- Mobile 앱(Expo) 프론트엔드 (별도 PR)
- 샵 관리자 연동 흐름

---

## Relevant Files

| 파일                                                                     | 역할                              |
| ------------------------------------------------------------------------ | --------------------------------- |
| `supabase/migrations/20260525_reviews.sql`                               | 신규 — reviews 테이블 + RLS       |
| `apps/web/src/app/api/shops/[id]/reviews/route.ts`                       | 신규 — GET(목록) + POST(작성)     |
| `apps/web/src/app/api/shops/[id]/reviews/images/route.ts`                | 신규 — GET(이미지 모아보기)       |
| `apps/web/src/app/api/reviews/[id]/route.ts`                             | 신규 — DELETE                     |
| `apps/web/src/app/api/shops/[id]/route.ts`                               | 수정 — 대표 이미지 로직 추가      |
| `apps/web/src/types/review.ts`                                           | 신규 — Review 타입                |
| `apps/web/src/components/molecules/review/review-card.tsx`               | 신규 — 리뷰 카드 컴포넌트         |
| `apps/web/src/components/organisms/review/review-section.tsx`            | 신규 — 리뷰 섹션 container        |
| `apps/web/src/components/organisms/review/review-section.view.tsx`       | 신규 — 리뷰 섹션 view             |
| `apps/web/src/components/organisms/review/review-form.tsx`               | 신규 — 리뷰 작성 폼 container     |
| `apps/web/src/components/organisms/review/review-form.view.tsx`          | 신규 — 리뷰 작성 폼 view          |
| `apps/web/src/components/organisms/review/review-image-gallery.tsx`      | 신규 — 사진 모아보기 container    |
| `apps/web/src/components/organisms/review/review-image-gallery.view.tsx` | 신규 — 사진 모아보기 view         |
| `apps/web/src/components/organisms/shop/shop-detail.tsx`                 | 수정 — ReviewSection 통합         |
| `apps/web/src/components/organisms/shop/shop-detail.view.tsx`            | 수정 — 리뷰 섹션 UI 추가          |
| `apps/web/messages/ko.json`                                              | 수정 — `review` 네임스페이스 추가 |
| `apps/mobile/messages/ko.json`                                           | 수정 — `review` 네임스페이스 추가 |

---

## Plan

### 1. DB 마이그레이션 (`supabase/migrations/20260525_reviews.sql`)

```sql
CREATE TABLE IF NOT EXISTS public.reviews (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     uuid        NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content     text        CHECK (char_length(content) <= 500),
  image_urls  text[]      NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reviews_content_or_image CHECK (
    content IS NOT NULL AND char_length(trim(content)) > 0
    OR array_length(image_urls, 1) > 0
  )
);

CREATE INDEX idx_reviews_shop_id ON public.reviews(shop_id, created_at DESC);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- 누구나 읽기
CREATE POLICY "anyone can read reviews"
  ON public.reviews FOR SELECT USING (true);

-- 인증 사용자만 작성 (본인 ID)
CREATE POLICY "authenticated users can insert own reviews"
  ON public.reviews FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 본인만 삭제
CREATE POLICY "users can delete own reviews"
  ON public.reviews FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 어드민은 모든 리뷰 삭제 가능
CREATE POLICY "admins can delete any review"
  ON public.reviews FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

### 2. 타입 정의 (`apps/web/src/types/review.ts`)

```typescript
export interface Review {
  id: string;
  shop_id: string;
  user_id: string;
  content: string | null;
  image_urls: string[];
  created_at: string;
  updated_at: string;
  // JOIN from user_profiles
  user: {
    nickname: string;
    avatar_url: string | null;
  } | null;
}
```

### 3. API 라우트

#### GET `/api/shops/[id]/reviews`

- 쿼리: `?page=0&limit=10`
- reviews + user_profiles JOIN
- 응답: `{ reviews: Review[], total: number, hasMore: boolean }`
- 인증 불필요 (공개)

#### POST `/api/shops/[id]/reviews`

- 인증 필수 (`createAuthenticatedClient`)
- FormData: `content?(text)`, `files[]?(최대 3장)`
- 이미지 처리: Sharp 리사이즈 (1200×1200 display, 300×300 thumb) → Storage 업로드
- 경로: `{shopId}/reviews/{reviewId}/{uuid}.jpg`
- content + image 둘 다 없으면 400 반환
- 응답: 생성된 Review 객체

#### DELETE `/api/reviews/[id]`

- 인증 필수
- 본인 리뷰 or 어드민만 삭제 가능
- 삭제 시 Storage 이미지도 함께 삭제
- 응답: 204

#### GET `/api/shops/[id]/reviews/images`

- 인증 불필요
- reviews에서 image_urls 배열만 flatten해서 반환
- 응답: `{ images: string[], total: number }`

### 4. 대표 이미지 로직 (`apps/web/src/app/api/shops/[id]/route.ts` 수정)

기존 응답에 `representative_image_url` 필드 추가:

```typescript
// shop.image_urls가 비어 있을 경우, 이미지 있는 첫 번째 리뷰의 첫 번째 사진 사용
let representativeImage: string | null = shop.image_urls?.[0] ?? null;
if (!representativeImage) {
  const { data: firstReview } = await supabase
    .from("reviews")
    .select("image_urls")
    .eq("shop_id", id)
    .gt("array_length(image_urls, 1)", 0)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();
  representativeImage = firstReview?.image_urls?.[0] ?? null;
}
```

### 5. 프론트엔드 컴포넌트 구조

**ShopDetail 수정 흐름:**

- `shop-detail.tsx`: `reviews` 상태, `isReviewFormOpen` 상태, `isGalleryOpen` 상태 추가
- `shop-detail.view.tsx`: 기존 Description 아래에 `<ReviewSection>` 추가

**ReviewSection:**

- `review-section.tsx`: 리뷰 목록 fetch (무한 스크롤), 작성/삭제 핸들러
- `review-section.view.tsx`: 헤더(리뷰 수 + 사진 모아보기 + 리뷰 쓰기), ReviewCard 목록, 무한 스크롤 옵저버, 스크롤 업(↑) 버튼

**ReviewCard (molecule):**

- 아바타(Ellipse), 닉네임, 날짜, 텍스트(더보기/접기), 이미지 썸네일 그리드, 삭제 버튼(본인만)

**ReviewForm (modal):**

- 텍스트 에어리어 (0/500), 이미지 첨부 (최대 3장), 취소/완료
- 완료 시 `POST /api/shops/[id]/reviews` multipart 호출

**ReviewImageGallery:**

- 사진 7장 형태 3열 그리드
- `GET /api/shops/[id]/reviews/images` 호출

### 6. i18n 키 추가

```json
// apps/web/messages/ko.json — review 네임스페이스
"review": {
  "title": "리뷰",
  "viewPhotos": "사진 모아보기",
  "writeReview": "리뷰 쓰기",
  "noReviews": "아직 리뷰가 없습니다. 첫 번째 리뷰를 작성해보세요!",
  "delete": "삭제",
  "deleteConfirm": "리뷰를 삭제하시겠습니까?",
  "showMore": "더보기",
  "showLess": "접기",
  "photoCount": "사진 {count}장",
  "reviewCount": "리뷰 ({count})",
  "formTitle": "리뷰 쓰기",
  "formCancel": "취소",
  "formSubmit": "완료",
  "formPlaceholder": "리뷰를 작성해 주세요.\n상품, 서비스, 매장 분위기 등 자유롭게 작성해 주세요.",
  "formPhotoLabel": "사진 첨부 (선택, 최대 3장)",
  "formRequiredHint": "텍스트 또는 사진 중 하나는 필수입니다.",
  "charCount": "{current}/500",
  "loginRequired": "리뷰 작성은 로그인이 필요합니다."
}
```

---

## Verification

1. Supabase MCP로 마이그레이션 적용 후 `reviews` 테이블 확인
2. `POST /api/shops/[id]/reviews` — 텍스트만 / 이미지만 / 둘 다 / 둘 다 없음(400) 케이스 테스트
3. `DELETE /api/reviews/[id]` — 본인/타인/어드민 권한 테스트
4. Web 브라우저에서 샵 상세 → 리뷰 섹션 표시 → 리뷰 작성 → 삭제 플로우 확인
5. 사진 모아보기 그리드 확인
6. 미연동 샵(image_urls 빈 배열)에서 대표 이미지가 리뷰 첫 사진으로 표시되는지 확인

---

## Risks / Questions

- `array_length(image_urls, 1) > 0` 필터: Supabase PostgREST에서 직접 지원되지 않을 수 있음 → `.neq('image_urls', '{}')` 또는 RPC 함수 필요
- Storage 삭제: 리뷰 삭제 시 이미지 파일명을 URL에서 파싱해야 함 — 실패해도 DB 삭제는 성공 처리 (soft failure)
- 무한 스크롤: IntersectionObserver 사용, SSR 환경에서 hydration 고려
- 텍스트 더보기/접기 기준: 4줄 초과 시 접기 (CSS line-clamp 활용)

---

## Adversarial Review

### 누락/리스크 항목

1. **i18n 불완전** — `apps/web/messages/ko.json`에는 `review` 네임스페이스 추가됨. 그러나 `en.json`, `zh.json`에는 미추가. 다국어 환경에서 키 누락으로 빈 문자열 또는 fallback 오류 발생 가능. → **실제 누락 이슈, 수정 필요**
2. **PostgREST `array_length` 필터** — 계획의 리스크 항목. 실제 구현에서는 `.neq("image_urls", "{}")` 방식으로 우회 구현됨. ✅ 해결됨
3. **대표 이미지 로직** — `GET /api/shops/[id]/route.ts`에 실제 반영됨. `.neq` 방식으로 구현. ✅ 해결됨
4. **RLS 정책 중복** — `users can delete own reviews`와 `admins can delete any review` 두 DELETE 정책 병존. Postgres는 OR 합산 처리하므로 동작은 정상. 의도 명시를 위해 주석 추가 권장 (필수 아님)
5. **무한 스크롤 SSR** — IntersectionObserver는 클라이언트 전용 API. 컴포넌트에 `"use client"` 마킹 확인 필요. ReviewSection/ReviewSectionView 모두 확인 권장.

### 범위 초과 없음 확인

- 리뷰 수정, 좋아요/신고, 모바일 프론트 — 모두 Out of Scope 유지됨 ✅

### 규칙 준수 확인

- styled-components 사용 ✅
- MVVM 패턴 (container + view 분리) ✅
- 색상: 테마 토큰(`theme.colors.*`) 사용, 하드코딩 없음 ✅

---

## Final Plan

### 구현 완료 항목

| 항목                                                  | 상태 |
| ----------------------------------------------------- | ---- |
| DB 마이그레이션 (`reviews` 테이블 + RLS)              | ✅   |
| `GET /api/shops/[id]/reviews` (목록 + 페이지네이션)   | ✅   |
| `POST /api/shops/[id]/reviews` (작성 + 이미지 업로드) | ✅   |
| `DELETE /api/reviews/[id]` (삭제 + Storage 정리)      | ✅   |
| `GET /api/shops/[id]/reviews/images` (사진 모아보기)  | ✅   |
| 대표 이미지 로직 (`GET /api/shops/[id]` 수정)         | ✅   |
| `ReviewCard` molecule                                 | ✅   |
| `ReviewSection` + View organism                       | ✅   |
| `ReviewForm` + View organism                          | ✅   |
| `ReviewImageGallery` + View organism                  | ✅   |
| `ShopDetailView`에 `ReviewSection` 통합 (line 364)    | ✅   |
| `Review` 타입 정의 (`apps/web/src/types/index.ts`)    | ✅   |
| i18n — `apps/web/messages/ko.json`                    | ✅   |
| i18n — `apps/mobile/messages/ko.json`                 | ✅   |

### 잔여 작업

| 항목                                                     | 우선순위 |
| -------------------------------------------------------- | -------- |
| `apps/web/messages/en.json`에 `review` 네임스페이스 추가 | **필수** |
| `apps/web/messages/zh.json`에 `review` 네임스페이스 추가 | **필수** |
| ReviewSection/View `"use client"` 마킹 확인              | 확인     |

### 완료 조건

- en.json, zh.json review 키 추가 후 빌드 오류 없음
- 브라우저에서 샵 상세 → 리뷰 작성 → 목록 표시 → 삭제 플로우 정상 동작
- 사진 모아보기 그리드 정상 표시
- 미연동 샵에서 대표 이미지가 리뷰 첫 사진으로 표시
