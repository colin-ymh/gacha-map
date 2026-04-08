-- Enable PostGIS for geo queries (optional)
-- create extension if not exists postgis;

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
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reported_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Reports table (제보)
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references shops(id) on delete set null,
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

-- Duplicate candidates table (중복 후보)
create table if not exists duplicate_candidates (
  id uuid primary key default gen_random_uuid(),
  shop_a_id uuid not null references shops(id) on delete cascade,
  shop_b_id uuid not null references shops(id) on delete cascade,
  reviewed boolean not null default false,
  created_at timestamptz not null default now()
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

-- RLS Policies
alter table shops enable row level security;
alter table reports enable row level security;
alter table wishlists enable row level security;
alter table duplicate_candidates enable row level security;

-- shops: 누구나 approved 샵 조회 가능
create policy "public can view approved shops"
  on shops for select
  using (status = 'approved');

-- reports: 누구나 제보 등록 가능
create policy "anyone can insert reports"
  on reports for insert
  with check (true);

-- wishlists: 본인 찜만 조회/수정
create policy "users manage their own wishlists"
  on wishlists for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Indexes
create index if not exists shops_status_idx on shops(status);
create index if not exists shops_tags_idx on shops using gin(tags);
create index if not exists reports_status_idx on reports(status);
create index if not exists wishlists_user_id_idx on wishlists(user_id);
