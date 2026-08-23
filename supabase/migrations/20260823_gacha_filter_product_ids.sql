-- Phase 5 (A) of docs/plans/20260821-gacha-taxonomy-restructure.md
--
-- Extracts the taxonomy filter predicate out of browse_gacha_products into a standalone
-- set-returning function so that browse AND search share exactly one implementation.
--
-- 기획서 §10 / §17-6은 "탐색과 검색이 같은 결과에 도달해야 한다"를 요구한다. 술어가 두 벌이면
-- 시간이 지나면서 반드시 갈라진다. Phase 5 (B)에서 search_gacha_products 가 이 함수를 부른다.
--
-- 축 의미 (spec §17-4):
--   카테고리 id 는 gacha_categories.category_type 으로 축을 나눈다.
--   한 축 안에서는 ANY 매칭 (OR), 축과 축 사이는 EVERY 매칭 (AND).
--   전부 AND 하거나 전부 OR 하면 틀린다.
--
-- 인자가 모두 NULL 이면 active 상품 전체를 돌려준다 (필터 없음 = 전체).

create or replace function public.gacha_filter_product_ids(
  p_category_ids        uuid[]  default null,
  p_series_ids          uuid[]  default null,
  p_include_descendants boolean default false
)
returns table (product_id uuid)
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
      -- 계층은 최대 2단이라 한 단계만 펼치면 충분하다 (트리거로 강제됨).
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
  )
  select gp.id
  from public.gacha_products gp
  where gp.status = 'active'
    and (
      p_category_ids is null
      -- 모든 축에 대해 "매칭이 없는 축이 존재하지 않는다" = 모든 축이 매칭됐다
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
    );
$function$;

comment on function public.gacha_filter_product_ids(uuid[], uuid[], boolean) is
  'Single source of truth for taxonomy filtering. Category ids are grouped by category_type: OR within an axis, AND across axes. browse_gacha_products and search_gacha_products must both go through this.';

-- browse_gacha_products 를 이 함수 위로 다시 얹는다. 반환 컬럼과 정렬은 그대로다.
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
  with matched as (
    select gp.*
    from public.gacha_products gp
    join public.gacha_filter_product_ids(
           p_category_ids, p_series_ids, p_include_descendants
         ) f on f.product_id = gp.id
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

grant execute on function public.gacha_filter_product_ids(uuid[], uuid[], boolean) to anon, authenticated;

notify pgrst, 'reload schema';
