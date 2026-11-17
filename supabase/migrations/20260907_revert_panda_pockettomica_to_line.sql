-- 판다의 구멍·포켓토미카를 line 카테고리로 되돌린다.
--
-- 20260906_brand_lines_to_series 가 4건을 시리즈로 옮겼는데, codex 검증 결과
-- 2건이 오분류였다.
--
--   판다의 구멍 — 여러 독립 상품을 포괄하는 가챠 브랜드다. 캐릭터 IP 가 아니다.
--                 (ミニチュアスナイパー / ヤドカリ物件 / もちばけ / PET HOOD 처럼
--                  서로 무관한 상품군이 한 레이블 아래 있다)
--   포켓토미카 — 토미카의 제품 계열이다. IP 는 상위 토미카다. 제조사도
--                캡슐토미카와 크기·패키지 차이로 구분한다.
--
-- 닛코리노·컵의 후치코는 시리즈로 유지한다. 둘 다 특정 캐릭터 정체성이 있다.
--
-- ⚠️ 당시 판정 근거였던 "상품명 IP 포함률"은 폐기한다.
--    그 지표는 형태를 잰 게 아니라 "현재 IP 사전과 문자열 규칙으로 검출되는
--    비율"을 쟀다. line 34건 전수로 재보니 100 → 0 까지 연속 분포라 경계가 없다.
--    푸티또(34.2%)가 반례다 — 제조사가 스스로 "피규어 브랜드"라 부르면서 컵
--    가장자리에 거는 형식을 공유한다. 브랜드와 형태는 반대 개념이 아니다.
--    메지루시(38.9%)도 형태가 약한 게 아니라 검출 누락이다.
--
-- 이건 축 재정의 전의 임시 복구다. line 축에 IP·제품계열·형태 세 개념이 섞여
-- 있는 것이 근본 원인이며, 재정의 계획은
-- docs/plans/20260907-taxonomy-axis-redefinition.md 로 따로 세운다.

-- 1) 시리즈에서 내린다
update public.gacha_series
set status = 'archived',
    kind = 'toy_line',
    updated_at = now()
where name_ko in ('판다의 구멍', '포켓토미카')
  and status = 'active';

-- 2) line 카테고리를 되살린다.
--    20260904 사전에 패턴이 그대로 남아 있어 refresh 가 링크를 다시 만든다.
update public.gacha_categories
set status = 'active',
    updated_at = now()
where category_type = 'line'
  and name_ko in ('판다의 구멍', '포켓토미카');

-- 3) 시리즈 브랜드 사전에서 2건 제거
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


  -- 브랜드 사전 — 캐릭터 정체성이 확인된 것만 남긴다.
  -- 판다의 구멍(가챠 브랜드)·포켓토미카(토미카 제품 계열)는 2026-09-07 제거했다.
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
      ('컵의 후치코', 'コップのフチ子|のフチ子')
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
select public.refresh_gacha_product_categories();
select public.refresh_gacha_product_series();

refresh materialized view public.gacha_category_browse;
refresh materialized view public.gacha_series_browse;

notify pgrst, 'reload schema';
