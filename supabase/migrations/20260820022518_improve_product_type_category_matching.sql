-- Restored from dev supabase_migrations.schema_migrations (version 20260820022518).
-- Originally applied to dev without a committed file; recovered 2026-08-22 as part of
-- the taxonomy DDL ownership move from gacha-collector to gacha-map.
--
-- Replaces refresh_gacha_product_categories() so that product_type matching goes through
-- gacha_category_aliases (with substring matching on aliases of length >= 2) instead of
-- exact name matching, and expands the known product-line pattern table.
--
-- NOTE: must run after 20260820022202_add_gacha_product_category_model.sql, which creates
-- the original version of this function.

create or replace function public.refresh_gacha_product_categories(p_product_ids uuid[] default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
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

  return jsonb_build_object(
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

select public.refresh_gacha_product_categories();

notify pgrst, 'reload schema';
