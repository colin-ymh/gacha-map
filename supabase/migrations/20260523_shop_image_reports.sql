-- shop_image_reports 테이블 생성
CREATE TABLE IF NOT EXISTS public.shop_image_reports (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id      uuid        NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  image_url    text        NOT NULL,
  thumb_url    text,
  status       text        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'approved', 'rejected')),
  source       text        NOT NULL DEFAULT 'admin'
                           CHECK (source IN ('admin', 'user_report')),
  submitted_by uuid        REFERENCES auth.users(id),
  reviewed_by  uuid        REFERENCES auth.users(id),
  reviewed_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- RLS 활성화
ALTER TABLE public.shop_image_reports ENABLE ROW LEVEL SECURITY;

-- 어드민: 모든 권한
CREATE POLICY "admins can manage shop_image_reports"
  ON public.shop_image_reports
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

-- 일반 사용자: 자신의 제보만 INSERT 허용 (사용자 제보 UI 추가 시 활성화)
CREATE POLICY "users can insert own image reports"
  ON public.shop_image_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    source = 'user_report'
    AND auth.uid() = submitted_by
  );

-- 일반 사용자: 자신의 제보만 SELECT 허용
CREATE POLICY "users can view own image reports"
  ON public.shop_image_reports
  FOR SELECT
  TO authenticated
  USING (auth.uid() = submitted_by);

-- shop-images Storage 버킷 생성 (10MB, jpeg/png/webp)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'shop-images',
  'shop-images',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage: 누구나 읽기 가능 (public bucket)
CREATE POLICY "anyone can view shop images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'shop-images');
