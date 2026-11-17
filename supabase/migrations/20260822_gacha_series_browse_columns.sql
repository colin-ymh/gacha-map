-- Phase 1 of docs/plans/20260821-gacha-taxonomy-restructure.md
--
-- Adds hierarchy / merge-tracking / browse-visibility columns to gacha_series so that
-- category- and series-based browsing UI can be built on top of the taxonomy.
--
-- ADDITIVE ONLY. No existing column, constraint, or CHECK domain is modified:
--   - gacha_series.kind keeps its existing 8-value domain
--     (anime / manga / game / character_brand / toy_line / franchise / other / unknown)
--   - gacha_series.status keeps active / hidden / archived; no 'merged' value is added
--   - gacha_product_series.relation_type is NOT touched (primary / collaboration carry meaning)

alter table public.gacha_series
  add column parent_id uuid references public.gacha_series (id) on delete set null,
  add column merged_into_id uuid references public.gacha_series (id) on delete set null,
  add column is_browsable boolean not null default false,
  add column kind_source text,
  add column kind_confidence real;

comment on column public.gacha_series.parent_id is
  'Parent series for IP rollup (e.g. 헬로키티 -> 산리오 캐릭터즈). Max depth 2, enforced by trigger.';
comment on column public.gacha_series.merged_into_id is
  'Set when this series was merged into another during long-tail cleanup. Requires status = archived. Never hard-delete a merged series.';
comment on column public.gacha_series.is_browsable is
  'Whether this series appears in browse UI listings. Derived from rollup product count; recomputed by an idempotent batch.';
comment on column public.gacha_series.kind_source is
  'Provenance of the kind value, e.g. llm_batch_20260825 / manual.';
comment on column public.gacha_series.kind_confidence is
  'Classifier confidence for kind, 0..1. Below 0.7 the kind must stay unknown.';

alter table public.gacha_series
  add constraint gacha_series_parent_not_self
    check (parent_id is null or parent_id <> id),
  add constraint gacha_series_merged_not_self
    check (merged_into_id is null or merged_into_id <> id),
  add constraint gacha_series_kind_confidence_range
    check (kind_confidence is null or (kind_confidence >= 0 and kind_confidence <= 1)),
  add constraint gacha_series_merged_requires_archived
    check (merged_into_id is null or status = 'archived');

create index gacha_series_parent_id_idx
  on public.gacha_series (parent_id)
  where parent_id is not null;

create index gacha_series_merged_into_id_idx
  on public.gacha_series (merged_into_id)
  where merged_into_id is not null;

create index gacha_series_browsable_idx
  on public.gacha_series (kind, id)
  where is_browsable;

-- Depth and merge-chain integrity.
--
-- CHECK constraints cannot express these because they need to look at other rows:
--   1. parent_id must point at a root series (parent of a parent is not allowed) -> max depth 2
--   2. a series that already has children cannot itself become a child
--   3. merged_into_id must point at a series that is not itself merged (no merge chains)
--
-- NOTE: this is not immune to two concurrent transactions each creating one level.
-- The table is written by serialized batch jobs, so that is accepted; the verification
-- query below detects any violation after a batch run.
create or replace function public.gacha_series_validate_hierarchy()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
declare
  v_parent_parent uuid;
  v_has_children boolean;
  v_target_merged uuid;
  v_found boolean;
begin
  if new.parent_id is not null then
    select s.parent_id, true
      into v_parent_parent, v_found
    from public.gacha_series s
    where s.id = new.parent_id;

    if not coalesce(v_found, false) then
      raise exception 'gacha_series.parent_id % does not exist', new.parent_id
        using errcode = 'foreign_key_violation';
    end if;

    if v_parent_parent is not null then
      raise exception
        'gacha_series depth limit (2) exceeded: parent % is itself a child of %',
        new.parent_id, v_parent_parent
        using errcode = 'check_violation';
    end if;

    select exists (
      select 1 from public.gacha_series c where c.parent_id = new.id
    ) into v_has_children;

    if v_has_children then
      raise exception
        'gacha_series depth limit (2) exceeded: % already has children and cannot become a child',
        new.id
        using errcode = 'check_violation';
    end if;
  end if;

  if new.merged_into_id is not null then
    select s.merged_into_id
      into v_target_merged
    from public.gacha_series s
    where s.id = new.merged_into_id;

    if v_target_merged is not null then
      raise exception
        'gacha_series merge chain not allowed: target % is itself merged into %',
        new.merged_into_id, v_target_merged
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

create trigger gacha_series_validate_hierarchy_trg
  before insert or update of parent_id, merged_into_id on public.gacha_series
  for each row
  execute function public.gacha_series_validate_hierarchy();

notify pgrst, 'reload schema';
