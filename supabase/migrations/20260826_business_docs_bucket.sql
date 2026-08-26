-- 사업자등록증 등 증빙 서류용 비공개 스토리지 버킷
--
-- 기존 shop-images 버킷은 public: true 라서 재사용할 수 없다.
-- 사업자등록증에는 대표자 성명과 사업장 주소가 담기므로 URL만 알면 누구나
-- 열람 가능한 공개 버킷에 두면 안 된다.
--
-- 접근 모델
--   - Storage RLS 정책을 **의도적으로 만들지 않는다.**
--     storage.objects는 RLS가 켜져 있고 service_role만 이를 우회하므로,
--     정책이 없으면 anon/authenticated는 읽기도 쓰기도 불가능하다.
--   - 업로드: 클라이언트 -> POST /api/shop-applications (multipart)
--             -> 서버가 service_role로 업로드
--   - 열람:   admin -> GET /api/admin/shop-applications/[id]/documents
--             -> 서버가 단기 만료 서명 URL을 발급
--   - DB에는 public URL이 아니라 **경로만** 저장한다
--     (shop_owner_applications.document_paths)

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'business-docs',
  'business-docs',
  false,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 혹시 과거에 만들어진 정책이 있으면 제거한다. 이 버킷은 서버 전용이다.
DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT policyname
      FROM pg_policies
     WHERE schemaname = 'storage'
       AND tablename = 'objects'
       AND (qual LIKE '%business-docs%' OR with_check LIKE '%business-docs%')
  LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', p.policyname);
    RAISE NOTICE 'dropped storage policy %', p.policyname;
  END LOOP;
END $$;
