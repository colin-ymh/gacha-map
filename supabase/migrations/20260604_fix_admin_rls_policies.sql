-- auth.jwt()->app_metadata->role 기반 정책 → DB 직접 조회 방식으로 교체
-- 기존 정책은 JWT custom claims가 없으면 동작 안 함

-- SECURITY DEFINER 함수: RLS 재귀 없이 현재 유저의 role 확인
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.user_profiles WHERE id = auth.uid();
$$;

-- 기존 JWT 기반 정책 교체
DROP POLICY IF EXISTS "admins can view all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "admins can update profiles" ON public.user_profiles;

CREATE POLICY "admins can view all profiles"
  ON public.user_profiles FOR SELECT
  USING (public.get_current_user_role() = 'admin');

CREATE POLICY "admins can update profiles"
  ON public.user_profiles FOR UPDATE
  USING (public.get_current_user_role() = 'admin')
  WITH CHECK (public.get_current_user_role() = 'admin');
