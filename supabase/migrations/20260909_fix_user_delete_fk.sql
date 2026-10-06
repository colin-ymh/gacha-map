-- 회원탈퇴 실패 수정
--
-- 증상: prod 앱에서 회원탈퇴 시 "Database error deleting user".
-- 원인: auth.users 를 참조하는 FK 중 ON DELETE 규칙이 없는(NO ACTION) 것들이
--       auth.admin.deleteUser() 의 DELETE 를 막는다.
--       특히 gacha_roll_results.user_id 는 가챠를 한 번이라도 돌린 유저 전원을 차단한다.
--
-- 방침:
--   - 개인 식별정보(auth.users, user_profiles)는 기존대로 즉시 파기 (CASCADE 유지).
--   - gacha_roll_results 는 행을 남기고 user_id 만 끊는다(익명화).
--     get_daily_featured_gacha(SECURITY DEFINER) 의 인기 슬롯 집계가 유지된다.
--     개인 통계 조회는 전부 user_id 로 필터하므로 NULL 행은 영향 없다.
--   - 관리자 심사/제보 감사 필드는 SET NULL 로 모더레이션 기록을 보존한다.

-- 1) gacha_roll_results: 롤 이력 익명 보존
alter table public.gacha_roll_results
  alter column user_id drop not null;

alter table public.gacha_roll_results
  drop constraint gacha_roll_results_user_id_fkey;

alter table public.gacha_roll_results
  add constraint gacha_roll_results_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;

-- 2) shop_image_reports: 제보자 / 심사자
alter table public.shop_image_reports
  drop constraint shop_image_reports_submitted_by_fkey;

alter table public.shop_image_reports
  add constraint shop_image_reports_submitted_by_fkey
  foreign key (submitted_by) references auth.users(id) on delete set null;

alter table public.shop_image_reports
  drop constraint shop_image_reports_reviewed_by_fkey;

alter table public.shop_image_reports
  add constraint shop_image_reports_reviewed_by_fkey
  foreign key (reviewed_by) references auth.users(id) on delete set null;

-- 3) abuse_flags: 심사자
alter table public.abuse_flags
  drop constraint abuse_flags_reviewed_by_fkey;

alter table public.abuse_flags
  add constraint abuse_flags_reviewed_by_fkey
  foreign key (reviewed_by) references auth.users(id) on delete set null;

-- 4) review_reports: 심사자
alter table public.review_reports
  drop constraint review_reports_reviewed_by_fkey;

alter table public.review_reports
  add constraint review_reports_reviewed_by_fkey
  foreign key (reviewed_by) references auth.users(id) on delete set null;

-- 5) review_reports.submitted_by -> user_profiles
--    user_profiles 는 auth.users 에서 CASCADE 되므로, 규칙이 없으면 한 홉 뒤에서 같은 블로커가 된다.
alter table public.review_reports
  alter column submitted_by drop not null;

alter table public.review_reports
  drop constraint review_reports_submitted_by_fkey;

alter table public.review_reports
  add constraint review_reports_submitted_by_fkey
  foreign key (submitted_by) references public.user_profiles(id) on delete set null;
