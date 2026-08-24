-- Fix for a defect found while verifying Phase 3 (2026-08-25).
--
-- 증상: 활성 상품 3건이 archived 시리즈에만 매핑되어 시리즈 탐색에서 완전히 사라졌다.
--
-- 원인: 병합 체인.
--   산리오 하피단부이 -> 산리오 해피단부이 -> 해피단부이
--
--   20260822_gacha_series_browse_columns.sql 의 트리거는 merged_into_id 를 설정할 때
--   "내 타깃이 이미 병합됐는가"(아래쪽)만 검사한다. "나를 가리키는 것이 있는가"(위쪽)는
--   보지 않는다. 그래서 아래 순서면 체인이 생긴다.
--     1) A -> B   (B는 미병합이므로 통과)
--     2) B -> C   (C는 미병합이므로 통과)  ← 이 순간 A -> B -> C 체인 성립
--
--   refresh_gacha_product_series() 는 coalesce(s.merged_into_id, s.id) 로 한 홉만
--   따라가므로, A 의 상품이 archived 인 B 에 매핑된 채 남는다.
--
-- 처리:
--   1. 기존 체인을 최종 타깃으로 평탄화한다 (A -> C).
--   2. AFTER 트리거로 앞으로도 자동 평탄화한다. B 를 C 로 병합하는 순간
--      B 를 가리키던 것들을 C 로 옮긴다. 거부하지 않고 고쳐주는 쪽을 택했다 —
--      배치 순서에 따라 정상적인 작업이 막히면 안 되기 때문이다.
--   3. 평탄화 후 refresh_gacha_product_series() 를 돌려 끊긴 매핑을 복구한다.
--
-- 이렇게 하면 refresh 의 한 홉 해석이 항상 충분해진다.

-- ── 1. 기존 체인 평탄화 ──────────────────────────────────────────────────────
with recursive walk as (
  select s.id, s.merged_into_id as target, 1 as depth
  from public.gacha_series s
  where s.merged_into_id is not null
  union all
  select w.id, t.merged_into_id, w.depth + 1
  from walk w
  join public.gacha_series t on t.id = w.target
  where t.merged_into_id is not null
    and w.depth < 10
),
final as (
  select distinct on (id) id, target
  from walk
  order by id, depth desc
)
update public.gacha_series s
   set merged_into_id = f.target,
       updated_at = now()
  from final f
 where s.id = f.id
   and s.merged_into_id is distinct from f.target;

-- ── 2. 앞으로 생기는 체인 자동 평탄화 ────────────────────────────────────────
create or replace function public.gacha_series_flatten_merge_chain()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
begin
  -- new 가 다른 시리즈로 병합됐다면, new 를 가리키던 것들을 최종 타깃으로 옮긴다.
  if new.merged_into_id is not null then
    update public.gacha_series s
       set merged_into_id = new.merged_into_id,
           updated_at = now()
     where s.merged_into_id = new.id
       and s.id <> new.merged_into_id;
  end if;
  return null;
end;
$function$;

create trigger gacha_series_flatten_merge_chain_trg
  after update of merged_into_id on public.gacha_series
  for each row
  when (new.merged_into_id is not null)
  execute function public.gacha_series_flatten_merge_chain();

comment on function public.gacha_series_flatten_merge_chain() is
  'Keeps merged_into_id one hop deep. When B is merged into C, anything pointing at B is re-pointed to C, so refresh_gacha_product_series() never resolves onto an archived series.';

-- ── 3. 끊긴 매핑 복구 ────────────────────────────────────────────────────────
select public.refresh_gacha_product_series();

notify pgrst, 'reload schema';
