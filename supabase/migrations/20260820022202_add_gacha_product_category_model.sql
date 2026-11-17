-- Moved from gacha-collector on 2026-08-22 (taxonomy DDL ownership returned to gacha-map).
--
-- HISTORY NOTE: this file is a CONSOLIDATED SNAPSHOT, not a verbatim record of what
-- dev version 20260820022202 applied. It was edited in place in the collector repo after
-- being applied, so it already folds in the two follow-up versions:
--   20260820022247_fix_pita_defome_category_alias
--   20260820022518_improve_product_type_category_matching
-- Those two are kept as separate files (restored from dev) for version parity; on a fresh
-- replay they are idempotent no-ops. Replaying this file produces the correct final state.
-- Do NOT re-apply to dev.
--
-- Normalize gacha product categories separately from product name_parts.
--
-- Shape:
--   gacha_categories          = canonical category/filter terms
--   gacha_product_categories  = product-to-category mapping; products can have N categories
--   gacha_category_aliases    = category-to-search-term mapping; categories can have N aliases
--
-- Backfill source:
--   - curated tags from gacha_products.name_parts.tags
--   - curated product type aliases from gacha_products.name_parts.product_type
--   - known domestic gacha line terms from product source names
--
-- Free-form IP/character tags are intentionally not promoted to categories;
-- those belong to gacha_series / gacha_product_series.

BEGIN;

CREATE TABLE IF NOT EXISTS public.gacha_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ko text NOT NULL,
  name_ja text,
  name_en text,
  name_ko_norm text GENERATED ALWAYS AS (public.gacha_normalize_search_text(name_ko)) STORED,
  name_ja_norm text GENERATED ALWAYS AS (public.gacha_normalize_search_text(name_ja)) STORED,
  name_en_norm text GENERATED ALWAYS AS (public.gacha_normalize_search_text(name_en)) STORED,
  category_type text NOT NULL DEFAULT 'other',
  display_order integer,
  status text NOT NULL DEFAULT 'active',
  source text NOT NULL DEFAULT 'manual',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gacha_categories_name_ko_not_blank CHECK (btrim(name_ko) <> ''),
  CONSTRAINT gacha_categories_name_ko_norm_not_blank CHECK (name_ko_norm <> ''),
  CONSTRAINT gacha_categories_category_type_check CHECK (
    category_type IN ('genre', 'subject', 'origin', 'product_type', 'line', 'theme', 'other')
  ),
  CONSTRAINT gacha_categories_status_check CHECK (
    status IN ('active', 'hidden', 'archived')
  ),
  CONSTRAINT gacha_categories_source_check CHECK (
    source IN ('name_parts', 'manual', 'collector_llm', 'known_product_line_term', 'user_log')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS gacha_categories_name_ko_norm_key
  ON public.gacha_categories (name_ko_norm);

CREATE INDEX IF NOT EXISTS gacha_categories_type_status_idx
  ON public.gacha_categories (category_type, status);

CREATE INDEX IF NOT EXISTS gacha_categories_name_ja_norm_idx
  ON public.gacha_categories (name_ja_norm)
  WHERE name_ja_norm <> '';

CREATE TABLE IF NOT EXISTS public.gacha_category_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.gacha_categories(id) ON DELETE CASCADE,
  alias text NOT NULL,
  alias_norm text GENERATED ALWAYS AS (public.gacha_normalize_search_text(alias)) STORED,
  alias_type text NOT NULL DEFAULT 'nickname',
  locale text,
  status text NOT NULL DEFAULT 'approved',
  source text NOT NULL DEFAULT 'manual',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gacha_category_aliases_alias_not_blank CHECK (btrim(alias) <> ''),
  CONSTRAINT gacha_category_aliases_alias_norm_not_blank CHECK (alias_norm <> ''),
  CONSTRAINT gacha_category_aliases_alias_type_check CHECK (
    alias_type IN ('canonical', 'nickname', 'translation', 'source_query', 'typo')
  ),
  CONSTRAINT gacha_category_aliases_locale_check CHECK (
    locale IS NULL OR locale IN ('ko', 'ja', 'en')
  ),
  CONSTRAINT gacha_category_aliases_status_check CHECK (
    status IN ('pending', 'approved', 'rejected')
  ),
  CONSTRAINT gacha_category_aliases_source_check CHECK (
    source IN ('manual', 'collector_llm', 'known_product_line_term', 'user_log')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS gacha_category_aliases_category_alias_norm_key
  ON public.gacha_category_aliases (category_id, alias_norm);

CREATE INDEX IF NOT EXISTS gacha_category_aliases_alias_status_idx
  ON public.gacha_category_aliases (alias_norm, status);

CREATE INDEX IF NOT EXISTS gacha_category_aliases_category_status_idx
  ON public.gacha_category_aliases (category_id, status);

CREATE TABLE IF NOT EXISTS public.gacha_product_categories (
  product_id uuid NOT NULL REFERENCES public.gacha_products(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.gacha_categories(id) ON DELETE CASCADE,
  relation_type text NOT NULL DEFAULT 'tag',
  confidence real NOT NULL DEFAULT 1,
  source text NOT NULL DEFAULT 'name_parts',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, category_id),
  CONSTRAINT gacha_product_categories_relation_type_check CHECK (
    relation_type IN ('tag', 'product_type', 'line', 'manual', 'collector_llm', 'unknown')
  ),
  CONSTRAINT gacha_product_categories_confidence_check CHECK (
    confidence >= 0 AND confidence <= 1
  ),
  CONSTRAINT gacha_product_categories_source_check CHECK (
    source IN ('name_parts', 'manual', 'collector_llm', 'known_product_line_term', 'user_log')
  )
);

CREATE INDEX IF NOT EXISTS gacha_product_categories_category_id_idx
  ON public.gacha_product_categories (category_id);

CREATE INDEX IF NOT EXISTS gacha_product_categories_product_id_idx
  ON public.gacha_product_categories (product_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'update_updated_at'
      AND pg_function_is_visible(oid)
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgname = 'gacha_categories_updated_at'
        AND tgrelid = 'public.gacha_categories'::regclass
    ) THEN
      CREATE TRIGGER gacha_categories_updated_at
        BEFORE UPDATE ON public.gacha_categories
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at();
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgname = 'gacha_category_aliases_updated_at'
        AND tgrelid = 'public.gacha_category_aliases'::regclass
    ) THEN
      CREATE TRIGGER gacha_category_aliases_updated_at
        BEFORE UPDATE ON public.gacha_category_aliases
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at();
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgname = 'gacha_product_categories_updated_at'
        AND tgrelid = 'public.gacha_product_categories'::regclass
    ) THEN
      CREATE TRIGGER gacha_product_categories_updated_at
        BEFORE UPDATE ON public.gacha_product_categories
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at();
    END IF;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.refresh_gacha_product_categories(
  p_product_ids uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_vocab_categories_upserted integer := 0;
  v_line_categories_upserted integer := 0;
  v_category_aliases_upserted integer := 0;
  v_product_type_aliases_upserted integer := 0;
  v_product_type_categories_upserted integer := 0;
  v_deleted_mappings integer := 0;
  v_tag_mappings_upserted integer := 0;
  v_line_mappings_upserted integer := 0;
  v_product_type_mappings_upserted integer := 0;
BEGIN
  WITH vocabulary(category_type, name_ko, display_order) AS (
    VALUES
      ('genre', '애니메이션', 100),
      ('genre', '만화', 110),
      ('genre', '게임', 120),
      ('genre', '영화', 130),
      ('genre', '드라마', 140),
      ('genre', 'K-POP', 150),
      ('genre', '아이돌', 160),
      ('genre', '음악', 170),
      ('genre', '스포츠', 180),
      ('genre', '버추얼 유튜버', 190),
      ('genre', '특촬', 200),
      ('genre', '유아동', 210),
      ('subject', '동물', 300),
      ('subject', '고양이', 310),
      ('subject', '강아지', 320),
      ('subject', '토끼', 330),
      ('subject', '새', 340),
      ('subject', '물고기', 350),
      ('subject', '곤충', 360),
      ('subject', '공룡', 370),
      ('subject', '음식', 380),
      ('subject', '빵', 390),
      ('subject', '과자', 400),
      ('subject', '자동차', 410),
      ('subject', '열차', 420),
      ('subject', '비행기', 430),
      ('subject', '자연', 440),
      ('subject', '우주', 450),
      ('subject', '패션', 460),
      ('subject', '마법', 470),
      ('subject', '로봇', 480),
      ('subject', '괴물', 490),
      ('subject', '역사', 500),
      ('origin', '일본', 700),
      ('origin', '한국', 710),
      ('origin', '미국', 720),
      ('origin', '디즈니', 730),
      ('origin', '마블', 740),
      ('origin', 'DC', 750)
  ),
  deduped_vocabulary AS (
    SELECT DISTINCT ON (public.gacha_normalize_search_text(name_ko))
      category_type,
      name_ko,
      display_order
    FROM vocabulary
    ORDER BY
      public.gacha_normalize_search_text(name_ko),
      display_order,
      category_type
  )
  INSERT INTO public.gacha_categories (
    name_ko,
    category_type,
    display_order,
    status,
    source,
    note
  )
  SELECT
    name_ko,
    category_type,
    display_order,
    'active',
    'manual',
    'Seeded from collector tag vocabulary'
  FROM deduped_vocabulary
  ON CONFLICT (name_ko_norm) DO UPDATE
  SET
    category_type = public.gacha_categories.category_type,
    display_order = coalesce(public.gacha_categories.display_order, excluded.display_order),
    updated_at = now();

  GET DIAGNOSTICS v_vocab_categories_upserted = ROW_COUNT;

  WITH line_terms(key, name_ko, display_order) AS (
    VALUES
      ('korokore', '코로코레', 1000),
      ('mejirushi', '메지루시', 1010),
      ('onemutan', '오네무탄', 1020),
      ('machiboke', '마치보케', 1030),
      ('katazun', '카타즌', 1040),
      ('deforaba', '데포러버', 1050),
      ('pita_defome', '피타 데포메', 1060),
      ('suwarasetai', '스와라세타이', 1070),
      ('nemurasetai', '네무라세타이', 1080),
      ('narabundesu', '나라분데스', 1090),
      ('tsumande_tsunagete', '츠만데 츠나게떼', 1100),
      ('banchoko', '반쵸코', 1110),
      ('chokonokko', '쵸코노코', 1120),
      ('hugcot', '허그콧', 1130),
      ('ringcolle', '링코레', 1140),
      ('ikimono_daizukan', '생물대도감', 1150),
      ('okurumi', '오쿠루미', 1160)
  )
  INSERT INTO public.gacha_categories (
    name_ko,
    category_type,
    display_order,
    status,
    source,
    note
  )
  SELECT
    name_ko,
    'line',
    display_order,
    'active',
    'known_product_line_term',
    'Seeded from domestic gacha product line terms: ' || key
  FROM line_terms
  ON CONFLICT (name_ko_norm) DO UPDATE
  SET
    category_type = CASE
      WHEN public.gacha_categories.source = 'known_product_line_term' THEN excluded.category_type
      ELSE public.gacha_categories.category_type
    END,
    display_order = coalesce(public.gacha_categories.display_order, excluded.display_order),
    updated_at = now();

  GET DIAGNOSTICS v_line_categories_upserted = ROW_COUNT;

  WITH line_aliases(category_name_ko, alias, alias_type, locale, source_key) AS (
    VALUES
      ('코로코레', '코로코레', 'canonical', 'ko', 'korokore'),
      ('코로코레', 'ころコレ', 'source_query', 'ja', 'korokore'),
      ('메지루시', '메지루시', 'canonical', 'ko', 'mejirushi'),
      ('메지루시', 'めじるし', 'source_query', 'ja', 'mejirushi'),
      ('오네무탄', '오네무탄', 'canonical', 'ko', 'onemutan'),
      ('오네무탄', 'おねむたん', 'source_query', 'ja', 'onemutan'),
      ('오네무탄', 'オネムタン', 'source_query', 'ja', 'onemutan'),
      ('마치보케', '마치보케', 'canonical', 'ko', 'machiboke'),
      ('마치보케', '언제오려나', 'nickname', 'ko', 'machiboke'),
      ('마치보케', 'まちぼうけ', 'source_query', 'ja', 'machiboke'),
      ('마치보케', 'マチボウケ', 'source_query', 'ja', 'machiboke'),
      ('마치보케', '待ちぼうけ', 'source_query', 'ja', 'machiboke'),
      ('카타즌', '카타즌', 'canonical', 'ko', 'katazun'),
      ('카타즌', '어깨쿵', 'nickname', 'ko', 'katazun'),
      ('카타즌', '어깨큥', 'nickname', 'ko', 'katazun'),
      ('카타즌', '肩ズン', 'source_query', 'ja', 'katazun'),
      ('데포러버', '데포러버', 'canonical', 'ko', 'deforaba'),
      ('데포러버', '데포라바', 'nickname', 'ko', 'deforaba'),
      ('데포러버', 'でふぉラバ', 'source_query', 'ja', 'deforaba'),
      ('데포러버', 'デフォラバ', 'source_query', 'ja', 'deforaba'),
      ('피타 데포메', '피타 데포메', 'canonical', 'ko', 'pita_defome'),
      ('피타 데포메', '피타데포메', 'nickname', 'ko', 'pita_defome'),
      ('피타 데포메', 'ぴた！でふぉめ', 'source_query', 'ja', 'pita_defome'),
      ('피타 데포메', 'ぴたでふぉめ', 'source_query', 'ja', 'pita_defome'),
      ('피타 데포메', 'ピタデフォメ', 'source_query', 'ja', 'pita_defome'),
      ('스와라세타이', '스와라세타이', 'canonical', 'ko', 'suwarasetai'),
      ('스와라세타이', 'すわらせ隊', 'source_query', 'ja', 'suwarasetai'),
      ('네무라세타이', '네무라세타이', 'canonical', 'ko', 'nemurasetai'),
      ('네무라세타이', 'ねむらせ隊', 'source_query', 'ja', 'nemurasetai'),
      ('나라분데스', '나라분데스', 'canonical', 'ko', 'narabundesu'),
      ('나라분데스', '나란히', 'nickname', 'ko', 'narabundesu'),
      ('나라분데스', 'ならぶんです', 'source_query', 'ja', 'narabundesu'),
      ('츠만데 츠나게떼', '츠만데 츠나게떼', 'canonical', 'ko', 'tsumande_tsunagete'),
      ('츠만데 츠나게떼', 'つまんでつなげて', 'source_query', 'ja', 'tsumande_tsunagete'),
      ('반쵸코', '반쵸코', 'canonical', 'ko', 'banchoko'),
      ('반쵸코', '반초코', 'nickname', 'ko', 'banchoko'),
      ('반쵸코', 'キャラばんちょうこう', 'source_query', 'ja', 'banchoko'),
      ('반쵸코', 'ばんちょうこう', 'source_query', 'ja', 'banchoko'),
      ('쵸코노코', '쵸코노코', 'canonical', 'ko', 'chokonokko'),
      ('쵸코노코', '초코노코', 'nickname', 'ko', 'chokonokko'),
      ('쵸코노코', 'ちょこのっこ', 'source_query', 'ja', 'chokonokko'),
      ('쵸코노코', 'チョコノッコ', 'source_query', 'ja', 'chokonokko'),
      ('허그콧', '허그콧', 'canonical', 'ko', 'hugcot'),
      ('허그콧', '허그코트', 'nickname', 'ko', 'hugcot'),
      ('허그콧', 'ハグコット', 'source_query', 'ja', 'hugcot'),
      ('허그콧', 'HUGCOT', 'source_query', 'en', 'hugcot'),
      ('허그콧', 'Hugcot', 'source_query', 'en', 'hugcot'),
      ('링코레', '링코레', 'canonical', 'ko', 'ringcolle'),
      ('링코레', '링콜레', 'nickname', 'ko', 'ringcolle'),
      ('링코레', 'Ringcolle', 'source_query', 'en', 'ringcolle'),
      ('링코레', 'リングコレクション', 'source_query', 'ja', 'ringcolle'),
      ('생물대도감', '생물대도감', 'canonical', 'ko', 'ikimono_daizukan'),
      ('생물대도감', 'いきもの大図鑑', 'source_query', 'ja', 'ikimono_daizukan'),
      ('오쿠루미', '오쿠루미', 'canonical', 'ko', 'okurumi'),
      ('오쿠루미', '속싸개', 'nickname', 'ko', 'okurumi'),
      ('오쿠루미', 'おくるみますこっと', 'source_query', 'ja', 'okurumi'),
      ('오쿠루미', 'おくるみマスコット', 'source_query', 'ja', 'okurumi'),
      ('오쿠루미', 'おくるみ', 'source_query', 'ja', 'okurumi')
  ),
  deduped_line_aliases AS (
    SELECT DISTINCT ON (
      public.gacha_normalize_search_text(category_name_ko),
      public.gacha_normalize_search_text(alias)
    )
      category_name_ko,
      alias,
      alias_type,
      locale,
      source_key
    FROM line_aliases
    ORDER BY
      public.gacha_normalize_search_text(category_name_ko),
      public.gacha_normalize_search_text(alias),
      CASE alias_type
        WHEN 'canonical' THEN 0
        WHEN 'nickname' THEN 1
        WHEN 'translation' THEN 2
        WHEN 'source_query' THEN 3
        ELSE 4
      END,
      alias
  )
  INSERT INTO public.gacha_category_aliases (
    category_id,
    alias,
    alias_type,
    locale,
    status,
    source,
    note
  )
  SELECT
    c.id,
    la.alias,
    la.alias_type,
    la.locale,
    'approved',
    'known_product_line_term',
    'Seeded from domestic gacha product line terms: ' || la.source_key
  FROM deduped_line_aliases la
  JOIN public.gacha_categories c
    ON c.name_ko_norm = public.gacha_normalize_search_text(la.category_name_ko)
  ON CONFLICT (category_id, alias_norm) DO UPDATE
  SET
    alias_type = excluded.alias_type,
    locale = excluded.locale,
    status = excluded.status,
    source = excluded.source,
    note = excluded.note,
    updated_at = now();

  GET DIAGNOSTICS v_category_aliases_upserted = ROW_COUNT;

  WITH product_type_terms(key, name_ko, display_order) AS (
    VALUES
      ('figure', '피규어', 2000),
      ('mascot', '마스코트', 2010),
      ('rubber_mascot', '러버 마스코트', 2020),
      ('acrylic_charm', '아크릴 참', 2030),
      ('acrylic_stand', '아크릴 스탠드', 2040),
      ('keychain', '키체인', 2050),
      ('charm', '참', 2060),
      ('strap', '스트랩', 2070),
      ('can_badge', '캔배지', 2080),
      ('sticker', '스티커', 2090),
      ('card', '카드', 2100),
      ('poster', '포스터', 2110),
      ('clear_file', '클리어파일', 2120),
      ('pouch', '파우치', 2130),
      ('mirror', '미러', 2140),
      ('ring', '링', 2150),
      ('plush', '봉제인형', 2160),
      ('miniature', '미니어처', 2170),
      ('magnet', '자석', 2180),
      ('swing', '스윙', 2190),
      ('sofubi', '소프비', 2200),
      ('stamp', '스탬프', 2210),
      ('clip', '클립', 2220)
  )
  INSERT INTO public.gacha_categories (
    name_ko,
    category_type,
    display_order,
    status,
    source,
    note
  )
  SELECT
    name_ko,
    'product_type',
    display_order,
    'active',
    'manual',
    'Seeded from curated product type vocabulary: ' || key
  FROM product_type_terms
  ON CONFLICT (name_ko_norm) DO UPDATE
  SET
    category_type = CASE
      WHEN public.gacha_categories.source IN ('manual', 'name_parts') THEN excluded.category_type
      ELSE public.gacha_categories.category_type
    END,
    source = CASE
      WHEN public.gacha_categories.source = 'name_parts' THEN excluded.source
      ELSE public.gacha_categories.source
    END,
    note = CASE
      WHEN public.gacha_categories.source = 'name_parts' THEN excluded.note
      ELSE public.gacha_categories.note
    END,
    display_order = coalesce(public.gacha_categories.display_order, excluded.display_order),
    updated_at = now();

  GET DIAGNOSTICS v_product_type_categories_upserted = ROW_COUNT;

  WITH product_type_aliases(category_name_ko, alias, alias_type, locale, source_key) AS (
    VALUES
      ('피규어', '피규어', 'canonical', 'ko', 'figure'),
      ('피규어', 'フィギュア', 'source_query', 'ja', 'figure'),
      ('피규어', 'Fig.', 'source_query', 'en', 'figure'),
      ('피규어', 'Figure', 'source_query', 'en', 'figure'),
      ('마스코트', '마스코트', 'canonical', 'ko', 'mascot'),
      ('마스코트', 'マスコット', 'source_query', 'ja', 'mascot'),
      ('러버 마스코트', '러버 마스코트', 'canonical', 'ko', 'rubber_mascot'),
      ('러버 마스코트', '러버마스코트', 'nickname', 'ko', 'rubber_mascot'),
      ('러버 마스코트', '라바 마스코트', 'nickname', 'ko', 'rubber_mascot'),
      ('러버 마스코트', 'ラバーマスコット', 'source_query', 'ja', 'rubber_mascot'),
      ('러버 마스코트', 'ラバマス', 'source_query', 'ja', 'rubber_mascot'),
      ('아크릴 참', '아크릴 참', 'canonical', 'ko', 'acrylic_charm'),
      ('아크릴 참', '아크릴참', 'nickname', 'ko', 'acrylic_charm'),
      ('아크릴 참', '아크릴 키링', 'nickname', 'ko', 'acrylic_charm'),
      ('아크릴 참', 'アクリルチャーム', 'source_query', 'ja', 'acrylic_charm'),
      ('아크릴 참', 'アクチャ', 'source_query', 'ja', 'acrylic_charm'),
      ('아크릴 스탠드', '아크릴 스탠드', 'canonical', 'ko', 'acrylic_stand'),
      ('아크릴 스탠드', '아크릴스탠드', 'nickname', 'ko', 'acrylic_stand'),
      ('아크릴 스탠드', '아크스타', 'nickname', 'ko', 'acrylic_stand'),
      ('아크릴 스탠드', 'アクリルスタンド', 'source_query', 'ja', 'acrylic_stand'),
      ('아크릴 스탠드', 'アクスタ', 'source_query', 'ja', 'acrylic_stand'),
      ('키체인', '키체인', 'canonical', 'ko', 'keychain'),
      ('키체인', '키링', 'nickname', 'ko', 'keychain'),
      ('키체인', '열쇠고리', 'nickname', 'ko', 'keychain'),
      ('키체인', '키 홀더', 'nickname', 'ko', 'keychain'),
      ('키체인', 'キーチェーン', 'source_query', 'ja', 'keychain'),
      ('키체인', 'キーホルダー', 'source_query', 'ja', 'keychain'),
      ('키체인', 'キーリング', 'source_query', 'ja', 'keychain'),
      ('참', '참', 'canonical', 'ko', 'charm'),
      ('참', '챰', 'nickname', 'ko', 'charm'),
      ('참', 'チャーム', 'source_query', 'ja', 'charm'),
      ('스트랩', '스트랩', 'canonical', 'ko', 'strap'),
      ('스트랩', 'ストラップ', 'source_query', 'ja', 'strap'),
      ('캔배지', '캔배지', 'canonical', 'ko', 'can_badge'),
      ('캔배지', '캔뱃지', 'nickname', 'ko', 'can_badge'),
      ('캔배지', '缶バッジ', 'source_query', 'ja', 'can_badge'),
      ('캔배지', '缶バ', 'source_query', 'ja', 'can_badge'),
      ('스티커', '스티커', 'canonical', 'ko', 'sticker'),
      ('스티커', '씰', 'nickname', 'ko', 'sticker'),
      ('스티커', 'ステッカー', 'source_query', 'ja', 'sticker'),
      ('스티커', 'シール', 'source_query', 'ja', 'sticker'),
      ('카드', '카드', 'canonical', 'ko', 'card'),
      ('카드', '클리어 카드', 'nickname', 'ko', 'card'),
      ('카드', '트레이딩 카드', 'nickname', 'ko', 'card'),
      ('카드', 'カード', 'source_query', 'ja', 'card'),
      ('카드', 'クリアカード', 'source_query', 'ja', 'card'),
      ('카드', 'トレーディングカード', 'source_query', 'ja', 'card'),
      ('포스터', '포스터', 'canonical', 'ko', 'poster'),
      ('포스터', 'ポスター', 'source_query', 'ja', 'poster'),
      ('클리어파일', '클리어파일', 'canonical', 'ko', 'clear_file'),
      ('클리어파일', '클리어 파일', 'nickname', 'ko', 'clear_file'),
      ('클리어파일', 'クリアファイル', 'source_query', 'ja', 'clear_file'),
      ('파우치', '파우치', 'canonical', 'ko', 'pouch'),
      ('파우치', 'ポーチ', 'source_query', 'ja', 'pouch'),
      ('미러', '미러', 'canonical', 'ko', 'mirror'),
      ('미러', '거울', 'nickname', 'ko', 'mirror'),
      ('미러', 'ミラー', 'source_query', 'ja', 'mirror'),
      ('링', '링', 'canonical', 'ko', 'ring'),
      ('링', '반지', 'nickname', 'ko', 'ring'),
      ('링', '볼록한 링', 'nickname', 'ko', 'ring'),
      ('링', 'リング', 'source_query', 'ja', 'ring'),
      ('링', '指輪', 'source_query', 'ja', 'ring'),
      ('봉제인형', '봉제인형', 'canonical', 'ko', 'plush'),
      ('봉제인형', '인형', 'nickname', 'ko', 'plush'),
      ('봉제인형', '누이구루미', 'nickname', 'ko', 'plush'),
      ('봉제인형', 'ぬいぐるみ', 'source_query', 'ja', 'plush'),
      ('봉제인형', 'ぬい', 'source_query', 'ja', 'plush'),
      ('미니어처', '미니어처', 'canonical', 'ko', 'miniature'),
      ('미니어처', 'ミニチュア', 'source_query', 'ja', 'miniature'),
      ('자석', '자석', 'canonical', 'ko', 'magnet'),
      ('자석', '마그넷', 'nickname', 'ko', 'magnet'),
      ('자석', 'マグネット', 'source_query', 'ja', 'magnet'),
      ('스윙', '스윙', 'canonical', 'ko', 'swing'),
      ('스윙', 'スイング', 'source_query', 'ja', 'swing'),
      ('소프비', '소프비', 'canonical', 'ko', 'sofubi'),
      ('소프비', 'ソフビ', 'source_query', 'ja', 'sofubi'),
      ('스탬프', '스탬프', 'canonical', 'ko', 'stamp'),
      ('스탬프', '도장', 'nickname', 'ko', 'stamp'),
      ('스탬프', 'スタンプ', 'source_query', 'ja', 'stamp'),
      ('클립', '클립', 'canonical', 'ko', 'clip'),
      ('클립', 'クリップ', 'source_query', 'ja', 'clip')
  ),
  deduped_product_type_aliases AS (
    SELECT DISTINCT ON (
      public.gacha_normalize_search_text(category_name_ko),
      public.gacha_normalize_search_text(alias)
    )
      category_name_ko,
      alias,
      alias_type,
      locale,
      source_key
    FROM product_type_aliases
    ORDER BY
      public.gacha_normalize_search_text(category_name_ko),
      public.gacha_normalize_search_text(alias),
      CASE alias_type
        WHEN 'canonical' THEN 0
        WHEN 'nickname' THEN 1
        WHEN 'translation' THEN 2
        WHEN 'source_query' THEN 3
        ELSE 4
      END,
      alias
  )
  INSERT INTO public.gacha_category_aliases (
    category_id,
    alias,
    alias_type,
    locale,
    status,
    source,
    note
  )
  SELECT
    c.id,
    pta.alias,
    pta.alias_type,
    pta.locale,
    'approved',
    'manual',
    'Seeded from curated product type vocabulary: ' || pta.source_key
  FROM deduped_product_type_aliases pta
  JOIN public.gacha_categories c
    ON c.name_ko_norm = public.gacha_normalize_search_text(pta.category_name_ko)
   AND c.category_type = 'product_type'
  ON CONFLICT (category_id, alias_norm) DO UPDATE
  SET
    alias_type = excluded.alias_type,
    locale = excluded.locale,
    status = excluded.status,
    source = excluded.source,
    note = excluded.note,
    updated_at = now();

  GET DIAGNOSTICS v_product_type_aliases_upserted = ROW_COUNT;

  DELETE FROM public.gacha_product_categories pc
  WHERE pc.source IN ('name_parts', 'known_product_line_term')
    AND (
      p_product_ids IS NULL
      OR pc.product_id = ANY(p_product_ids)
    );

  GET DIAGNOSTICS v_deleted_mappings = ROW_COUNT;

  WITH product_tags AS (
    SELECT DISTINCT
      gp.id AS product_id,
      nullif(btrim(tag.value), '') AS name_ko
    FROM public.gacha_products gp
    CROSS JOIN LATERAL jsonb_array_elements_text(
      CASE
        WHEN jsonb_typeof(gp.name_parts -> 'tags') = 'array' THEN gp.name_parts -> 'tags'
        ELSE '[]'::jsonb
      END
    ) AS tag(value)
    WHERE gp.status = 'active'
      AND jsonb_typeof(gp.name_parts -> 'tags') = 'array'
      AND (
        p_product_ids IS NULL
        OR gp.id = ANY(p_product_ids)
      )
  )
  INSERT INTO public.gacha_product_categories (
    product_id,
    category_id,
    relation_type,
    confidence,
    source,
    note
  )
  SELECT
    pt.product_id,
    c.id,
    'tag',
    0.9,
    'name_parts',
    'Backfilled from curated gacha_products.name_parts.tags'
  FROM product_tags pt
  JOIN public.gacha_categories c
    ON c.name_ko_norm = public.gacha_normalize_search_text(pt.name_ko)
   AND c.category_type IN ('genre', 'subject', 'origin')
   AND c.status = 'active'
  WHERE pt.name_ko IS NOT NULL
  ON CONFLICT (product_id, category_id) DO UPDATE
  SET
    relation_type = excluded.relation_type,
    confidence = greatest(public.gacha_product_categories.confidence, excluded.confidence),
    source = excluded.source,
    note = excluded.note,
    updated_at = now()
  WHERE public.gacha_product_categories.source = 'name_parts';

  GET DIAGNOSTICS v_tag_mappings_upserted = ROW_COUNT;

  WITH line_patterns(category_name_ko, source_pattern) AS (
    VALUES
      ('코로코레', 'ころコレ'),
      ('메지루시', 'めじるし'),
      ('오네무탄', 'おねむたん|オネムタン'),
      ('마치보케', 'まちぼうけ|マチボウケ|待ちぼうけ'),
      ('카타즌', '肩ズン'),
      ('데포러버', 'でふぉラバ|デフォラバ'),
      ('피타 데포메', 'ぴた！?でふぉめ|ぴたでふぉめ|ピタ！?デフォメ|ピタデフォメ'),
      ('스와라세타이', 'すわらせ隊'),
      ('네무라세타이', 'ねむらせ隊'),
      ('나라분데스', 'ならぶんです'),
      ('츠만데 츠나게떼', 'つまんでつなげて'),
      ('반쵸코', 'キャラばんちょうこう|ばんちょうこう'),
      ('쵸코노코', 'ちょこのっこ|チョコノッコ'),
      ('허그콧', 'ハグコット|HUGCOT|Hugcot'),
      ('링코레', 'Ringcolle!?|リングコレクション'),
      ('생물대도감', 'いきもの大図鑑'),
      ('오쿠루미', 'おくるみますこっと|おくるみマスコット|おくるみ')
  ),
  product_line_matches AS (
    SELECT DISTINCT
      gp.id AS product_id,
      lp.category_name_ko
    FROM public.gacha_products gp
    JOIN line_patterns lp
      ON coalesce(gp.name_ja, gp.name, '') ~ lp.source_pattern
      OR coalesce(gp.name, '') ~ lp.source_pattern
      OR coalesce(gp.name_ko, '') ~ lp.category_name_ko
    WHERE gp.status = 'active'
      AND (
        p_product_ids IS NULL
        OR gp.id = ANY(p_product_ids)
      )
  )
  INSERT INTO public.gacha_product_categories (
    product_id,
    category_id,
    relation_type,
    confidence,
    source,
    note
  )
  SELECT
    plm.product_id,
    c.id,
    'line',
    1,
    'known_product_line_term',
    'Mapped from domestic gacha product line term in product source name'
  FROM product_line_matches plm
  JOIN public.gacha_categories c
    ON c.name_ko_norm = public.gacha_normalize_search_text(plm.category_name_ko)
   AND c.category_type = 'line'
   AND c.status = 'active'
  ON CONFLICT (product_id, category_id) DO UPDATE
  SET
    relation_type = excluded.relation_type,
    confidence = greatest(public.gacha_product_categories.confidence, excluded.confidence),
    source = excluded.source,
    note = excluded.note,
    updated_at = now()
  WHERE public.gacha_product_categories.source = 'known_product_line_term';

  GET DIAGNOSTICS v_line_mappings_upserted = ROW_COUNT;

  WITH product_types AS (
    SELECT DISTINCT
      gp.id AS product_id,
      nullif(btrim(gp.name_parts -> 'product_type' ->> 'ko'), '') AS name_ko,
      nullif(btrim(gp.name_parts -> 'product_type' ->> 'ja'), '') AS name_ja,
      public.gacha_normalize_search_text(
        nullif(btrim(gp.name_parts -> 'product_type' ->> 'ko'), '')
      ) AS name_ko_norm,
      public.gacha_normalize_search_text(
        nullif(btrim(gp.name_parts -> 'product_type' ->> 'ja'), '')
      ) AS name_ja_norm
    FROM public.gacha_products gp
    WHERE gp.status = 'active'
      AND (
        gp.name_parts -> 'product_type' ->> 'ko' IS NOT NULL
        OR gp.name_parts -> 'product_type' ->> 'ja' IS NOT NULL
      )
      AND (
        p_product_ids IS NULL
        OR gp.id = ANY(p_product_ids)
      )
  ),
  product_type_matches AS (
    SELECT DISTINCT
      pt.product_id,
      a.category_id
    FROM product_types pt
    JOIN public.gacha_category_aliases a
      ON a.status = 'approved'
     AND (
       a.alias_norm IN (pt.name_ko_norm, pt.name_ja_norm)
       OR (
         char_length(a.alias_norm) >= 2
         AND (
           position(a.alias_norm in coalesce(pt.name_ko_norm, '')) > 0
           OR position(a.alias_norm in coalesce(pt.name_ja_norm, '')) > 0
         )
       )
     )
    JOIN public.gacha_categories c
      ON c.id = a.category_id
     AND c.category_type = 'product_type'
     AND c.status = 'active'
  )
  INSERT INTO public.gacha_product_categories (
    product_id,
    category_id,
    relation_type,
    confidence,
    source,
    note
  )
  SELECT
    ptm.product_id,
    ptm.category_id,
    'product_type',
    0.95,
    'name_parts',
    'Mapped from curated product type alias in gacha_products.name_parts.product_type'
  FROM product_type_matches ptm
  ON CONFLICT (product_id, category_id) DO UPDATE
  SET
    relation_type = excluded.relation_type,
    confidence = greatest(public.gacha_product_categories.confidence, excluded.confidence),
    source = excluded.source,
    note = excluded.note,
    updated_at = now()
  WHERE public.gacha_product_categories.source = 'name_parts';

  GET DIAGNOSTICS v_product_type_mappings_upserted = ROW_COUNT;

  RETURN jsonb_build_object(
    'vocab_categories_upserted', v_vocab_categories_upserted,
    'line_categories_upserted', v_line_categories_upserted,
    'category_aliases_upserted', v_category_aliases_upserted,
    'product_type_aliases_upserted', v_product_type_aliases_upserted,
    'product_type_categories_upserted', v_product_type_categories_upserted,
    'deleted_mappings', v_deleted_mappings,
    'tag_mappings_upserted', v_tag_mappings_upserted,
    'line_mappings_upserted', v_line_mappings_upserted,
    'product_type_mappings_upserted', v_product_type_mappings_upserted
  );
END;
$function$;

SELECT public.refresh_gacha_product_categories();

ALTER TABLE public.gacha_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gacha_category_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gacha_product_categories ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'gacha_categories'
      AND policyname = 'public can view active gacha_categories'
  ) THEN
    CREATE POLICY "public can view active gacha_categories"
      ON public.gacha_categories
      FOR SELECT
      TO public
      USING (status = 'active');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'gacha_category_aliases'
      AND policyname = 'public can view approved gacha_category_aliases'
  ) THEN
    CREATE POLICY "public can view approved gacha_category_aliases"
      ON public.gacha_category_aliases
      FOR SELECT
      TO public
      USING (
        status = 'approved'
        AND EXISTS (
          SELECT 1
          FROM public.gacha_categories gc
          WHERE gc.id = gacha_category_aliases.category_id
            AND gc.status = 'active'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'gacha_product_categories'
      AND policyname = 'public can view active gacha_product_categories'
  ) THEN
    CREATE POLICY "public can view active gacha_product_categories"
      ON public.gacha_product_categories
      FOR SELECT
      TO public
      USING (
        EXISTS (
          SELECT 1
          FROM public.gacha_products gp
          WHERE gp.id = gacha_product_categories.product_id
            AND gp.status = 'active'
        )
        AND EXISTS (
          SELECT 1
          FROM public.gacha_categories gc
          WHERE gc.id = gacha_product_categories.category_id
            AND gc.status = 'active'
        )
      );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'user_profiles'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'gacha_categories'
        AND policyname = 'admins can manage gacha_categories'
    ) THEN
      CREATE POLICY "admins can manage gacha_categories"
        ON public.gacha_categories
        FOR ALL
        TO authenticated
        USING (
          EXISTS (
            SELECT 1
            FROM public.user_profiles
            WHERE user_profiles.id = auth.uid()
              AND user_profiles.role = 'admin'
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1
            FROM public.user_profiles
            WHERE user_profiles.id = auth.uid()
              AND user_profiles.role = 'admin'
          )
        );
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'gacha_category_aliases'
        AND policyname = 'admins can manage gacha_category_aliases'
    ) THEN
      CREATE POLICY "admins can manage gacha_category_aliases"
        ON public.gacha_category_aliases
        FOR ALL
        TO authenticated
        USING (
          EXISTS (
            SELECT 1
            FROM public.user_profiles
            WHERE user_profiles.id = auth.uid()
              AND user_profiles.role = 'admin'
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1
            FROM public.user_profiles
            WHERE user_profiles.id = auth.uid()
              AND user_profiles.role = 'admin'
          )
        );
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'gacha_product_categories'
        AND policyname = 'admins can manage gacha_product_categories'
    ) THEN
      CREATE POLICY "admins can manage gacha_product_categories"
        ON public.gacha_product_categories
        FOR ALL
        TO authenticated
        USING (
          EXISTS (
            SELECT 1
            FROM public.user_profiles
            WHERE user_profiles.id = auth.uid()
              AND user_profiles.role = 'admin'
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1
            FROM public.user_profiles
            WHERE user_profiles.id = auth.uid()
              AND user_profiles.role = 'admin'
          )
        );
    END IF;
  END IF;
END $$;

GRANT SELECT ON public.gacha_categories TO anon, authenticated;
GRANT SELECT ON public.gacha_category_aliases TO anon, authenticated;
GRANT SELECT ON public.gacha_product_categories TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_gacha_product_categories(uuid[]) TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.gacha_categories TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.gacha_category_aliases TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.gacha_product_categories TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
