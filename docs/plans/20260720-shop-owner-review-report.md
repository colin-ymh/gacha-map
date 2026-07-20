# 샵 사장님 리뷰 신고 기능

## Context

샵 사장님이 현재 자기 샵 리뷰를 읽기만 할 수 있고 아무 조치도 취할 수 없음. 부적절한 리뷰(스팸/욕설/허위 등)에 대응할 방법이 필요해서 신고 기능을 추가. 논의 결과 확정된 방향:

- **신고만** — 답글, 직접 숨김/삭제 기능은 넣지 않음 (사장님이 리뷰를 임의로 없앨 수 있으면 신뢰성 문제)
- **승인 시 어드민 수동 삭제** — 신고 승인은 상태 변경만, 실제 삭제는 어드민이 별도 버튼으로 처리
- **신고 사유: 이넘 + 직접입력** — 정해진 사유 몇 개 선택 + "기타" 선택 시 자유 텍스트
- **모바일 + 웹 사장님 포털 둘 다** — 이미 웹에 `/shop-owner/reviews` 읽기전용 페이지가 있고, CLAUDE.md 방향상 웹 신규 작업은 어드민/샵 관리자 스코프가 기본이므로 웹도 포함

## Scope

- DB: `review_reports` 테이블 신규 생성 (마이그레이션)
- 모바일: `app/shop-owner/reviews.tsx`에 리뷰별 "신고" 액션 + 사유 선택 모달
- 웹 샵 사장님 포털: `app/[locale]/shop-owner/reviews/page.tsx`에 동일한 신고 액션 + 모달
- 웹 API: 신고 제출 API (샵 사장님), 어드민 목록/승인/반려 API
- 웹 어드민: `/admin/review-reports` 신규 페이지 (기존 `/admin/reports` split-pane 패턴 재사용), 사이드바 네비 추가
- 리뷰 삭제 자체는 기존 `DELETE /api/reviews/[id]` 재사용 (admin 삭제 권한 이미 존재) — 어드민 상세 패널에서 세션 토큰으로 호출

## Out of Scope

- 사장님 답글(reply) 기능
- 사장님이 직접 리뷰를 숨기거나 삭제하는 기능
- 신고 승인 시 자동 삭제/알림/배지 로직 (기존 `reports` 승인 플로우의 배지·푸시 로직은 재사용하지 않음)
- 리뷰 작성자에게 신고/삭제 사실을 알리는 알림 (필요 시 후속 작업)
- 동일 리뷰 중복 신고 방지 (unique 제약 없음, 후속 개선 여지로 남김)

## Relevant Files

**참고 패턴 (그대로 재사용/복제)**

- `supabase/migrations/20260523_shop_image_reports.sql` — 마이그레이션 스키마/RLS 템플릿
- `supabase/migrations/20260526_shop_owner_applications.sql:46` — `shops.owner_id` 컬럼
- `supabase/migrations/20260527_reviews_user_fk.sql` — `reviews.user_id`를 `user_profiles(id)` FK로 바꾼 선례 (동일 패턴을 `submitted_by`에도 적용)
- `apps/web/src/app/api/shop-owner/reviews/route.ts` — `verifyShopOwnerAuth` + `owner_id`로 샵 스코프 확인
- `apps/web/src/app/api/admin/reports/[id]/approve/route.ts:45`, `.../reject/route.ts:33` — `.eq("status","pending")` 가드로 이중 처리 방지하는 상태 전이 패턴 (배지/알림 로직은 참고하지 않음)
- `apps/web/src/app/[locale]/admin/reports/page.tsx:159,199` — API 호출 시 `supabase.auth.getSession()` → `Authorization: Bearer {access_token}` 헤더 부착 패턴
- `apps/web/src/components/organisms/admin/report-table.view.tsx`, `report-detail-panel.view.tsx` — split-pane 탭 목록/상세 UI + `.tsx`/`.view.tsx` 분리 패턴
- `apps/web/src/app/[locale]/admin/layout.tsx` — 사이드바 nav 항목 추가 위치
- `apps/web/src/app/api/reviews/[id]/route.ts:173` (DELETE) — `createAuthenticatedClient`로 user 토큰 검증 후 작성자/admin role 체크. **admin 세션의 access token을 그대로 넘기면 됨** (별도 admin 전용 엔드포인트 아님)
- `apps/web/src/styles/color.ts:1` — **자동 생성 파일(수동 편집 금지)**. 웹은 새 색상 필요해도 여기 직접 추가하지 말고 기존 `theme.colors` 토큰만 사용
- `apps/mobile/app/report.tsx` — 이넘 타입 선택 + 자유 텍스트 폼 UI 참고 (화면 전체가 아니라 모달로 축소)
- `apps/mobile/components/ui/LoginModal.tsx` — RN `Modal` 사용 패턴 참고
- `apps/web/src/types/index.ts` — `AdminReportItem`/`ReportStatus`류 타입 위치, 새 타입 추가
- `apps/web/messages/ko.json:647` (`{count}`, next-intl) vs `apps/mobile/messages/ko.json:103` (`{{count}}`, i18next) — 보간 문법이 다름, 새 키 작성 시 주의

**신규/수정 파일**

- `supabase/migrations/20260720_review_reports.sql` (신규)
- `apps/web/src/app/api/shop-owner/reviews/[id]/report/route.ts` (신규, POST)
- `apps/web/src/app/api/admin/review-reports/route.ts` (신규, GET)
- `apps/web/src/app/api/admin/review-reports/[id]/approve/route.ts` (신규, POST)
- `apps/web/src/app/api/admin/review-reports/[id]/reject/route.ts` (신규, POST)
- `apps/web/src/app/[locale]/admin/review-reports/page.tsx` (신규)
- `apps/web/src/components/organisms/admin/review-report-table.tsx` / `.view.tsx` (신규)
- `apps/web/src/components/organisms/admin/review-report-detail-panel.tsx` / `.view.tsx` (신규)
- `apps/web/src/app/[locale]/admin/layout.tsx` (nav 링크 추가)
- `apps/mobile/app/shop-owner/reviews.tsx` (신고 버튼 + 모달 연동)
- `apps/mobile/components/organisms/ReviewReportModal.tsx` (신규)
- `apps/web/src/app/[locale]/shop-owner/reviews/page.tsx` (신고 버튼 + 모달 연동)
- `apps/web/src/components/organisms/shop-owner/review-report-modal.tsx` / `.view.tsx` (신규)
- `apps/web/src/types/index.ts` (타입 추가)
- i18n: `apps/mobile/messages/{en,ko,ja,zh}.json`, `apps/web/messages/{en,ko,ja,zh}.json` — `shopOwner.reviews.report*`, `admin.reviewReports.*` 키 추가

## Plan

### 1. DB 마이그레이션

`review_reports` 테이블. `shop_image_reports` 구조를 따르되 사유 이넘 + DB 레벨 무결성 강화, 리뷰 삭제 후에도 신고 이력이 남도록 스냅샷 포함:

```sql
CREATE TABLE IF NOT EXISTS public.review_reports (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id            uuid        REFERENCES public.reviews(id) ON DELETE SET NULL,
  shop_id              uuid        NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  -- 리뷰가 나중에 삭제돼도 어드민이 신고 당시 내용을 볼 수 있도록 스냅샷 보관
  review_content_snapshot text,
  review_image_urls_snapshot text[] NOT NULL DEFAULT '{}',
  reason               text        NOT NULL
                                   CHECK (reason IN ('spam', 'abusive', 'irrelevant', 'fake', 'other')),
  reason_detail        text,
  status               text        NOT NULL DEFAULT 'pending'
                                   CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_by         uuid        NOT NULL REFERENCES public.user_profiles(id),
  reviewed_by          uuid        REFERENCES auth.users(id),
  reviewed_at          timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  CHECK (reason <> 'other' OR char_length(trim(coalesce(reason_detail, ''))) BETWEEN 10 AND 500)
);

ALTER TABLE public.review_reports ENABLE ROW LEVEL SECURITY;

-- 어드민: 전체 권한
CREATE POLICY "admins can manage review_reports" ON public.review_reports
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'));

-- 샵 사장님: review_id가 실제로 자기 shop_id 소속일 때만 INSERT
-- (shop_id를 자기 샵으로, review_id를 아무 리뷰 id로 조합해 넣는 것을 방지)
CREATE POLICY "shop owners can report own shop reviews" ON public.review_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = submitted_by
    AND EXISTS (
      SELECT 1 FROM public.reviews r
      JOIN public.shops s ON s.id = r.shop_id
      WHERE r.id = review_id AND r.shop_id = shop_id AND s.owner_id = auth.uid()
    )
  );

-- 샵 사장님: 자기가 제출한 신고만 조회 (다른 사장님 신고 내역 비공개)
CREATE POLICY "shop owners can view own review reports" ON public.review_reports
  FOR SELECT TO authenticated
  USING (auth.uid() = submitted_by);

CREATE INDEX review_reports_status_idx ON public.review_reports(status);
CREATE INDEX review_reports_review_id_idx ON public.review_reports(review_id);
```

- `review_id`를 `ON DELETE SET NULL`로 바꿔 리뷰가 삭제돼도 신고 row는 남김. 대신 신고 생성 시점에 `review_content_snapshot`/`review_image_urls_snapshot`에 리뷰 내용을 복사해둬서, 삭제 후에도 어드민 상세 패널에서 "무엇이 신고됐는지" 볼 수 있게 함. `review_id IS NULL`이면 UI에서 "삭제됨" 표시.
- `submitted_by`는 `auth.users(id)`가 아니라 `public.user_profiles(id)` FK로 — PostgREST embedded join(`user_profiles(nickname, avatar_url)`)이 되게 하려면 이 FK가 필요함 (`reviews.user_id`를 `user_profiles`로 바꾼 20260527 마이그레이션과 동일 이유).
- `reason='other'`일 때 `reason_detail` 10~500자 필수를 DB CHECK로도 강제 (API 검증이 우회되는 경로 방지).

### 2. 신고 제출 API (샵 사장님)

`apps/web/src/app/api/shop-owner/reviews/[id]/report/route.ts` — POST

- `verifyShopOwnerAuth` 재사용
- `shops`에서 `owner_id = user.id`로 자기 샵 조회
- `reviews`에서 `id = reviewId AND shop_id = shop.id` 확인, `content`/`image_urls` 함께 조회 (다른 샵 리뷰면 404, 스냅샷용으로도 필요)
- body: `{ reason: 'spam'|'abusive'|'irrelevant'|'fake'|'other', reason_detail?: string }`
  - `reason === 'other'`일 때 `reason_detail` 10~500자 필수 (API 레벨 검증, DB CHECK가 최종 방어선)
- insert 시 `review_content_snapshot`/`review_image_urls_snapshot`에 방금 조회한 리뷰 내용 채워서 저장
- 201 반환 `{ id }`

### 3. 어드민 API

- `GET /api/admin/review-reports?status=pending&offset=0&limit=50` — `verifyAdminAuth`, `review_reports` + `shops(name)` + `user_profiles!submitted_by(nickname)` join. 리뷰 작성자 정보는 `review_id`가 살아있을 때만 `reviews.user_id → user_profiles` join으로 채우고, `review_id IS NULL`이면 스냅샷 필드만 사용
- `POST /api/admin/review-reports/[id]/approve` — `.update({status:'approved', reviewed_by, reviewed_at}).eq("id", id).eq("status", "pending").select().single()`. 매치 없으면(이미 처리됨) 404/409 반환. 배지/알림 로직 없음
- `POST /api/admin/review-reports/[id]/reject` — 동일한 가드로 `status: 'rejected'`
- 리뷰 실제 삭제는 별도 엔드포인트 없이, 어드민 상세 패널에서 `supabase.auth.getSession()`으로 얻은 access token을 `Authorization: Bearer` 헤더에 실어 기존 `DELETE /api/reviews/[id]` 호출 (해당 라우트가 이미 `user_profiles.role==='admin'`이면 삭제 허용)

### 4. 어드민 웹 UI

- `/admin/review-reports` 페이지: `admin/reports/page.tsx` 구조 복제 — 상태 탭(pending/approved/rejected), split-pane(목록+상세), `.tsx`(로직)/`.view.tsx`(프레젠테이션) 분리 유지
- 목록 테이블: 신고사유, 샵명, 신고일, (리뷰 삭제됨 여부) 컬럼
- 상세 패널: 리뷰 내용(스냅샷 우선 표시, 살아있으면 최신 `reviews` 데이터로 대체 가능), 신고 사유(+상세), 신고자(샵 사장님) 닉네임
  - `status='pending'`: "승인"/"반려" 버튼
  - `status='approved' && review_id NOT NULL`: "리뷰 삭제" 버튼 — 클릭 시 위 3번 방식으로 `DELETE /api/reviews/[id]` 호출, 성공 시 로컬 상태에서 해당 항목 `review_id null` 처리(refetch 또는 optimistic)
  - `review_id IS NULL`: "삭제됨" 배지만 표시, 삭제 버튼 숨김
- `apps/web/src/app/[locale]/admin/layout.tsx`에 `nav.reviewReports` 링크 추가 (데스크톱 사이드바 + 모바일 바텀 네비 둘 다)
- `apps/web/src/types/index.ts`에 `AdminReviewReportItem`, `ReviewReportStatus`, `ReviewReportReason` 타입 추가

### 5. 모바일 UI

- `apps/mobile/app/shop-owner/reviews.tsx`: 각 리뷰 카드에 "신고" 텍스트 버튼 추가
- 신규 `ReviewReportModal` 컴포넌트 (organisms): RN `Modal` 기반, `LoginModal.tsx` 패턴 참고
  - 사유 선택: 스팸/광고, 욕설·비방, 무관한 내용, 허위 리뷰, 기타
  - "기타" 선택 시 `TextInput` 노출 (10~500자, 미입력 시 제출 버튼 비활성화)
  - 제출 시 `POST /api/shop-owner/reviews/{id}/report`, 성공 시 모달 닫고 완료 안내
- i18n 키 (i18next `{{}}` 보간): `shopOwner.reviews.reportBtn`, `reportTitle`, `reportReasonSpam/Abusive/Irrelevant/Fake/Other`, `reportDetailPlaceholder`, `reportSubmit`, `reportSuccess`, `reportError` — en/ko/ja/zh 4개 파일

### 6. 웹 샵 사장님 포털 UI

- `apps/web/src/app/[locale]/shop-owner/reviews/page.tsx`: 리뷰 행에 "신고" 버튼 추가
- 신규 `review-report-modal.tsx`/`.view.tsx` (organisms, shop-owner 폴더): 모바일과 동일 사유 목록/필수 텍스트 규칙, styled-components + `theme.colors` 토큰 사용
- i18n 키 (next-intl `{}` 보간): 모바일과 동일 키 이름으로 `apps/web/messages/{en,ko,ja,zh}.json`에 추가 (보간 문법만 다름)

### 7. 색상/스타일 규칙 준수

- 모바일: 새 색상 필요 시 `apps/mobile/constants/colors.ts`에 먼저 추가 후 참조
- 웹: `apps/web/src/styles/color.ts`는 자동 생성 파일이라 직접 편집 금지 — 기존 `theme.colors` 토큰만 사용, 정말 새 토큰이 필요하면 그 생성 파이프라인을 먼저 확인
- 웹 어드민/샵오너 신규 컴포넌트는 기존 `report-table.view.tsx`/`report-detail-panel.view.tsx`처럼 styled-components + theme 토큰 사용, `.tsx`/`.view.tsx` 분리 유지

## Verification

1. **마이그레이션**: dev 프로젝트에 `apply_migration` 적용 → `list_tables`로 `review_reports` 확인
2. **RLS 음성 테스트** (SQL 또는 API로 직접 확인):
   - 사장님 A가 `shop_id=자기샵, review_id=타샵 리뷰`로 insert 시도 → 실패해야 함
   - 사장님 A가 사장님 B의 신고 row를 select 시도 → 안 보여야 함
   - `reason='other', reason_detail=null(or 5자)`로 insert 시도 → CHECK 위반으로 실패해야 함
   - non-admin이 approve/reject 엔드포인트 호출 → 403
3. **신고 제출 API**: 샵 사장님 계정으로 자기 샵 리뷰에 정상 신고 POST → 201 + DB row(스냅샷 포함) 확인. 타 샵 리뷰 신고 시 404
4. **어드민 API**: GET 목록에서 pending 확인 → approve 1회 성공 → 동일 id에 approve/reject 재호출 시 404/409(이중 처리 방지 확인) → 리뷰 삭제 후 해당 신고 상세에서 스냅샷으로 내용 표시되는지 확인
5. **어드민 UI**: 브라우저에서 `/admin/review-reports` 실제 클릭 플로우로 목록/상세/승인/반려/삭제 확인 (mock 아님)
6. **모바일 UI**: 신고 모달에서 기타 선택 시 텍스트 필수 검증, 제출 성공/실패 처리 확인
7. **웹 샵오너 UI**: `/shop-owner/reviews`에서 동일 플로우 확인
8. `rtk tsc`로 web/mobile 타입 에러 없는지 확인

## Risks / Questions

- 리뷰 작성자에게 신고/삭제 알림 여부는 미정 (Out of Scope, 필요하면 후속)
- 신고 사유 이넘 5개 문구는 구현 시 조정 가능
- 동일 리뷰 중복 신고 제한 없음 — 스팸성 반복 신고 가능성 있으나 이번 범위에서는 허용
- DB 마이그레이션 포함 — dev 적용 → 확인 → prod 적용 순서 필수, `main` 머지 전 prod 적용 완료 필요 (프로젝트 규칙)

## Adversarial Review

`mcp__codex__codex`로 1차 리뷰 진행, High 3건/Medium 4건/Low 3건 발견 — 전부 반영함:

1. **(High)** RLS INSERT 정책이 `review_id`/`shop_id` 일치를 검증 안 함 → `reviews` JOIN `shops`로 `review_id`가 실제 그 `shop_id`(자기 샵) 소속인지 확인하도록 수정
2. **(High)** `reason='other'` 자유텍스트 필수가 DB에 없음 → CHECK 제약 추가
3. **(High)** approve/reject에 race guard(`.eq("status","pending")`) 명시 안 됨 → 명시 + 404/409 처리 추가
4. **(Medium)** `submitted_by`가 `auth.users` FK라 `user_profiles` embedded join 불가 → `public.user_profiles(id)` FK로 변경
5. **(Medium)** 어드민 UI에서 기존 `DELETE /api/reviews/[id]` 호출 시 인증 방식 불명확 → 세션 access token Bearer 헤더 방식 명시
6. **(Medium)** `ON DELETE CASCADE`면 리뷰 삭제 시 신고 이력도 같이 사라짐 → `ON DELETE SET NULL` + 신고 시점 스냅샷 컬럼(`review_content_snapshot`, `review_image_urls_snapshot`) 추가
7. **(Medium)** 웹 샵오너 포털 포함 여부 불명확 → 사용자 확인 후 포함으로 확정, Scope/Plan에 반영
8. **(Low)** `apps/web/src/styles/color.ts`가 자동생성 파일인데 직접 추가하라고 되어 있었음 → 기존 theme 토�큰 사용으로 수정
9. **(Low)** 웹(next-intl `{}`)과 모바일(i18next `{{}}`) 보간 문법 차이 명시 안 됨 → 명시
10. **(Low)** Verification에 RLS 음성 케이스 부족 → 4가지 음성 테스트 케이스 추가

## Final Plan

위 Plan 섹션(1~7)이 adversarial review 반영 후 확정된 최종안. 구현 순서 권장: 1(마이그레이션, dev 적용 후 확인) → 2,3(API) → 4(어드민 UI) → 5,6(모바일/웹 신고 UI) → 7(스타일 점검) → Verification 전체 실행. DB 마이그레이션은 dev 적용/확인 후 반드시 사용자에게 prod 적용 여부 재확인.
