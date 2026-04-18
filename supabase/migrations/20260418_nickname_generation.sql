-- 랜덤 닉네임 생성 함수
create or replace function public.generate_unique_nickname()
returns text
language plpgsql
as $$
declare
  adjectives text[] := array[
    '빠른','느린','귀여운','용감한','행복한','밝은','강한','작은','큰','신나는',
    '따뜻한','멋진','재밌는','활발한','착한','영리한','조용한','당찬','씩씩한','엉뚱한'
  ];
  nouns text[] := array[
    '토끼','고양이','강아지','여우','곰','판다','펭귄','오리','너구리','다람쥐',
    '햄스터','고슴도치','부엉이','두더지','사자'
  ];
  candidate text;
  attempts int := 0;
begin
  loop
    candidate := adjectives[1 + floor(random() * array_length(adjectives, 1))::int]
      || nouns[1 + floor(random() * array_length(nouns, 1))::int]
      || (1000 + floor(random() * 9000)::int)::text;
    if not exists (select 1 from public.user_profiles where nickname = candidate) then
      return candidate;
    end if;
    attempts := attempts + 1;
    if attempts >= 10 then
      return 'user_' || substr(gen_random_uuid()::text, 1, 8);
    end if;
  end loop;
end;
$$;

-- nickname UNIQUE 제약 추가
alter table public.user_profiles
  drop constraint if exists user_profiles_nickname_key;

alter table public.user_profiles
  add constraint user_profiles_nickname_key unique (nickname);

-- handle_new_user 트리거: nickname 자동 생성
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.user_profiles (id, email, name, nickname)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    public.generate_unique_nickname()
  );
  return new;
end;
$$;

-- 기존 NULL nickname 백필
update public.user_profiles
set nickname = public.generate_unique_nickname()
where nickname is null;
