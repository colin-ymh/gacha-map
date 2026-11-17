-- 브랜드 성격인 것을 line 축에서 전부 빼고 series 로 통일한다.
--
-- 축 정의(docs/plans/20260907-taxonomy-axis-redefinition.md)에서 series 를
-- "IP + 완구 브랜드"로 넓혔으므로, 브랜드는 series 한 곳에만 있어야 한다.
-- 같은 대상이 두 축에 나뉘어 보이면 이용자가 어디서 찾아야 할지 알 수 없다.
--
-- 앞선 20260907_toy_brand_series_links 는 "상위 브랜드 연결을 더하되 계열은 남긴다"
-- 였다. 포켓토미카/캡슐토미카DX 구분을 지키려는 의도였으나, 실제 화면에서 같은
-- 브랜드가 두 축에 흩어져 보이는 혼란이 더 컸다. 구분보다 일관성을 택한다.
--
-- ── 1차: 완구 브랜드 계열 6건 ──────────────────────────────────────────────
--   판다의 구멍(78)   → series 복구. 독립 상품을 포괄하는 가챠 브랜드다
--   포켓토미카(21)    → series 복구
--   컵 소코코(7)      → line 만 archive. series 는 이미 active 였다(중복 상태)
--   캡슐 플라레일(107) · 캡슐토미카DX(6) · 캡슐 아니아(8)
--                     → line archive. 상품은 이미 플라레일/토미카/아니아 series 에
--                       연결돼 있어 잃는 링크가 없다
--
-- ── 2차: 자체 상품군 5건 ──────────────────────────────────────────────────
--   냥코마트(6) · 냥코 키친DX(6) · 냥코 빵집(4)
--     자체 고양이 캐릭터로 자기 완결한다. 외부 IP 가 붙지 않고 상품명이
--     "にゃんこマート5" 처럼 회차만 는다. 셋을 하나로 병합하지는 않는다
--   1/64PLUS(25)
--     1:64 축척 미니카 상품군. 실차 이름만 바뀐다(日産キューブ, スズキ ラパン).
--     축척은 형태지만 '1/64PLUS' 는 제조사가 붙인 상품군 이름이다
--   가챠 분의 일 시리즈(5)
--     피규어와 함께 두는 소품 상품군. 외부 IP 없음
--
-- 전부 "IP 위에 씌우는 형태"가 아니라 "자기 이름으로 전개하는 상품군"이라
-- series 가 맞다. line 축에는 형태만 남긴다 — 결과 25건.
--
-- ⚠️ series 를 active 로 바꾸는 것만으로는 링크가 따라오지 않는다.
--    name_parts.series 기반 링크는 상품명 정규식보다 커버리지가 좁아
--    판다의 구멍 78→60, 포켓토미카 21→18 로 18건이 빠졌다. 그래서 브랜드 사전에도
--    같은 정규식을 넣는다(아래 3단계).
--
-- 롤백
--   update public.gacha_categories set status='active'
--   where category_type='line' and name_ko in
--     ('캡슐 플라레일','포켓토미카','캡슐토미카DX','캡슐 아니아','컵 소코코',
--      '판다의 구멍','냥코마트','냥코 키친DX','냥코 빵집','1/64PLUS','가챠 분의 일 시리즈');
--   update public.gacha_series set status='archived', kind='toy_line'
--   where name_ko in ('판다의 구멍','포켓토미카','냥코마트','냥코 키친DX','냥코 빵집',
--                     '1/64PLUS','가챠 분의 일 시리즈');
--   -- 그리고 브랜드 사전을 20260907_toy_brand_series_links 정의로 복원 후 refresh 재실행

-- ── 1) archived series 를 되살린다 ─────────────────────────────────────────
--    브랜드 사전이 status='active' 를 조인하므로 사전 교체보다 먼저다.

update public.gacha_series
set status = 'active',
    kind = case name_ko when '포켓토미카' then 'franchise' else 'character_brand' end,
    is_hidden = false,
    updated_at = now()
where name_ko in ('판다의 구멍', '포켓토미카')
  and status = 'archived';

update public.gacha_series
set status = 'active',
    kind = 'character_brand',
    is_hidden = false,
    updated_at = now()
where name_ko in ('냥코마트', '냥코 키친DX', '냥코 빵집')
  and status = 'archived';

update public.gacha_series
set status = 'active',
    kind = 'franchise',
    is_hidden = false,
    updated_at = now()
where name_ko in ('1/64PLUS', '가챠 분의 일 시리즈')
  and status = 'archived';

-- ── 2) line 카테고리 11건 archive ──────────────────────────────────────────
--    refresh_gacha_product_categories() 의 line 삽입이 c.status='active' 를
--    조인하므로 archive 만으로 링크 생성 경로가 끊긴다. 같은 함수가 line
--    카테고리를 upsert 하지 않는 것도 확인했다 — archive 는 refresh 후에도 유지된다.

update public.gacha_categories
set status = 'archived',
    updated_at = now()
where category_type = 'line'
  and name_ko in ('캡슐 플라레일', '포켓토미카', '캡슐토미카DX', '캡슐 아니아',
                  '컵 소코코', '판다의 구멍',
                  '냥코마트', '냥코 키친DX', '냥코 빵집',
                  '1/64PLUS', '가챠 분의 일 시리즈');

-- ── 3) 브랜드 사전 확장 ────────────────────────────────────────────────────
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
      ('にっこりーノ',            '닛코리노',            '닛코리노'),
      ('コップのフチ子|のフチ子', '컵의 후치코',         '컵의 후치코'),
      ('コップのソコ子',          '컵 소코코',           '컵 소코코'),
      ('パンダの穴',              '판다의 구멍',         '판다의 구멍'),
      ('にゃんこマート',          '냥코마트',            '냥코마트'),
      ('にゃんこキッチンDX',      '냥코 키친DX',         '냥코 키친DX'),
      ('にゃんこパン屋さん',      '냥코 빵집',           '냥코 빵집'),
      ('1/64 ?PLUS',              '1/64PLUS',            '1/64PLUS'),
      ('ガチャぶんのいち',        '가챠 분의 일 시리즈', '가챠 분의 일 시리즈'),
      -- 제품 계열 → 상위 완구 브랜드.
      -- ポケットトミカ 는 타깃이 둘이다 — 상위 '토미카' 와 자기 자신 '포켓토미카'.
      -- 이용자가 어느 이름으로 찾아도 나와야 한다. brand_resolved 가
      -- (product_id, series_id) 로 중복을 없애 안전하다.
      ('カプセルプラレール',      '캡슐 플라레일',       '플라레일'),
      ('ポケットトミカ',          '포켓토미카',          '토미카'),
      ('ポケットトミカ',          '포켓토미카',          '포켓토미카'),
      ('カプセルトミカDX',        '캡슐토미카DX',        '토미카'),
      ('カプセルアニア',          '캡슐 아니아',         '아니아')
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
    from (values ('닛코리노'), ('컵의 후치코'), ('컵 소코코'), ('판다의 구멍'),
                 ('냥코마트'), ('냥코 키친DX'), ('냥코 빵집'),
                 ('1/64PLUS'), ('가챠 분의 일 시리즈'),
                 ('플라레일'), ('토미카'), ('포켓토미카'), ('아니아')) as t(target_ko)
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
  'Rebuilds gacha_series entities and gacha_product_series mappings from gacha_products.name_parts.series, plus a brand dictionary that links brands and toy-brand product lines by product-name regex. Dictionary separates match pattern from target series name; one pattern may have multiple targets.';

grant execute on function public.refresh_gacha_product_series(uuid[]) to authenticated;

-- ── 4) 재생성 + MV 갱신 ────────────────────────────────────────────────────
select public.refresh_gacha_product_categories();
select public.refresh_gacha_product_series();

refresh materialized view public.gacha_category_browse;
refresh materialized view public.gacha_series_browse;

notify pgrst, 'reload schema';
