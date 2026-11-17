-- Phase 4 (B) of docs/plans/20260821-gacha-taxonomy-restructure.md
--
-- Browse RPCs for the category / series exploration screens
-- (Notion: 🗂️ 가챠 카테고리·시리즈 탐색 기획 §9, §17-6).
--
-- Design note: the two list_gacha_products_by_* RPCs are THIN WRAPPERS over a single core
-- (browse_gacha_products). The spec §17-6 requires browse and search to stay consistent, so
-- filtering / sorting / pagination must live in exactly one place. When Phase 5 adds
-- p_category_ids / p_series_ids to search_gacha_products, it must call into this same core
-- rather than growing a second copy of the predicate.
--
-- Axis semantics (spec §17-4), the part that is easy to get wrong:
--   category ids are grouped by gacha_categories.category_type;
--   WITHIN one axis the product must match ANY id  (OR)
--   ACROSS axes the product must match EVERY axis  (AND)
-- Neither "all AND" nor "all OR" is correct.

-- ── 카테고리 목록 ────────────────────────────────────────────────────────────
create or replace function public.browse_gacha_categories(
  p_category_type text default null
)
returns table (
  category_id              uuid,
  name_ko                  text,
  name_ja                  text,
  name_en                  text,
  category_type            text,
  product_count            bigint,
  representative_image_url text
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select
    b.category_id, b.name_ko, b.name_ja, b.name_en, b.category_type,
    b.product_count, b.representative_image_url
  from public.gacha_category_browse b
  where (p_category_type is null or b.category_type = p_category_type)
    and b.product_count > 0
  order by b.product_count desc, b.display_order asc, b.name_ko asc, b.category_id asc;
$function$;

-- ── 시리즈 목록 ──────────────────────────────────────────────────────────────
-- p_parent_id 가 NULL 이면 루트 시리즈만 (목록 화면), 값이 있으면 그 자식만 (상세의 하위 칩).
create or replace function public.browse_gacha_series(
  p_kind      text    default null,
  p_parent_id uuid    default null,
  p_limit     integer default 20,
  p_offset    integer default 0
)
returns table (
  series_id                uuid,
  name_ko                  text,
  name_ja                  text,
  name_en                  text,
  kind                     text,
  parent_id                uuid,
  depth                    integer,
  direct_product_count     bigint,
  rollup_product_count     bigint,
  child_count              bigint,
  representative_image_url text,
  total_count              bigint
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select
    b.series_id, b.name_ko, b.name_ja, b.name_en, b.kind, b.parent_id, b.depth,
    b.direct_product_count, b.rollup_product_count, b.child_count,
    b.representative_image_url,
    count(*) over ()::bigint as total_count
  from public.gacha_series_browse b
  where b.status = 'active'
    and b.is_browsable
    and b.rollup_product_count > 0
    and (
      case when p_parent_id is null
           then b.parent_id is null
           else b.parent_id = p_parent_id
      end
    )
    -- kind 미지정이면 전체(unknown 포함). 지정하면 unknown 은 빠진다. (spec §6-3)
    and (p_kind is null or b.kind = p_kind)
  order by b.rollup_product_count desc, b.name_ko asc, b.series_id asc
  limit greatest(coalesce(p_limit, 20), 0)
  offset greatest(coalesce(p_offset, 0), 0);
$function$;

-- ── 상품 목록 코어 ───────────────────────────────────────────────────────────
create or replace function public.browse_gacha_products(
  p_category_ids        uuid[]  default null,
  p_series_ids          uuid[]  default null,
  p_include_descendants boolean default false,
  p_sort                text    default 'popular',
  p_limit               integer default 20,
  p_offset              integer default 0
)
returns table (
  id                   uuid,
  name                 text,
  name_ko              text,
  name_ja              text,
  manufacturer         text,
  price_jpy            integer,
  official_image_url   text,
  release_start_date   date,
  available_shop_count integer,
  min_price_krw        integer,
  total_count          bigint
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  with series_expanded as (
    select distinct t.sid
    from (
      select unnest(p_series_ids) as sid
      union all
      select ch.id
      from public.gacha_series ch
      where coalesce(p_include_descendants, false)
        and p_series_ids is not null
        and ch.parent_id = any(p_series_ids)
        and ch.status = 'active'
    ) t
    where p_series_ids is not null
  ),
  wanted_cat as (
    select c.id, c.category_type
    from public.gacha_categories c
    where p_category_ids is not null
      and c.id = any(p_category_ids)
      and c.status = 'active'
  ),
  cat_axes as (
    select distinct w.category_type from wanted_cat w
  ),
  matched as (
    select gp.*
    from public.gacha_products gp
    where gp.status = 'active'
      and (
        p_category_ids is null
        or not exists (
          select 1
          from cat_axes a
          where not exists (
            select 1
            from public.gacha_product_categories pc
            join wanted_cat w
              on w.id = pc.category_id
             and w.category_type = a.category_type
            where pc.product_id = gp.id
          )
        )
      )
      and (
        p_series_ids is null
        or exists (
          select 1
          from public.gacha_product_series ps
          join series_expanded se on se.sid = ps.series_id
          where ps.product_id = gp.id
        )
      )
  ),
  agg as (
    select
      m.id,
      count(distinct sgp.shop_id) filter (
        where sgp.availability_status = 'available' and sh.status = 'active'
      )::integer as available_shop_count,
      min(sgp.price_krw) filter (
        where sgp.availability_status = 'available' and sh.status = 'active'
      )::integer as min_price_krw
    from matched m
    left join public.shop_gacha_products sgp on sgp.gacha_product_id = m.id
    left join public.shops sh on sh.id = sgp.shop_id
    group by m.id
  )
  select
    m.id, m.name, m.name_ko, m.name_ja, m.manufacturer, m.price_jpy,
    m.official_image_url, m.release_start_date,
    coalesce(a.available_shop_count, 0) as available_shop_count,
    a.min_price_krw,
    count(*) over ()::bigint as total_count
  from matched m
  join agg a on a.id = m.id
  order by
    case when coalesce(p_sort, 'popular') = 'popular'
         then coalesce(a.available_shop_count, 0) end desc nulls last,
    case when p_sort = 'recent'  then m.release_start_date end desc nulls last,
    case when p_sort = 'name'    then coalesce(m.name_ko, m.name) end asc nulls last,
    case when coalesce(p_sort, 'popular') = 'popular'
         then m.release_start_date end desc nulls last,
    coalesce(m.name_ko, m.name) asc nulls last,
    m.id asc
  limit greatest(coalesce(p_limit, 20), 0)
  offset greatest(coalesce(p_offset, 0), 0);
$function$;

-- ── 얇은 래퍼 ────────────────────────────────────────────────────────────────
-- 진입 축(p_category_id / p_series_id)은 다른 필터와 동일하게 코어에 넘어간다.
-- 진입 축은 해제 불가라는 규칙은 UI가 지킨다 (spec §17-4).
create or replace function public.list_gacha_products_by_category(
  p_category_id         uuid,
  p_filter_category_ids uuid[]  default null,
  p_filter_series_ids   uuid[]  default null,
  p_sort                text    default 'popular',
  p_limit               integer default 20,
  p_offset              integer default 0
)
returns table (
  id                   uuid,
  name                 text,
  name_ko              text,
  name_ja              text,
  manufacturer         text,
  price_jpy            integer,
  official_image_url   text,
  release_start_date   date,
  available_shop_count integer,
  min_price_krw        integer,
  total_count          bigint
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select *
  from public.browse_gacha_products(
    array_remove(
      array_cat(array[p_category_id], coalesce(p_filter_category_ids, '{}'::uuid[])),
      null
    ),
    p_filter_series_ids,
    false,
    p_sort,
    p_limit,
    p_offset
  );
$function$;

create or replace function public.list_gacha_products_by_series(
  p_series_id           uuid,
  p_include_descendants boolean default true,
  p_filter_category_ids uuid[]  default null,
  p_sort                text    default 'popular',
  p_limit               integer default 20,
  p_offset              integer default 0
)
returns table (
  id                   uuid,
  name                 text,
  name_ko              text,
  name_ja              text,
  manufacturer         text,
  price_jpy            integer,
  official_image_url   text,
  release_start_date   date,
  available_shop_count integer,
  min_price_krw        integer,
  total_count          bigint
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select *
  from public.browse_gacha_products(
    p_filter_category_ids,
    array[p_series_id],
    p_include_descendants,
    p_sort,
    p_limit,
    p_offset
  );
$function$;

comment on function public.browse_gacha_products(uuid[], uuid[], boolean, text, integer, integer) is
  'Core browse/filter/sort/paginate for gacha products. Category ids are grouped by category_type: OR within an axis, AND across axes. Phase 5 search filters must reuse this, not reimplement it.';

grant execute on function public.browse_gacha_categories(text) to anon, authenticated;
grant execute on function public.browse_gacha_series(text, uuid, integer, integer) to anon, authenticated;
grant execute on function public.browse_gacha_products(uuid[], uuid[], boolean, text, integer, integer) to anon, authenticated;
grant execute on function public.list_gacha_products_by_category(uuid, uuid[], uuid[], text, integer, integer) to anon, authenticated;
grant execute on function public.list_gacha_products_by_series(uuid, boolean, uuid[], text, integer, integer) to anon, authenticated;

notify pgrst, 'reload schema';
