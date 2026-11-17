-- Taxonomy v2: canonical IDs for discovery and search. No bulk reclassification.
-- Legacy payloads retain their existing path; only explicitly versioned payloads use v2.
BEGIN;

CREATE OR REPLACE FUNCTION public.get_gacha_taxonomy_dictionary()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  WITH RECURSIVE resolved AS (
    SELECT s.id AS original_id, s.id, s.merged_into_id, ARRAY[s.id] AS path
    FROM public.gacha_series s
    UNION ALL
    SELECT r.original_id, s.id, s.merged_into_id, r.path || s.id
    FROM resolved r JOIN public.gacha_series s ON s.id=r.merged_into_id
    WHERE NOT s.id=ANY(r.path) AND cardinality(r.path)<16
  ), targets AS (
    SELECT r.original_id, s.id FROM resolved r JOIN public.gacha_series s ON s.id=r.id
    WHERE r.merged_into_id IS NULL AND s.status='active' AND s.kind NOT IN ('unknown','toy_line')
  ), names AS (
    SELECT c.id, c.category_type AS axis, unnest(ARRAY[c.name_ko,c.name_ja,c.name_en]) AS term
    FROM public.gacha_categories c WHERE c.status='active' AND c.category_type IN ('line','product_type','subject','genre')
    UNION ALL
    SELECT c.id,c.category_type,a.alias FROM public.gacha_category_aliases a
    JOIN public.gacha_categories c ON c.id=a.category_id
    WHERE a.status='approved' AND c.status='active' AND c.category_type IN ('line','product_type','subject','genre')
    UNION ALL
    SELECT t.id,'series',unnest(ARRAY[s.name_ko,s.name_ja,s.name_en])
    FROM targets t JOIN public.gacha_series s ON s.id=t.original_id
    UNION ALL
    SELECT t.id,'series',a.alias FROM targets t JOIN public.gacha_series_aliases a ON a.series_id=t.original_id WHERE a.status='approved'
  ), terms AS (
    SELECT id,axis,array_agg(DISTINCT term ORDER BY term) AS terms FROM names
    WHERE nullif(btrim(term),'') IS NOT NULL GROUP BY id,axis
  ) SELECT jsonb_build_object('version',2,'terms',coalesce(jsonb_agg(to_jsonb(terms) ORDER BY axis,id),'[]'::jsonb)) FROM terms;
$$;
REVOKE ALL ON FUNCTION public.get_gacha_taxonomy_dictionary() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_gacha_taxonomy_dictionary() TO service_role;

CREATE OR REPLACE FUNCTION public.validate_gacha_taxonomy_v2(p_parts jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE t jsonb:=p_parts->'taxonomy'; item jsonb;
BEGIN
  IF t IS NULL THEN RETURN; END IF;
  IF jsonb_typeof(t) IS DISTINCT FROM 'object' OR t->>'version' IS DISTINCT FROM '2'
     OR jsonb_typeof(t->'series') IS DISTINCT FROM 'array'
     OR jsonb_typeof(t->'category_ids') IS DISTINCT FROM 'array'
     OR jsonb_typeof(t->'unresolved') IS DISTINCT FROM 'array'
     OR jsonb_typeof(t->'inputs') IS DISTINCT FROM 'object'
     OR jsonb_typeof(t->'inputs'->'series') IS DISTINCT FROM 'array'
     OR jsonb_typeof(t->'inputs'->'lines') IS DISTINCT FROM 'array'
     OR jsonb_typeof(t->'inputs'->'tags') IS DISTINCT FROM 'array'
     OR coalesce(t->>'dictionary_hash','') !~ '^[a-f0-9]{64}$'
  THEN RAISE EXCEPTION 'Malformed or unsupported taxonomy v2 payload'; END IF;
  IF NOT (t->'inputs' ? 'product_type') THEN RAISE EXCEPTION 'Missing taxonomy product_type input'; END IF;
  FOR item IN
    SELECT value FROM jsonb_array_elements(t->'inputs'->'series')
    UNION ALL SELECT value FROM jsonb_array_elements(t->'inputs'->'lines')
    UNION ALL SELECT t->'inputs'->'product_type' WHERE t->'inputs'->'product_type'<>'null'::jsonb
  LOOP
    IF jsonb_typeof(item) IS DISTINCT FROM 'object'
       OR coalesce(jsonb_typeof(item->'ja'),'missing') NOT IN ('string','null')
       OR coalesce(jsonb_typeof(item->'ko'),'missing') NOT IN ('string','null')
       OR nullif(btrim(concat_ws('',item->>'ja',item->>'ko')),'') IS NULL
    THEN RAISE EXCEPTION 'Malformed taxonomy name input'; END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(t->'inputs'->'series') x
       WHERE x->>'relation_type' IS NULL OR x->>'relation_type' NOT IN ('primary','collaboration'))
     OR EXISTS(SELECT 1 FROM jsonb_array_elements(t->'inputs'->'tags') x WHERE jsonb_typeof(x)<>'string')
  THEN RAISE EXCEPTION 'Malformed taxonomy relation or tag input'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(t->'series') LOOP
    IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR item->>'relation_type' IS NULL
       OR item->>'relation_type' NOT IN ('primary','collaboration')
       OR NOT EXISTS(SELECT 1 FROM public.gacha_series s WHERE s.id=(item->>'id')::uuid
         AND s.status='active' AND s.merged_into_id IS NULL AND s.kind NOT IN ('unknown','toy_line'))
    THEN RAISE EXCEPTION 'Invalid or stale taxonomy series ID'; END IF;
  END LOOP;
  FOR item IN SELECT value FROM jsonb_array_elements(t->'category_ids') LOOP
    IF jsonb_typeof(item) IS DISTINCT FROM 'string' OR NOT EXISTS(
      SELECT 1 FROM public.gacha_categories c WHERE c.id=(item#>>'{}')::uuid AND c.status='active'
      AND c.category_type IN ('line','product_type','subject','genre'))
    THEN RAISE EXCEPTION 'Invalid or stale taxonomy category ID'; END IF;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_gacha_taxonomy_v2(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.validate_gacha_taxonomy_v2(jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.validate_gacha_product_taxonomy_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  PERFORM public.validate_gacha_taxonomy_v2(NEW.name_parts);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_gacha_product_taxonomy_trigger() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER validate_gacha_product_taxonomy_v2 BEFORE INSERT OR UPDATE OF name_parts ON public.gacha_products
FOR EACH ROW EXECUTE FUNCTION public.validate_gacha_product_taxonomy_trigger();

CREATE OR REPLACE FUNCTION public.refresh_gacha_product_categories(p_product_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_v2_mappings_upserted integer := 0;
  v_vocab_categories_upserted integer := 0;
  v_line_categories_upserted integer := 0;
  v_category_aliases_upserted integer := 0;
  v_product_type_aliases_upserted integer := 0;
  v_product_type_categories_upserted integer := 0;
  v_deleted_mappings integer := 0;
  v_tag_mappings_upserted integer := 0;
  v_line_mappings_upserted integer := 0;
  v_product_type_mappings_upserted integer := 0;
begin
  -- Fail before deleting any mappings; errors roll back the whole refresh.
  perform public.validate_gacha_taxonomy_v2(gp.name_parts)
  from public.gacha_products gp where gp.status='active'
    and (p_product_ids is null or gp.id=any(p_product_ids));
  delete from public.gacha_product_categories pc
  where pc.source in ('name_parts', 'known_product_line_term')
    and (p_product_ids is null or pc.product_id = any(p_product_ids));
  get diagnostics v_deleted_mappings = row_count;

  with product_tags as (
    select distinct
      gp.id as product_id,
      nullif(btrim(tag.value), '') as name_ko
    from public.gacha_products gp
    cross join lateral jsonb_array_elements_text(
      case when jsonb_typeof(gp.name_parts -> 'tags') = 'array' then gp.name_parts -> 'tags' else '[]'::jsonb end
    ) as tag(value)
    where gp.status = 'active'
      and gp.name_parts->'taxonomy' is null
      and jsonb_typeof(gp.name_parts -> 'tags') = 'array'
      and (p_product_ids is null or gp.id = any(p_product_ids))
  )
  insert into public.gacha_product_categories (product_id, category_id, relation_type, confidence, source, note)
  select
    pt.product_id,
    c.id,
    'tag',
    0.9,
    'name_parts',
    'Backfilled from curated gacha_products.name_parts.tags'
  from product_tags pt
  join public.gacha_categories c
    on c.name_ko_norm = public.gacha_normalize_search_text(pt.name_ko)
   and c.category_type in ('genre', 'subject', 'origin')
   and c.status = 'active'
  where pt.name_ko is not null
  on conflict (product_id, category_id) do update
  set relation_type = excluded.relation_type,
      confidence = greatest(public.gacha_product_categories.confidence, excluded.confidence),
      source = excluded.source,
      note = excluded.note,
      updated_at = now()
  where public.gacha_product_categories.source = 'name_parts';
  get diagnostics v_tag_mappings_upserted = row_count;

  with line_patterns(category_name_ko, source_pattern) as (
    values
      ('코로코레', 'ころコレ'),
      ('닛코리노', 'にっこりーノ'),
      ('캡슐 플라레일', 'カプセルプラレール'),
      ('판다의 구멍', 'パンダの穴'),
      ('컵의 후치코', 'コップのフチ子|のフチ子'),
      ('푸티또', 'PUTITTO'),
      ('포켓토미카', 'ポケットトミカ'),
      ('ntc.Puff', 'ntc[.]Puff'),
      ('아기클럽', '赤ちゃん(倶|俱)楽部'),
      ('캡구루미', 'かぷぐるみ'),
      ('1/64PLUS', '1/64 ?PLUS'),
      ('캡슐 아니아', 'カプセルアニア'),
      ('컵 소코코', 'コップのソコ子'),
      ('워터돔팩토리', 'WaterDomeFactory'),
      ('딱 열리는 캐릭터 손목시계', 'ぱかっとひらく！?キャラうでどけい'),
      ('네코의 펜꽂이', 'ネコのペンおき'),
      ('욕실 수족관', 'お風呂で水族館'),
      ('캡슐토미카DX', 'カプセルトミカDX'),
      ('가챠 분의 일 시리즈', 'ガチャぶんのいち'),
      ('치루코토', 'ちるこっと'),
      ('케츠혼 반지', 'ケツ婚指輪'),
      ('냥코마트', 'にゃんこマート'),
      ('냥코 빵집', 'にゃんこパン屋さん'),
      ('냥코 키친DX', 'にゃんこキッチンDX'),
      ('귀여운 마스코트 라이트', 'かわいい！?マスコットライト'),
      ('메지루시', 'めじるし'),
      ('오네무탄', 'おねむたん|オネムタン'),
      ('마치보케', 'まちぼうけ|マチボウケ|待ちぼうけ'),
      ('카타즌', '肩ズン'),
      ('데포러버', 'でふぉラバ|デフォラバ'),
      ('피타 데포메', 'ぴた！?でふぉめ|ぴたでふぉめ|ピタ！?デフォメ|ピタデフォメ'),
      ('스와라세타이', 'すわらせ隊'),
      ('네무라세타이', 'ねむらせ隊'),
      ('나라분데스', 'ならぶんです'),
      ('츠만데 츠나게떼', 'つまんでつなげて'),
      ('반쵸코', 'キャラばんちょうこう|ばんちょうこう'),
      ('쵸코노코', 'ちょこのっこ|チョコノッコ'),
      ('허그콧', 'ハグコット|HUGCOT|Hugcot'),
      ('링코레', 'Ringcolle!?|リングコレクション'),
      ('생물대도감', 'いきもの大図鑑'),
      ('오쿠루미', 'おくるみますこっと|おくるみマスコット|おくるみ')
  ),
  product_line_matches as (
    select distinct gp.id as product_id, lp.category_name_ko
    from public.gacha_products gp
    join line_patterns lp
      on coalesce(gp.name_ja, gp.name, '') ~ lp.source_pattern
      or coalesce(gp.name, '') ~ lp.source_pattern
      or coalesce(gp.name_ko, '') ~ lp.category_name_ko
    where gp.status = 'active'
      and gp.name_parts->'taxonomy' is null
      and (p_product_ids is null or gp.id = any(p_product_ids))
  )
  insert into public.gacha_product_categories (product_id, category_id, relation_type, confidence, source, note)
  select
    plm.product_id,
    c.id,
    'line',
    1,
    'known_product_line_term',
    'Mapped from domestic gacha product line term in product source name'
  from product_line_matches plm
  join public.gacha_categories c
    on c.name_ko_norm = public.gacha_normalize_search_text(plm.category_name_ko)
   and c.category_type = 'line'
   and c.status = 'active'
  on conflict (product_id, category_id) do update
  set relation_type = excluded.relation_type,
      confidence = greatest(public.gacha_product_categories.confidence, excluded.confidence),
      source = excluded.source,
      note = excluded.note,
      updated_at = now()
  where public.gacha_product_categories.source = 'known_product_line_term';
  get diagnostics v_line_mappings_upserted = row_count;

  with product_types as (
    select distinct
      gp.id as product_id,
      nullif(btrim(gp.name_parts -> 'product_type' ->> 'ko'), '') as name_ko,
      nullif(btrim(gp.name_parts -> 'product_type' ->> 'ja'), '') as name_ja,
      public.gacha_normalize_search_text(nullif(btrim(gp.name_parts -> 'product_type' ->> 'ko'), '')) as name_ko_norm,
      public.gacha_normalize_search_text(nullif(btrim(gp.name_parts -> 'product_type' ->> 'ja'), '')) as name_ja_norm
    from public.gacha_products gp
    where gp.status = 'active'
      and gp.name_parts->'taxonomy' is null
      and (
        gp.name_parts -> 'product_type' ->> 'ko' is not null
        or gp.name_parts -> 'product_type' ->> 'ja' is not null
      )
      and (p_product_ids is null or gp.id = any(p_product_ids))
  ),
  product_type_matches as (
    select distinct pt.product_id, a.category_id
    from product_types pt
    join public.gacha_category_aliases a
      on a.status = 'approved'
     and (
       a.alias_norm in (pt.name_ko_norm, pt.name_ja_norm)
       or (
         char_length(a.alias_norm) >= 2
         and (
           position(a.alias_norm in coalesce(pt.name_ko_norm, '')) > 0
           or position(a.alias_norm in coalesce(pt.name_ja_norm, '')) > 0
         )
       )
     )
    join public.gacha_categories c
      on c.id = a.category_id
     and c.category_type = 'product_type'
     and c.status = 'active'
  )
  insert into public.gacha_product_categories (product_id, category_id, relation_type, confidence, source, note)
  select
    ptm.product_id,
    ptm.category_id,
    'product_type',
    0.95,
    'name_parts',
    'Mapped from curated product type alias in gacha_products.name_parts.product_type'
  from product_type_matches ptm
  on conflict (product_id, category_id) do update
  set relation_type = excluded.relation_type,
      confidence = greatest(public.gacha_product_categories.confidence, excluded.confidence),
      source = excluded.source,
      note = excluded.note,
      updated_at = now()
  where public.gacha_product_categories.source = 'name_parts';
  get diagnostics v_product_type_mappings_upserted = row_count;


  insert into public.gacha_product_categories(product_id,category_id,relation_type,confidence,source,note)
  select distinct gp.id,c.id,
    case when c.category_type in ('line','product_type') then c.category_type else 'tag' end,
    0.9,'name_parts','taxonomy v2 exact dictionary match; confidence is a rule weight, not a probability'
  from public.gacha_products gp
  cross join lateral jsonb_array_elements_text(gp.name_parts->'taxonomy'->'category_ids') ids(id)
  join public.gacha_categories c on c.id=ids.id::uuid and c.status='active'
  where gp.status='active' and gp.name_parts->'taxonomy'->>'version'='2'
    and (p_product_ids is null or gp.id=any(p_product_ids))
  on conflict(product_id,category_id) do nothing; -- manual/curated relations win
  get diagnostics v_v2_mappings_upserted = row_count;

  return jsonb_build_object(
    'v2_mappings_upserted', v_v2_mappings_upserted,
    'vocab_categories_upserted', v_vocab_categories_upserted,
    'line_categories_upserted', v_line_categories_upserted,
    'category_aliases_upserted', v_category_aliases_upserted,
    'product_type_aliases_upserted', v_product_type_aliases_upserted,
    'product_type_categories_upserted', v_product_type_categories_upserted,
    'deleted_mappings', v_deleted_mappings,
    'tag_mappings_upserted', v_tag_mappings_upserted,
    'line_mappings_upserted', v_line_mappings_upserted,
    'product_type_mappings_upserted', v_product_type_mappings_upserted
  );
end;
$function$;
REVOKE ALL ON FUNCTION public.refresh_gacha_product_categories(uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_gacha_product_categories(uuid[]) TO service_role;

CREATE OR REPLACE FUNCTION public.refresh_gacha_product_series(p_product_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_v2_mappings_upserted integer := 0;
  v_series_upserted integer := 0;
  v_deleted_mappings integer := 0;
  v_mappings_upserted integer := 0;
  v_brand_mappings_upserted integer := 0;
begin
  -- Fail before deleting any mappings; errors roll back the whole refresh.
  perform public.validate_gacha_taxonomy_v2(gp.name_parts)
  from public.gacha_products gp where gp.status='active'
    and (p_product_ids is null or gp.id=any(p_product_ids));
  if p_product_ids is not null and cardinality(p_product_ids) = 0 then
    return jsonb_build_object(
      'series_upserted', 0,
      'deleted_mappings', 0,
      'mappings_upserted', 0
    );
  end if;

  with raw_product_series as (
    select
      gp.id as product_id,
      nullif(btrim(gp.name_parts -> 'series' ->> 'ko'), '') as series_ko,
      nullif(btrim(gp.name_parts -> 'series' ->> 'ja'), '') as series_ja
    from public.gacha_products gp
    where gp.status = 'active'
      and gp.name_parts->'taxonomy' is null
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
      and gp.name_parts->'taxonomy' is null
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
  -- 같은 패턴이 두 타깃을 갖는 경우가 있다. ポケットトミカ 는 상위 브랜드 '토미카' 와
  -- 자기 자신 '포켓토미카' 양쪽에 연결한다 — 이용자가 둘 중 어느 이름으로 찾아도
  -- 나와야 한다. brand_resolved 가 (product_id, series_id) 로 중복을 없애 안전하다.
  --
  -- 패턴과 타깃을 분리하지 않으면 한국어 매칭이 폭주한다. 포켓토미카를 '토미카'
  -- 시리즈에 붙이려고 타깃 이름으로 name_ko 를 매칭하면 의도한 27건 대신
  -- '토미카'가 들어간 상품 51건이 걸린다.
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
      -- 제품 계열 → 상위 완구 브랜드
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
      and gp.name_parts->'taxonomy' is null
      and (p_product_ids is null or gp.id = any(p_product_ids))
  ),
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
  -- 기존 의미 관계(name_parts 의 primary/collaboration)를 덮지 않는다.
  where public.gacha_product_series.source = 'known_product_line_term';
  get diagnostics v_brand_mappings_upserted = row_count;

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


  insert into public.gacha_product_series(product_id,series_id,relation_type,confidence,source,note)
  select distinct on (gp.id,s.id) gp.id,s.id,item->>'relation_type',0.9,'name_parts',
    'taxonomy v2 exact dictionary match; confidence is a rule weight, not a probability'
  from public.gacha_products gp
  cross join lateral jsonb_array_elements(gp.name_parts->'taxonomy'->'series') item
  join public.gacha_series s on s.id=(item->>'id')::uuid and s.status='active'
  where gp.status='active' and gp.name_parts->'taxonomy'->>'version'='2'
    and (p_product_ids is null or gp.id=any(p_product_ids))
  order by gp.id,s.id,case item->>'relation_type' when 'primary' then 0 else 1 end
  on conflict(product_id,series_id) do nothing;
  get diagnostics v_v2_mappings_upserted = row_count;

  return jsonb_build_object(
    'v2_mappings_upserted', v_v2_mappings_upserted,
    'series_upserted', v_series_upserted,
    'deleted_mappings', v_deleted_mappings,
    'mappings_upserted', v_mappings_upserted,
    'brand_mappings_upserted', v_brand_mappings_upserted
  );
end;
$function$;
REVOKE ALL ON FUNCTION public.refresh_gacha_product_series(uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_gacha_product_series(uuid[]) TO service_role;

-- Atomic ingestion: a failed refresh cannot leave new extraction and old mappings.
CREATE OR REPLACE FUNCTION public.save_gacha_product_name_parts_v2(
  p_product_id uuid, p_name_parts jsonb, p_expected_name_parts jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE current_parts jsonb; categories_result jsonb; series_result jsonb;
BEGIN
  SELECT name_parts INTO current_parts FROM public.gacha_products WHERE id=p_product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product not found'; END IF;
  IF current_parts IS DISTINCT FROM p_expected_name_parts THEN RAISE EXCEPTION 'Product name_parts changed; reload before retry'; END IF;
  IF p_name_parts->'taxonomy'->>'version' IS DISTINCT FROM '2' THEN RAISE EXCEPTION 'Expected taxonomy v2'; END IF;
  PERFORM public.validate_gacha_taxonomy_v2(p_name_parts);
  UPDATE public.gacha_products SET name_parts=p_name_parts WHERE id=p_product_id;
  categories_result:=public.refresh_gacha_product_categories(ARRAY[p_product_id]);
  series_result:=public.refresh_gacha_product_series(ARRAY[p_product_id]);
  PERFORM public.refresh_gacha_product_search_docs(ARRAY[p_product_id]);
  RETURN jsonb_build_object('product_id',p_product_id,'categories',categories_result,'series',series_result);
END;
$$;
REVOKE ALL ON FUNCTION public.save_gacha_product_name_parts_v2(uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_gacha_product_name_parts_v2(uuid,jsonb,jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
