-- 자동 수집만으로 브라우징 목록이 최신 상태가 되도록 만드는 변경 (2026-08-25).
--
-- 문제: is_browsable 은 NOT NULL DEFAULT false 라서, 자동 수집으로 새 시리즈가 생기면
--       상품이 아무리 쌓여도 누가 산정 배치를 돌리기 전까지 영원히 화면에 나오지 않는다.
--       수집만 돌리면 브라우징 목록이 319개에서 고정된다.
--
-- 관찰: is_browsable 은 사실 완전히 파생 가능한 값이었다. 2026-08-25 dev 실측에서
--       is_browsable = true 인 319건과 rollup_product_count >= 4 인 319건이 정확히 일치했고
--       편차가 0이었다. 수동 오버라이드로 쓰이는 곳도 없었다.
--
-- 변경:
--   1. browse_gacha_series() 가 저장된 is_browsable 대신 rollup_product_count 임계값을
--      직접 본다. gacha_series_browse 는 이미 collector 배치 종료 훅에서
--      refresh_gacha_browse_views() 로 갱신되므로, 새 시리즈가 임계값을 넘는 순간
--      별도 배치 없이 목록에 나타난다.
--   2. 수동으로 감춰야 할 시리즈를 위해 is_hidden 을 새로 둔다. 품질이 나쁜 시리즈를
--      임계값과 무관하게 제외하는 용도이며, 기본값은 노출(false)이다.
--
-- is_browsable 컬럼은 남겨두되 더 이상 읽지 않는다. collector 는 산정 배치를 멈춰도 된다.
-- 데이터가 안정된 뒤 별도 마이그레이션으로 제거를 판단한다.
--
-- 임계값 4의 근거 (2026-08-25, 루트 시리즈 기준 칩별 분포):
--   other 95 / 애니메이션 65 / 캐릭터 37 / 프랜차이즈 36 / 제품 라인 32 / 게임 23
--   4가 모든 칩이 쓸 만한 크기를 유지하는 최대 임계값이다. 5로 가면 게임이 17까지 떨어진다.
--   바꾸려면 이 파일의 상수를 고치는 마이그레이션을 새로 만든다. 호출자가 정하지 않는다.

alter table public.gacha_series
  add column is_hidden boolean not null default false;

comment on column public.gacha_series.is_hidden is
  'Manual exclusion from browse listings, independent of the product-count threshold. Default false (visible).';

comment on column public.gacha_series.is_browsable is
  'DEPRECATED 2026-08-25. browse_gacha_series() no longer reads this; visibility is derived from gacha_series_browse.rollup_product_count. Use is_hidden to exclude a series manually.';

create index gacha_series_hidden_idx
  on public.gacha_series (id)
  where is_hidden;

-- MV 인덱스도 is_browsable 조건을 뺀다.
drop index if exists public.gacha_series_browse_listing_idx;
create index gacha_series_browse_listing_idx
  on public.gacha_series_browse (kind, rollup_product_count desc)
  where status = 'active' and parent_id is null;

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
  join public.gacha_series s on s.id = b.series_id
  where b.status = 'active'
    -- 저장된 플래그가 아니라 집계에서 직접 판정한다. 수집 후 MV 갱신만으로 최신이 된다.
    and b.rollup_product_count >= 4
    and not s.is_hidden
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
  'Root-level browsable series for the browse UI. Visibility is derived from rollup_product_count >= 4, not a stored flag, so newly collected series appear as soon as gacha_series_browse is refreshed. is_hidden excludes a series manually.';

notify pgrst, 'reload schema';
