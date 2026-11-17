-- Phase 4 (A) of docs/plans/20260821-gacha-taxonomy-restructure.md
--
-- Aggregate views backing the category / series browse screens
-- (Notion: 🗂️ 가챠 카테고리·시리즈 탐색 기획 §9).
--
-- Product counts and representative images must not be recomputed per request, so they live
-- in materialized views refreshed by the collector pipeline after each run.
--
-- Both views carry a UNIQUE index so that REFRESH MATERIALIZED VIEW CONCURRENTLY works.

-- ── 카테고리 집계 ────────────────────────────────────────────────────────────
create materialized view public.gacha_category_browse as
select
  c.id                                     as category_id,
  c.name_ko,
  c.name_ja,
  c.name_en,
  c.category_type,
  coalesce(c.display_order, 2147483647)    as display_order,
  count(distinct gp.id)                    as product_count,
  (
    select gp2.official_image_url
    from public.gacha_product_categories pc2
    join public.gacha_products gp2 on gp2.id = pc2.product_id
    where pc2.category_id = c.id
      and gp2.status = 'active'
      and gp2.official_image_url is not null
    order by gp2.release_start_date desc nulls last, gp2.id
    limit 1
  )                                        as representative_image_url
from public.gacha_categories c
left join public.gacha_product_categories pc on pc.category_id = c.id
left join public.gacha_products gp
       on gp.id = pc.product_id
      and gp.status = 'active'
where c.status = 'active'
group by c.id, c.name_ko, c.name_ja, c.name_en, c.category_type, c.display_order;

create unique index gacha_category_browse_pkey
  on public.gacha_category_browse (category_id);
create index gacha_category_browse_type_idx
  on public.gacha_category_browse (category_type, product_count desc);

comment on materialized view public.gacha_category_browse is
  'Per-category product counts and representative image for the browse UI. Refreshed by the collector pipeline.';

-- ── 시리즈 집계 ──────────────────────────────────────────────────────────────
-- 계층은 최대 2단(트리거로 강제)이므로 재귀 CTE가 필요 없다.
-- rollup_product_count = 자기 상품 + 직계 자식 상품 (중복 제거).
create materialized view public.gacha_series_browse as
with direct as (
  select
    s.id as series_id,
    count(distinct gp.id) as direct_product_count
  from public.gacha_series s
  left join public.gacha_product_series ps on ps.series_id = s.id
  left join public.gacha_products gp
         on gp.id = ps.product_id
        and gp.status = 'active'
  group by s.id
),
rollup as (
  select
    s.id as series_id,
    count(distinct gp.id) as rollup_product_count
  from public.gacha_series s
  left join public.gacha_series child
         on child.parent_id = s.id
        and child.status = 'active'
  left join public.gacha_product_series ps
         on ps.series_id = s.id
         or ps.series_id = child.id
  left join public.gacha_products gp
         on gp.id = ps.product_id
        and gp.status = 'active'
  group by s.id
),
kids as (
  select parent_id as series_id, count(*) as child_count
  from public.gacha_series
  where parent_id is not null
    and status = 'active'
  group by parent_id
)
select
  s.id                                        as series_id,
  s.name_ko,
  s.name_ja,
  s.name_en,
  s.kind,
  s.status,
  s.is_browsable,
  s.parent_id,
  case when s.parent_id is null then 0 else 1 end as depth,
  coalesce(d.direct_product_count, 0)         as direct_product_count,
  coalesce(r.rollup_product_count, 0)         as rollup_product_count,
  coalesce(k.child_count, 0)                  as child_count,
  (
    select gp2.official_image_url
    from public.gacha_product_series ps2
    join public.gacha_products gp2 on gp2.id = ps2.product_id
    where ps2.series_id = s.id
      and gp2.status = 'active'
      and gp2.official_image_url is not null
    order by gp2.release_start_date desc nulls last, gp2.id
    limit 1
  )                                           as representative_image_url
from public.gacha_series s
left join direct d on d.series_id = s.id
left join rollup r on r.series_id = s.id
left join kids   k on k.series_id = s.id;

create unique index gacha_series_browse_pkey
  on public.gacha_series_browse (series_id);
create index gacha_series_browse_listing_idx
  on public.gacha_series_browse (kind, rollup_product_count desc)
  where is_browsable and status = 'active' and parent_id is null;
create index gacha_series_browse_parent_idx
  on public.gacha_series_browse (parent_id)
  where parent_id is not null;

comment on materialized view public.gacha_series_browse is
  'Per-series product counts (direct and rolled up over depth-2 children), child count and representative image for the browse UI. Refreshed by the collector pipeline.';

-- ── 갱신 함수 ────────────────────────────────────────────────────────────────
-- collector 배치 종료 훅에서 호출한다. CONCURRENTLY 는 트랜잭션 블록 안에서 쓸 수 없으므로
-- 이 함수는 자동 커밋 컨텍스트에서 호출되어야 한다 (PostgREST RPC 호출이 그렇다).
create or replace function public.refresh_gacha_browse_views()
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  refresh materialized view concurrently public.gacha_category_browse;
  refresh materialized view concurrently public.gacha_series_browse;
end;
$function$;

comment on function public.refresh_gacha_browse_views() is
  'Refreshes the browse aggregate views. Call from the collector pipeline after taxonomy data changes.';

grant select on public.gacha_category_browse to anon, authenticated;
grant select on public.gacha_series_browse  to anon, authenticated;
grant execute on function public.refresh_gacha_browse_views() to authenticated;

notify pgrst, 'reload schema';
