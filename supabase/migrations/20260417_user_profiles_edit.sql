-- 프로필 편집을 위한 컬럼 추가
alter table public.user_profiles
  add column if not exists nickname text,
  add column if not exists avatar_url text;

-- 닉네임 20자 제한
alter table public.user_profiles
  add constraint nickname_max_length check (char_length(nickname) <= 20);

-- 사용자 본인 프로필 INSERT/UPDATE 허용
create policy "users can insert own profile"
  on public.user_profiles for insert
  with check (auth.uid() = id);

create policy "users can update own profile"
  on public.user_profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- avatars 스토리지 버킷 생성
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- 스토리지 RLS: 본인 폴더에만 업로드 가능
create policy "users can upload own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users can update own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "anyone can view avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');
