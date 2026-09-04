-- toy_line 은 시리즈(IP) 축이 아니라 카테고리(line) 축의 개념이다 (2026-08-26).
--
-- 문제: 오네무탄/마치보케 같은 캡슐토이 제품 라인이 gacha_categories(category_type='line')
--       에 이미 정확히 붙어 있는데(오네무탄 90건, 마치보케 49건 등), gacha_series 에도
--       kind='toy_line' 로 중복 저장되어(220건, 상품 매핑 856건) 시리즈 탐색 목록에 뜬다.
--       콜라보 분리형(예: '오네무탄 귀멸의 칼날')은 진짜 IP 시리즈(귀멸의 칼날, 71건)에
--       매핑되지 않고 별도 시리즈로 떨어져 나가 시리즈 탐색에서 IP 커버리지가 샌다.
--       (예: '귀멸의 칼날' 시리즈로 들어가면 71건만 보이고 콜라보 13건이 빠진다.)
--
-- 이번 변경: browse_gacha_series() 에서 kind='toy_line' 을 무조건 제외한다.
--       line 카테고리 축은 그대로 유지되므로 오네무탄/마치보케는 카테고리 필터로 계속
--       찾을 수 있다. 콜라보 분리(라인+진짜IP 이중 매핑) 는 별도 후속 작업이다.
--
-- p_kind='toy_line' 을 명시적으로 요청해도 제외한다 — toy_line 은 더 이상 시리즈 탐색의
-- 유효한 축이 아니기 때문이다. 호출부(웹 API, 모바일 칩)도 이 커밋에서 함께 정리한다.

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
  child_count               bigint,
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
  join public.gacha_series s on s.id = b.series_id
  where b.status = 'active'
    and b.rollup_product_count >= 4
    and not s.is_hidden
    -- toy_line 은 카테고리(line 축) 개념이라 시리즈 탐색에서 항상 제외한다.
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

comment on function public.browse_gacha_series(text, uuid, integer, integer) is
  'Root-level browsable series for the browse UI. Visibility is derived from rollup_product_count >= 4, not a stored flag. kind=toy_line is always excluded (it is a category concept, not a series/IP concept). is_hidden excludes a series manually.';

notify pgrst, 'reload schema';
