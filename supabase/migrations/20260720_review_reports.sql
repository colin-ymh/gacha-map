-- review_reports 테이블 생성
-- 샵 사장님이 자기 샵 리뷰를 어드민에게 신고하는 기능
CREATE TABLE IF NOT EXISTS public.review_reports (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id                   uuid        REFERENCES public.reviews(id) ON DELETE SET NULL,
  shop_id                     uuid        NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  -- 리뷰가 나중에 삭제돼도 신고 당시 내용을 볼 수 있도록 스냅샷 보관
  review_content_snapshot     text,
  review_image_urls_snapshot  text[]      NOT NULL DEFAULT '{}',
  reason                      text        NOT NULL
                                          CHECK (reason IN ('spam', 'abusive', 'irrelevant', 'fake', 'other')),
  reason_detail                text,
  status                       text        NOT NULL DEFAULT 'pending'
                                          CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_by                 uuid        NOT NULL REFERENCES public.user_profiles(id),
  reviewed_by                  uuid        REFERENCES auth.users(id),
  reviewed_at                  timestamptz,
  created_at                   timestamptz NOT NULL DEFAULT now(),
  CHECK (reason <> 'other' OR char_length(trim(coalesce(reason_detail, ''))) BETWEEN 10 AND 500)
);

-- RLS 활성화
ALTER TABLE public.review_reports ENABLE ROW LEVEL SECURITY;

-- 어드민: 전체 권한
CREATE POLICY "admins can manage review_reports"
  ON public.review_reports
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 샵 사장님: review_id가 실제로 자기 shop_id 소속일 때만 INSERT 허용
CREATE POLICY "shop owners can report own shop reviews"
  ON public.review_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = submitted_by
    AND EXISTS (
      SELECT 1 FROM public.reviews r
      JOIN public.shops s ON s.id = r.shop_id
      WHERE r.id = review_id AND r.shop_id = shop_id AND s.owner_id = auth.uid()
    )
  );

-- 샵 사장님: 자기가 제출한 신고만 SELECT 허용
CREATE POLICY "shop owners can view own review reports"
  ON public.review_reports
  FOR SELECT
  TO authenticated
  USING (auth.uid() = submitted_by);

CREATE INDEX review_reports_status_idx ON public.review_reports(status);
CREATE INDEX review_reports_review_id_idx ON public.review_reports(review_id);
