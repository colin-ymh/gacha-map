-- Phase 2 of docs/plans/20260821-gacha-taxonomy-restructure.md
--
-- HISTORY NOTE: dev has TWO applied versions for this file --
--   refresh_gacha_product_series                    (first cut)
--   refresh_gacha_product_series_skip_split_titles  (fixes addition 3 below)
-- The first cut created a product-less series entity for every split collaboration title.
-- This file is the corrected final state and was verified to match the deployed function
-- exactly (191 normalized lines, md5 36497a2b...). Replay it once; do NOT re-apply to dev.
--
-- Extracts the one-shot series backfill from 20260814010814_add_gacha_series_alias_model.sql
-- into a callable, scopable, idempotent function so that newly collected products get their
-- series mapping without a manual migration.
--
-- Mirrors refresh_gacha_product_categories(uuid[]): same signature shape, same scoping
-- semantics (NULL = whole table), same jsonb count payload.
--
-- gacha-collector already calls this via scripts/lib/gacha-product-series.ts and tolerates
-- PGRST202 while it does not exist, so deploying this migration is what switches it on.
--
-- Behaviour preserved from the original backfill:
--   - series names are taken verbatim from gacha_products.name_parts.series.ko
--   - a title containing × is split into collaboration rows ONLY when every split part
--     already exists as a standalone series; otherwise the full title stays one primary
--     row (this is what keeps 헌터×헌터 intact)
--   - relation_type primary / collaboration is decided by that same rule
--
-- Two deliberate additions over the original backfill:
--   1. merged_into_id is followed when resolving the target series, so that the long-tail
--      merges done in Phase 3 are not resurrected by a later refresh. Dedup therefore
--      happens after resolution, on (product_id, series_id), which also prevents two
--      distinct names that merged into the same target from colliding inside one INSERT.
--   2. ON CONFLICT DO UPDATE is restricted to rows whose source is 'name_parts', matching
--      refresh_gacha_product_categories, so a future manually curated mapping is not
--      silently overwritten. No-op today (all 5,836 rows are source = 'name_parts').
--   3. Step 1 does NOT create a series entity for a title that step 2 is going to split.
--      Without this, a collaboration title such as 헬로키티×에반게리온 gets its own series
--      row while its products map to 헬로키티 and 에반게리온, leaving a permanently
--      product-less series behind and inflating the long-tail problem this plan is trying
--      to reduce. Split parts are never created by step 1 anyway — they only qualify as
--      split targets because they already exist as standalone series — so skipping the
--      full title is safe.
--
-- The parts / split_ready CTEs are intentionally duplicated in step 1 and step 2. They MUST
-- stay identical; a divergence would make step 1 skip a title that step 2 then fails to map.

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
  where ps.source = 'name_parts'
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

  return jsonb_build_object(
    'series_upserted', v_series_upserted,
    'deleted_mappings', v_deleted_mappings,
    'mappings_upserted', v_mappings_upserted
  );
end;
$function$;

comment on function public.refresh_gacha_product_series(uuid[]) is
  'Rebuilds gacha_series entities and gacha_product_series mappings from gacha_products.name_parts.series. NULL argument refreshes every active product. Follows gacha_series.merged_into_id so merged long-tail series stay merged.';

grant execute on function public.refresh_gacha_product_series(uuid[]) to authenticated;

notify pgrst, 'reload schema';
