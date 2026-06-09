-- Fix handle_new_user trigger to copy avatar_url from OAuth metadata (Google uses 'picture')
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

-- Backfill avatar_url for existing users who signed up before this fix
update public.user_profiles up
set avatar_url = coalesce(
  au.raw_user_meta_data->>'avatar_url',
  au.raw_user_meta_data->>'picture'
)
from auth.users au
where up.id = au.id
  and up.avatar_url is null
  and (
    au.raw_user_meta_data->>'avatar_url' is not null
    or au.raw_user_meta_data->>'picture' is not null
  );
