-- 완구 브랜드 계열을 상위 브랜드 시리즈에 연결한다.
--
-- 결정된 축 정의 (docs/plans/20260907-taxonomy-axis-redefinition.md)
--   series = IP·브랜드. 완구 브랜드(토미카·플라레일·아니아)까지 포함하도록 넓혔다.
--   line   = 제품 계열. 제조사가 여러 상품을 지속 전개하는 상품군 이름.
--
-- 이 마이그레이션은 **링크만 더한다. line 카테고리는 건드리지 않는다.**
--
--   포켓토미카(21) ─┐
--   캡슐토미카DX(6) ─┼─→ 토미카 series 에 연결
--   캡슐 플라레일(107) → 플라레일 series
--   캡슐 아니아(8)     → 아니아 series (신규)
--
-- archive 하지 않는 이유
--   codex 검토 지적. 상위 브랜드 연결을 더하는 것과 기존 계열을 폐기하는 것은
--   별개 결정이다. archive 하면 "토미카 상품"인 건 알아도 포켓토미카인지
--   캡슐토미카DX인지 구분이 사라진다. 시리즈 축에서 토미카로 전부 찾히면
--   목적은 달성되므로 계열은 그대로 둔다.
--
-- 사전을 3열로 바꾼 이유 (pattern_ja / pattern_ko / target_ko)
--   이전 사전은 타깃 이름으로 한국어 상품명도 매칭했다. 타깃이 계열명과 같을
--   때는 문제없었지만, 포켓토미카를 '토미카'에 붙이려면 타깃이 달라진다.
--   그대로 두면 '토미카'가 들어간 상품 51건이 걸린다 — 의도한 27건의 두 배다.
--   (토미카 주니어 컬렉션, 애니 '토미카와 톰' 등이 딸려온다)
--
-- 충돌 규칙을 바꾼 이유
--   이전 upsert 는 relation_type 과 source 를 덮었다. 그러면 name_parts 가 만든
--   primary/collaboration(IP 관계) 19건이 line 으로 바뀐다. 상품 수는 그대로라
--   개수 검증으로는 안 잡힌다. 갱신 대상을 confidence 로 좁히고, 대상 행도
--   source='known_product_line_term' 인 것만으로 제한했다.
--
-- 실행 순서 주의
--   함수에 "사전 타깃이 전부 해소되는가" 검사가 들어 있어, 아니아·컵 소코코가
--   active 로 존재하지 않으면 예외로 죽는다. 그래서 시리즈 확보가 함수 교체보다
--   먼저 온다.
--
-- 롤백
--   update public.gacha_series set status='archived' where name_ko='아니아';
--   update public.gacha_series set status='archived', kind='toy_line' where name_ko='컵 소코코';
--   -- 그리고 refresh_gacha_product_series 를 20260907_revert 정의로 복원 후 재실행

-- 1) 타깃 시리즈 확보 (함수 교체보다 먼저)

-- 아니아 — 타카라토미 동물 피규어 브랜드. 기존 시리즈가 없어 새로 만든다.
insert into public.gacha_series (name_ko, name_ja, kind, status, source, note)
values ('아니아', 'アニア', 'franchise', 'active', 'manual',
        'Takara Tomy animal figure brand. Parent of the 캡슐 아니아 product line.')
on conflict (name_ko_norm) do update
set status = 'active',
    kind = excluded.kind,
    name_ja = coalesce(public.gacha_series.name_ja, excluded.name_ja),
    updated_at = now();

-- 컵 소코코 — 키탄클럽 캐릭터. archived 상태로 이미 존재해 되살린다.
-- 후치코와 같은 제조사의 다른 캐릭터라 별개 시리즈로 둔다. 계층으로 묶으면
-- 루트 목록(parent_id is null)에서 사라지므로 근거 없이 부모를 지정하지 않는다.
update public.gacha_series
set status = 'active',
    kind = 'character_brand',
    is_hidden = false,
    updated_at = now()
where name_ko = '컵 소코코';

-- 2) 브랜드 사전 3열 구조로 교체
create or replace function public.refresh_gacha_product_series(p_product_ids uuid[] default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_series_upserted integer := 0;
  v_deleted_mappings integer := 0;
  v_mappings_upserted integer := 0;
  v_brand_mappings_upserted integer := 0;
begin
  if p_product_ids is not null and cardinality(p_product_ids) = 0 then
    return jsonb_build_object(
      'series_upserted', 0,
      'deleted_mappings', 0,
      'mappings_upserted', 0
    );
  end if;

  -- 1. Ensure a canonical series entity exists for every referenced series name,
  --    EXCEPT titles that step 2 will split into collaboration rows.
  with raw_product_series as (
    select
      gp.id as product_id,
      nullif(btrim(gp.name_parts -> 'series' ->> 'ko'), '') as series_ko,
      nullif(btrim(gp.name_parts -> 'series' ->> 'ja'), '') as series_ja
    from public.gacha_products gp
    where gp.status = 'active'
      and gp.name_parts -> 'series' ->> 'ko' is not null
      and (p_product_ids is null or gp.id = any(p_product_ids))
  ),
  prepared as (
    select
      product_id,
      series_ko,
      series_ja,
      regexp_split_to_array(series_ko, '\s*[×]\s*') as ko_parts
    from raw_product_series
    where series_ko is not null
  ),
  parts as (
    select
      p.product_id,
      cardinality(p.ko_parts) as part_count,
      nullif(btrim(u.ko_part), '') as name_ko,
      public.gacha_normalize_search_text(nullif(btrim(u.ko_part), '')) as part_norm
    from prepared p
    cross join lateral unnest(p.ko_parts) with ordinality as u(ko_part, ord)
  ),
  split_ready as (
    select p.product_id
    from parts p
    join public.gacha_series s on s.name_ko_norm = p.part_norm
    where p.part_count > 1
      and p.name_ko is not null
    group by p.product_id, p.part_count
    having count(distinct p.part_norm) = p.part_count
       and count(distinct s.id) = p.part_count
  ),
  series_candidates as (
    select distinct on (public.gacha_normalize_search_text(p.series_ko))
      p.series_ko as name_ko,
      p.series_ja as name_ja
    from prepared p
    where not exists (
      select 1 from split_ready sr where sr.product_id = p.product_id
    )
    order by
      public.gacha_normalize_search_text(p.series_ko),
      length(p.series_ko),
      p.series_ko,
      p.series_ja is null,
      length(coalesce(p.series_ja, '')),
      p.series_ja
  )
  insert into public.gacha_series (name_ko, name_ja, kind, status, source, note)
  select
    name_ko,
    name_ja,
    'unknown',
    'active',
    'name_parts',
    'Backfilled from gacha_products.name_parts.series'
  from series_candidates
  on conflict (name_ko_norm) do update
  set
    name_ja = coalesce(public.gacha_series.name_ja, excluded.name_ja),
    updated_at = now();
  get diagnostics v_series_upserted = row_count;

  -- 2. Rebuild the product-to-series mapping for the requested scope.
  delete from public.gacha_product_series ps
  where ps.source in ('name_parts', 'known_product_line_term')
    and (p_product_ids is null or ps.product_id = any(p_product_ids));
  get diagnostics v_deleted_mappings = row_count;

  with raw_product_series as (
    select
      gp.id as product_id,
      nullif(btrim(gp.name_parts -> 'series' ->> 'ko'), '') as series_ko
    from public.gacha_products gp
    where gp.status = 'active'
      and gp.name_parts -> 'series' ->> 'ko' is not null
      and (p_product_ids is null or gp.id = any(p_product_ids))
  ),
  prepared as (
    select
      product_id,
      series_ko,
      public.gacha_normalize_search_text(series_ko) as series_norm,
      regexp_split_to_array(series_ko, '\s*[×]\s*') as ko_parts
    from raw_product_series
    where series_ko is not null
  ),
  parts as (
    select
      p.product_id,
      p.series_ko,
      p.series_norm,
      cardinality(p.ko_parts) as part_count,
      u.ord,
      nullif(btrim(u.ko_part), '') as name_ko,
      public.gacha_normalize_search_text(nullif(btrim(u.ko_part), '')) as part_norm
    from prepared p
    cross join lateral unnest(p.ko_parts) with ordinality as u(ko_part, ord)
  ),
  split_ready as (
    select p.product_id
    from parts p
    join public.gacha_series s on s.name_ko_norm = p.part_norm
    where p.part_count > 1
      and p.name_ko is not null
    group by p.product_id, p.part_count
    having count(distinct p.part_norm) = p.part_count
       and count(distinct s.id) = p.part_count
  ),
  mapping_candidates as (
    select
      p.product_id,
      p.part_norm as target_norm,
      'collaboration'::text as relation_type
    from parts p
    join split_ready sr on sr.product_id = p.product_id
    where p.name_ko is not null
    union all
    select
      p.product_id,
      p.series_norm as target_norm,
      'primary'::text as relation_type
    from prepared p
    where not exists (
      select 1 from split_ready sr where sr.product_id = p.product_id
    )
  ),
  resolved as (
    select
      mc.product_id,
      coalesce(s.merged_into_id, s.id) as series_id,
      mc.relation_type
    from mapping_candidates mc
    join public.gacha_series s on s.name_ko_norm = mc.target_norm
  ),
  deduped as (
    select distinct on (product_id, series_id)
      product_id,
      series_id,
      relation_type
    from resolved
    order by
      product_id,
      series_id,
      case relation_type when 'primary' then 0 else 1 end,
      relation_type
  )
  insert into public.gacha_product_series (
    product_id,
    series_id,
    relation_type,
    confidence,
    source,
    note
  )
  select
    product_id,
    series_id,
    relation_type,
    1,
    'name_parts',
    'Backfilled from gacha_products.name_parts.series'
  from deduped
  on conflict (product_id, series_id) do update
  set
    relation_type = excluded.relation_type,
    confidence = greatest(public.gacha_product_series.confidence, excluded.confidence),
    updated_at = now()
  where public.gacha_product_series.source = 'name_parts';
  get diagnostics v_mappings_upserted = row_count;


  -- 브랜드 사전 — 상품명 정규식으로 시리즈를 직접 연결한다.
  --
  -- 사전이 3열인 이유:
  --   pattern_ja  일본어 상품명에 매칭할 정규식
  --   pattern_ko  한국어 상품명에 매칭할 정규식
  --   target_ko   링크를 걸 대상 시리즈 이름
  --
  -- 패턴과 타깃을 분리하지 않으면 한국어 매칭이 폭주한다. 예를 들어 포켓토미카를
  -- '토미카' 시리즈에 붙이려고 타깃 이름으로 name_ko 를 매칭하면, 의도한 27건
  -- 대신 '토미카'가 들어간 모든 상품 51건이 걸린다(토미카 주니어 컬렉션,
  -- 애니 '토미카와 톰' 등). 한국어 패턴은 계열명 그대로 두고 타깃은 조인에만 쓴다.
  with brand_patterns(pattern_ja, pattern_ko, target_ko) as (
    values
      -- 자체 캐릭터 브랜드 — 계열명과 타깃이 같다
      ('にっこりーノ',        '닛코리노',      '닛코리노'),
      ('コップのフチ子|のフチ子', '컵의 후치코', '컵의 후치코'),
      ('コップのソコ子',      '컵 소코코',     '컵 소코코'),
      -- 제품 계열 → 상위 완구 브랜드. line 카테고리는 그대로 두고 상위 링크만 더한다
      ('カプセルプラレール',  '캡슐 플라레일', '플라레일'),
      ('ポケットトミカ',      '포켓토미카',    '토미카'),
      ('カプセルトミカDX',    '캡슐토미카DX',  '토미카'),
      ('カプセルアニア',      '캡슐 아니아',   '아니아')
  ),
  brand_matches as (
    select distinct gp.id as product_id, bp.target_ko
    from public.gacha_products gp
    join brand_patterns bp
      on coalesce(gp.name_ja, gp.name, '') ~ bp.pattern_ja
      or coalesce(gp.name, '') ~ bp.pattern_ja
      or coalesce(gp.name_ko, '') ~ bp.pattern_ko
    where gp.status = 'active'
      and (p_product_ids is null or gp.id = any(p_product_ids))
  ),
  -- 타깃을 실제 시리즈 id 로 해소한 뒤 (product_id, series_id) 로 중복을 없앤다.
  -- 포켓토미카와 캡슐토미카DX 가 같은 '토미카' 로 가므로, 이름 단위로만 distinct
  -- 하면 한 문장에서 같은 행을 두 번 갱신하려다 실패한다.
  brand_resolved as (
    select distinct bm.product_id, s.id as series_id
    from brand_matches bm
    join public.gacha_series s
      on s.name_ko_norm = public.gacha_normalize_search_text(bm.target_ko)
     and s.status = 'active'
     and s.merged_into_id is null
  )
  insert into public.gacha_product_series (product_id, series_id, relation_type, confidence, source)
  select br.product_id, br.series_id, 'line', 1, 'known_product_line_term'
  from brand_resolved br
  on conflict (product_id, series_id) do update
  set confidence = greatest(public.gacha_product_series.confidence, excluded.confidence),
      updated_at = now()
  -- 기존 의미 관계를 덮지 않는다. name_parts 가 만든 primary/collaboration 은
  -- IP 관계이고 브랜드 사전이 만드는 line 보다 정보량이 많다. relation_type 과
  -- source 를 갱신 대상에서 뺀 이유다.
  where public.gacha_product_series.source = 'known_product_line_term';
  get diagnostics v_brand_mappings_upserted = row_count;

  -- 사전 타깃이 전부 해소됐는지 확인한다. 하나라도 못 찾으면 링크가 조용히
  -- 누락되고, 그 상태로 카테고리를 archive 하면 분류 공백이 된다.
  declare
    v_unresolved text;
  begin
    select string_agg(t.target_ko, ', ')
      into v_unresolved
    from (values ('닛코리노'), ('컵의 후치코'), ('컵 소코코'),
                 ('플라레일'), ('토미카'), ('아니아')) as t(target_ko)
    where not exists (
      select 1 from public.gacha_series s
      where s.name_ko_norm = public.gacha_normalize_search_text(t.target_ko)
        and s.status = 'active'
        and s.merged_into_id is null
    );
    if v_unresolved is not null then
      raise exception 'brand dictionary target(s) unresolved: %', v_unresolved;
    end if;
  end;

  return jsonb_build_object(
    'series_upserted', v_series_upserted,
    'deleted_mappings', v_deleted_mappings,
    'mappings_upserted', v_mappings_upserted,
    'brand_mappings_upserted', v_brand_mappings_upserted
  );
end;
$function$;
comment on function public.refresh_gacha_product_series(uuid[]) is
  'Rebuilds gacha_series entities and gacha_product_series mappings from gacha_products.name_parts.series, plus a brand dictionary that links self-contained brands and toy-brand product lines by product-name regex. Dictionary separates match pattern from target series name. NULL argument refreshes every active product.';

grant execute on function public.refresh_gacha_product_series(uuid[]) to authenticated;

-- 3) 재생성
select public.refresh_gacha_product_series();

refresh materialized view public.gacha_series_browse;

notify pgrst, 'reload schema';
