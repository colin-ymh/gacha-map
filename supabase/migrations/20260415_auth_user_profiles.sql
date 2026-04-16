-- user_profiles 테이블 생성
create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('user', 'shop_owner', 'admin')),
  email text,
  name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

create policy "users can view own profile"
  on public.user_profiles for select
  using (auth.uid() = id);

create policy "admins can view all profiles"
  on public.user_profiles for select
  using (auth.jwt()->'app_metadata'->>'role' = 'admin');

create policy "admins can update profiles"
  on public.user_profiles for update
  using (auth.jwt()->'app_metadata'->>'role' = 'admin')
  with check (auth.jwt()->'app_metadata'->>'role' = 'admin');

create trigger user_profiles_updated_at
  before update on public.user_profiles
  for each row execute function update_updated_at();

-- 신규 가입 트리거
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      null
    )
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- reports 테이블에 user_id 추가
alter table public.reports
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists reports_user_id_idx on public.reports(user_id);

-- reports RLS 수정: 로그인 사용자만 제보 가능
drop policy if exists "anyone can insert reports" on public.reports;

create policy "authenticated users can insert reports"
  on public.reports for insert
  with check (auth.uid() is not null and auth.uid() = user_id);

-- user_profiles 인덱스
create index if not exists user_profiles_role_idx on public.user_profiles(role);
