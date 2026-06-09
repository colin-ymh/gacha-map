-- Enable PostGIS for geo queries (optional)
-- create extension if not exists postgis;

-- User profiles table (소셜 로그인 가입 시 자동 생성)
create table if not exists user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('user', 'shop_owner', 'admin')),
  email text,
  name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table user_profiles enable row level security;

-- 자신의 프로필 조회
create policy "users can view own profile"
  on user_profiles for select
  using (auth.uid() = id);

-- admin은 전체 조회 (app_metadata로 재귀 방지)
create policy "admins can view all profiles"
  on user_profiles for select
  using (auth.jwt()->'app_metadata'->>'role' = 'admin');

-- admin만 역할 변경 가능
create policy "admins can update profiles"
  on user_profiles for update
  using (auth.jwt()->'app_metadata'->>'role' = 'admin')
  with check (auth.jwt()->'app_metadata'->>'role' = 'admin');

-- Candidate groups table (데이터 파이프라인 중간 산출물)
create table if not exists candidate_groups (
  id bigint primary key generated always as identity,
  representative_name text,
  representative_address text,
  representative_lat double precision,
  representative_lng double precision,
  confidence_score double precision,
  status text not null default 'active' check (status in ('active', 'merged', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Shops table
create table if not exists shops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  lat double precision not null,
  lng double precision not null,
  description text,
  tags text[] default '{}',
  image_urls text[] default '{}',
  is_authorized boolean not null default false,
  place_id text,
  candidate_group_id bigint references candidate_groups(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'hidden', 'archived')),
  reported_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Reports table (제보)
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references shops(id) on delete set null,
  report_type text not null default 'other'
    check (report_type in ('new_shop', 'fix_info', 'closed', 'other')),
  user_id uuid references auth.users(id) on delete set null,
  reporter_name text,
  reporter_contact text,
  content text not null,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'resolved')),
  created_at timestamptz not null default now()
);

-- Wishlists table (찜하기)
create table if not exists wishlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  shop_id uuid not null references shops(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, shop_id)
);

-- Temporal shops table (사용자 제보/신청 대기)
create table if not exists temporal_shops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  lat double precision,
  lng double precision,
  phone text,
  description text,
  tags text[] default '{}',
  image_urls text[] default '{}',
  shop_id uuid references shops(id) on delete set null,
  submitter_name text,
  submitter_contact text,
  submitted_by uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Updated_at trigger
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger shops_updated_at
  before update on shops
  for each row execute function update_updated_at();

create trigger user_profiles_updated_at
  before update on user_profiles
  for each row execute function update_updated_at();

-- 신규 가입 시 user_profiles 자동 생성 트리거
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (id, email, name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      null
    ),
    coalesce(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture',
      null
    )
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- RLS Policies
alter table shops enable row level security;
alter table reports enable row level security;
alter table wishlists enable row level security;

-- shops: 누구나 active 샵 조회 가능
create policy "public can view active shops"
  on shops for select
  using (status = 'active');

-- reports: 로그인한 사용자만 제보 가능, user_id는 본인 것만
create policy "authenticated users can insert reports"
  on reports for insert
  with check (auth.uid() is not null and auth.uid() = user_id);

-- wishlists: 본인 찜만 조회/수정
create policy "users manage their own wishlists"
  on wishlists for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Indexes
create index if not exists shops_status_idx on shops(status);
create index if not exists shops_tags_idx on shops using gin(tags);
create index if not exists reports_status_idx on reports(status);
create index if not exists reports_user_id_idx on reports(user_id);
create index if not exists wishlists_user_id_idx on wishlists(user_id);
create index if not exists user_profiles_role_idx on user_profiles(role);
