-- Restored from dev supabase_migrations.schema_migrations (version 20260820022247).
-- Originally applied to dev without a committed file; recovered 2026-08-22 as part of
-- the taxonomy DDL ownership move from gacha-collector to gacha-map.
--
-- Seeds the Japanese source-query alias for the "피타 데포메" product line so that
-- collector line-term matching picks it up.

insert into public.gacha_category_aliases (
  category_id,
  alias,
  alias_type,
  locale,
  status,
  source,
  note
)
select
  c.id,
  'ぴたでふぉめ',
  'source_query',
  'ja',
  'approved',
  'known_product_line_term',
  'Seeded from domestic gacha product line terms: pita_defome'
from public.gacha_categories c
where c.name_ko = '피타 데포메'
  and c.category_type = 'line'
on conflict (category_id, alias_norm) do update
set
  alias_type = excluded.alias_type,
  locale = excluded.locale,
  status = excluded.status,
  source = excluded.source,
  note = excluded.note,
  updated_at = now();

select public.refresh_gacha_product_categories();

notify pgrst, 'reload schema';
