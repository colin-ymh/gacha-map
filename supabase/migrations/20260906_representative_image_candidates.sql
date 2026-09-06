-- 대표 이미지 선정 개선 — 플레이스홀더 배제 + 공유도 정렬 + 후보 배열
--
-- 이 파일은 dev 에 아래 3건으로 나눠 적용된 것을 하나로 합친 것이다.
--   20260906220026 representative_image_candidates
--   20260906220051 series_browse_image_candidates
--   20260906220122 browse_rpcs_image_candidates
-- 내용은 적용문과 동일하다.
--
-- 왜 필요했나
--   바로가기 카드에서 메지루시가 항목째 사라졌다. 원인은 우연한 충돌이 아니라
--   이미지 한 장이 상품 50개에 붙어 있었던 것이다. 그 이미지가 산리오와 메지루시
--   양쪽의 "가장 최신 상품"이라 둘이 같은 썸네일을 물었고, 클라이언트의 이미지
--   중복 제거가 뒤에 온 메지루시를 버렸다.
--
--   추가로 플레이스홀더·UI 에셋이 상품 이미지로 수집돼 있었다.
--     판다의 구멍 자유로운 여신 → /common/images/noimage_main.png
--     미마모리 필터            → /common/2020/images/btn_search_sp.svg (검색 버튼 아이콘)
--
-- 3겹으로 푼다
--   ① 배제 — gacha_image_is_usable() 로 쓰레기 URL 을 후보에서 뺀다
--   ② 정렬 — share_count 오름차순으로 범용 이미지를 뒤로 민다
--   ③ 후보 배열 — 상위 3장을 돌려 클라이언트가 충돌 시 폴백할 수 있게 한다
--
--   ②만으로 메지루시 문제는 해결된다(실측: MONYO FRIENDS 이미지로 교체됨).
--   ③은 그래도 남는 충돌에 대한 2차 방어선이다.
--
-- MV 는 컬럼 추가에 drop/recreate 가 필요하고 그때 인덱스·권한이 사라지므로
-- 재생성 직후 다시 만든다. 무중단은 아니며 짧은 ACCESS EXCLUSIVE 잠금이 있다.
--
-- 적용 후 두 MV 를 refresh 해야 값이 채워진다.

-- ── 1) 배제 규칙 ────────────────────────────────────────────────────────────
-- 두 MV 가 같은 규칙을 써야 하므로 함수로 뺀다. 복붙하면 반드시 갈라진다.
-- 목표는 "깨진 이미지 0"이 아니라 "명백한 쓰레기를 대표로 뽑지 않기"다.
-- HTTP 검증은 배치가 필요해 범위 밖이다.
--
-- dev 실측(2026-09-06): active 상품 10,100건 중 2건만 배제된다.
create or replace function public.gacha_image_is_usable(p_url text)
returns boolean
language sql
immutable
set search_path to 'public', 'pg_temp'
as $function$
  select p_url is not null
     and btrim(p_url) <> ''
     and p_url !~* 'noimage|no[-_]image|nowprinting|now[-_]printing'
     and p_url !~* 'coming[-_ ]?soon|placeholder|dummy|準備中'
     and p_url !~* '\.svg($|\?)'
     and p_url !~* '/common/.*(btn|icon|logo)_';
$function$;

comment on function public.gacha_image_is_usable(text) is
  'True when the URL looks like a real product photo. Filters placeholder images and site UI assets scraped by mistake. Used by the browse materialized views to pick representative images.';

-- ── 2) 카테고리 MV ──────────────────────────────────────────────────────────
drop materialized view if exists public.gacha_category_browse;

create materialized view public.gacha_category_browse as
with img_share as (
  select official_image_url, count(*) as share_count
  from public.gacha_products
  where status = 'active'
    and public.gacha_image_is_usable(official_image_url)
  group by official_image_url
)
select
  c.id                                     as category_id,
  c.name_ko,
  c.name_ja,
  c.name_en,
  c.category_type,
  coalesce(c.display_order, 2147483647)    as display_order,
  count(distinct gp.id)                    as product_count,
  (
    select array_agg(u.url order by u.rn)
    from (
      select distinct on (gp2.official_image_url)
             gp2.official_image_url as url,
             row_number() over (
               order by isr.share_count asc,
                        gp2.release_start_date desc nulls last,
                        gp2.id
             ) as rn
      from public.gacha_product_categories pc2
      join public.gacha_products gp2 on gp2.id = pc2.product_id
      join img_share isr on isr.official_image_url = gp2.official_image_url
      where pc2.category_id = c.id
        and gp2.status = 'active'
        and public.gacha_image_is_usable(gp2.official_image_url)
      order by gp2.official_image_url, isr.share_count asc,
               gp2.release_start_date desc nulls last, gp2.id
    ) u
    where u.rn <= 3
  )                                        as representative_image_urls,
  (
    select gp2.official_image_url
    from public.gacha_product_categories pc2
    join public.gacha_products gp2 on gp2.id = pc2.product_id
    join img_share isr on isr.official_image_url = gp2.official_image_url
    where pc2.category_id = c.id
      and gp2.status = 'active'
      and public.gacha_image_is_usable(gp2.official_image_url)
    order by isr.share_count asc, gp2.release_start_date desc nulls last, gp2.id
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
  'Per-category product counts and representative image candidates for the browse UI. Refreshed by the collector pipeline.';

-- ── 3) 시리즈 MV ────────────────────────────────────────────────────────────
drop materialized view if exists public.gacha_series_browse;

create materialized view public.gacha_series_browse as
with img_share as (
  select official_image_url, count(*) as share_count
  from public.gacha_products
  where status = 'active'
    and public.gacha_image_is_usable(official_image_url)
  group by official_image_url
),
direct as (
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
    select array_agg(u.url order by u.rn)
    from (
      select distinct on (gp2.official_image_url)
             gp2.official_image_url as url,
             row_number() over (
               order by isr.share_count asc,
                        gp2.release_start_date desc nulls last,
                        gp2.id
             ) as rn
      from public.gacha_product_series ps2
      join public.gacha_products gp2 on gp2.id = ps2.product_id
      join img_share isr on isr.official_image_url = gp2.official_image_url
      where ps2.series_id = s.id
        and gp2.status = 'active'
        and public.gacha_image_is_usable(gp2.official_image_url)
      order by gp2.official_image_url, isr.share_count asc,
               gp2.release_start_date desc nulls last, gp2.id
    ) u
    where u.rn <= 3
  )                                           as representative_image_urls,
  (
    select gp2.official_image_url
    from public.gacha_product_series ps2
    join public.gacha_products gp2 on gp2.id = ps2.product_id
    join img_share isr on isr.official_image_url = gp2.official_image_url
    where ps2.series_id = s.id
      and gp2.status = 'active'
      and public.gacha_image_is_usable(gp2.official_image_url)
    order by isr.share_count asc, gp2.release_start_date desc nulls last, gp2.id
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
  'Per-series product counts, hierarchy metadata, and representative image candidates for the browse UI. Refreshed by the collector pipeline.';

-- ── 4) RPC 재생성 ───────────────────────────────────────────────────────────
-- 반환 컬럼이 늘어 drop 후 재생성한다. 인자 시그니처는 그대로 두고,
-- STABLE / SECURITY DEFINER / search_path / GRANT / 필터 조건을 현행 정의 그대로 복원한다.
drop function if exists public.browse_gacha_categories(text);

create function public.browse_gacha_categories(p_category_type text default null)
returns table (
  category_id uuid,
  name_ko text,
  name_ja text,
  name_en text,
  category_type text,
  product_count bigint,
  representative_image_url text,
  representative_image_urls text[]
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select
    b.category_id, b.name_ko, b.name_ja, b.name_en, b.category_type,
    b.product_count, b.representative_image_url, b.representative_image_urls
  from public.gacha_category_browse b
  where (p_category_type is null or b.category_type = p_category_type)
    and b.product_count > 0
  order by b.product_count desc, b.display_order asc, b.name_ko asc, b.category_id asc;
$function$;

grant execute on function public.browse_gacha_categories(text) to anon, authenticated;

drop function if exists public.browse_gacha_series(text, uuid, integer, integer);

create function public.browse_gacha_series(
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
  representative_image_urls text[],
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
    b.representative_image_urls,
    count(*) over ()::bigint as total_count
  from public.gacha_series_browse b
  join public.gacha_series s on s.id = b.series_id
  where b.status = 'active'
    and b.rollup_product_count >= 4
    and not s.is_hidden
    and b.kind <> 'toy_line'
    and (
      case when p_parent_id is null
           then b.parent_id is null
           else b.parent_id = p_parent_id
      end
    )
    and (p_kind is null or b.kind = p_kind)
  order by b.rollup_product_count desc, b.name_ko asc, b.series_id asc
  limit greatest(coalesce(p_limit, 20), 0)
  offset greatest(coalesce(p_offset, 0), 0);
$function$;

grant execute on function public.browse_gacha_series(text, uuid, integer, integer) to anon, authenticated;

notify pgrst, 'reload schema';
