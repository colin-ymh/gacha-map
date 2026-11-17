-- 브랜드형 라인 4건을 line 카테고리에서 시리즈로 되돌린다.
--
-- 배경
--   20260904_expand_line_category_dictionary 가 toy_line 정리 과정에서 24건을 line
--   사전에 넣었는데, 그중 4건은 형태(form factor)가 아니라 자기완결 브랜드였다.
--   판정 근거였던 "상품 링크 88%가 line 카테고리로 미커버"는 사전 미등재를 보여줄 뿐
--   형태냐 브랜드냐를 가리지 못한다.
--
--   상품명에 외부 IP가 붙는 비율로 다시 재면 (dev 2026-09-06):
--     닛코리노 0% · 포켓토미카 0% · 판다의 구멍 1.3% · 컵의 후치코 3.4%   → 브랜드
--     오네무탄 80% · 카타즌 100% · 캡슐 플라레일 100%                     → 형태
--   80%와 3.4% 사이가 비어 있어 경계가 데이터에서 갈린다.
--
--   캡슐 플라레일은 IP 종류가 8개로 적어 초안에서 브랜드로 오분류됐으나, 상품 107개
--   전부가 토마스 IP를 달고 있어 형태 라인이 맞다. 건드리지 않는다.
--
-- 왜 "시리즈를 되살리기"가 아니라 "사전을 시리즈 쪽에 새로 심기"인가
--   두 축의 링크 생성 방식이 다르다. line 카테고리는 상품명 정규식으로, 시리즈는
--   name_parts.series 추출값으로 만든다. 그래서 같은 브랜드인데 카테고리 369건 /
--   시리즈 288건으로 갈린다. 시리즈 status 만 active 로 바꾸고 refresh 에 맡기면
--   81건이 분류를 잃는다. 링크를 만드는 주체가 사전 정규식이므로 그 사전을 옮긴다.
--
-- 카테고리 쪽을 왜 함수 수정이 아니라 archive 로 끊는가
--   refresh_gacha_product_categories() 의 line 삽입은
--     join gacha_categories c ... and c.category_type='line' and c.status='active'
--   이므로, 카테고리를 archive 하면 조인이 실패해 링크가 생기지 않는다.
--   같은 함수가 line 카테고리를 upsert 하지 않는 것도 확인했다(v_line_categories_upserted
--   가 선언만 되고 대입되지 않음). 즉 archive 는 refresh 를 돌려도 유지된다.
--   7.5KB 함수를 4줄 지우려고 통째로 교체하는 것보다 되돌리기 쉽고 위험이 작다.
--
--   ⚠️ line_patterns 사전에는 4건이 그대로 남는다. 카테고리가 archived 라 무해하지만,
--      누군가 그 카테고리를 다시 active 로 바꾸면 링크가 되살아난다. 사전에서 실제로
--      지우는 것은 후속 정리 과제로 남긴다.
--
-- 재실행 시
--   함수/제약은 멱등. update 는 where 조건으로 이미 반영된 행을 건너뛴다.
--
-- 롤백
--   update public.gacha_series set status='archived', kind='toy_line'
--   where name_ko in ('닛코리노','판다의 구멍','컵의 후치코','포켓토미카');
--   update public.gacha_categories set status='active'
--   where category_type='line'
--     and name_ko in ('닛코리노','판다의 구멍','컵의 후치코','포켓토미카');
--   -- 그리고 refresh_gacha_product_series 를 20260822 정의로 복원 후 두 refresh 재실행

-- 1) gacha_product_series.source 에 known_product_line_term 을 허용한다.
--    카테고리 쪽에는 이미 있는 값인데 시리즈 쪽 CHECK 에는 없어서, 그대로 옮기면
--    제약 위반이 난다.
alter table public.gacha_product_series
  drop constraint if exists gacha_product_series_source_check;

alter table public.gacha_product_series
  add constraint gacha_product_series_source_check
  check (source = any (array['name_parts', 'manual', 'collector_llm', 'user_log', 'known_product_line_term']));

-- 2) archived toy_line 시리즈 4건을 브랜드 시리즈로 되살린다.
--    kind 를 toy_line 으로 두면 browse_gacha_series 의 `kind <> 'toy_line'` 하드코딩에
--    걸려 노출되지 않는다. is_browsable 은 현행 RPC 가 쓰지 않아 건드리지 않고,
--    parent_id 는 null 을 유지한다 — 루트 목록이 `parent_id is null` 을 요구한다.
--    아래 3) 의 브랜드 사전이 status='active' 를 조인하므로 이 update 가 먼저다.
update public.gacha_series
set kind = case name_ko when '포켓토미카' then 'franchise' else 'character_brand' end,
    status = 'active',
    is_hidden = false,
    updated_at = now()
where name_ko in ('닛코리노', '판다의 구멍', '컵의 후치코', '포켓토미카')
  and kind = 'toy_line';

-- 3) line 카테고리 4건 archive → 카테고리 쪽 링크 생성 경로를 끊는다.
update public.gacha_categories
set status = 'archived',
    updated_at = now()
where category_type = 'line'
  and name_ko in ('닛코리노', '판다의 구멍', '컵의 후치코', '포켓토미카');

-- 4) 시리즈 refresh 에 브랜드 사전 블록 신설 + 삭제 범위 확장
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
  -- 닛코리노·판다의 구멍 같은 자기완결 브랜드는 자체 캐릭터에 소재만 바꿔 다는
  -- 구조라 name_parts.series 로는 일부만 잡힌다(카테고리 시절 369 vs 시리즈 288).
  -- 카테고리 축에서 쓰던 것과 동일한 정규식을 그대로 옮겨 커버리지를 유지한다.
  --
  -- source 는 'known_product_line_term' 이다. 위 delete 가 이 값을 함께 지우므로
  -- 매 실행마다 재생성되어 멱등하다. 값을 바꾸려면 delete 목록도 같이 바꿔야 한다.
  with brand_patterns(series_name_ko, source_pattern) as (
    values
      ('닛코리노', 'にっこりーノ'),
      ('판다의 구멍', 'パンダの穴'),
      ('컵의 후치코', 'コップのフチ子|のフチ子'),
      ('포켓토미카', 'ポケットトミカ')
  ),
  brand_matches as (
    select distinct gp.id as product_id, bp.series_name_ko
    from public.gacha_products gp
    join brand_patterns bp
      on coalesce(gp.name_ja, gp.name, '') ~ bp.source_pattern
      or coalesce(gp.name, '') ~ bp.source_pattern
      or coalesce(gp.name_ko, '') ~ bp.series_name_ko
    where gp.status = 'active'
      and (p_product_ids is null or gp.id = any(p_product_ids))
  )
  insert into public.gacha_product_series (product_id, series_id, relation_type, confidence, source)
  select
    bm.product_id,
    s.id,
    'line',
    1,
    'known_product_line_term'
  from brand_matches bm
  join public.gacha_series s
    on s.name_ko_norm = public.gacha_normalize_search_text(bm.series_name_ko)
   and s.status = 'active'
  on conflict (product_id, series_id) do update
  set relation_type = excluded.relation_type,
      confidence = greatest(public.gacha_product_series.confidence, excluded.confidence),
      source = excluded.source,
      updated_at = now()
  where public.gacha_product_series.source in ('name_parts', 'known_product_line_term');
  get diagnostics v_brand_mappings_upserted = row_count;

  return jsonb_build_object(
    'series_upserted', v_series_upserted,
    'deleted_mappings', v_deleted_mappings,
    'mappings_upserted', v_mappings_upserted,
    'brand_mappings_upserted', v_brand_mappings_upserted
  );
end;
$function$;
comment on function public.refresh_gacha_product_series(uuid[]) is
  'Rebuilds gacha_series entities and gacha_product_series mappings from gacha_products.name_parts.series, plus a brand dictionary that links self-contained brands (닛코리노 etc) by product-name regex. NULL argument refreshes every active product. Follows gacha_series.merged_into_id so merged long-tail series stay merged.';

grant execute on function public.refresh_gacha_product_series(uuid[]) to authenticated;

-- 5) 양쪽 매핑 재생성. 카테고리가 먼저여야 archive 된 line 링크가 정리된다.
select public.refresh_gacha_product_categories();
select public.refresh_gacha_product_series();

-- 6) MV 갱신. concurrently 는 트랜잭션 안에서 못 돌아 일반 refresh 를 쓴다.
refresh materialized view public.gacha_category_browse;
refresh materialized view public.gacha_series_browse;

notify pgrst, 'reload schema';
