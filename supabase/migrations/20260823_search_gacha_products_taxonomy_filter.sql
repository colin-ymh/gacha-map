-- Phase 5 (B) of docs/plans/20260821-gacha-taxonomy-restructure.md
--
-- Adds taxonomy filters to search_gacha_products so that a query typed while a category or
-- series filter is active keeps that filter (기획서 §10, §17-6).
--
-- 주의할 점 세 가지:
--
-- 1. 인자를 추가하면 시그니처가 바뀌므로 CREATE OR REPLACE 로는 교체되지 않고 오버로드가
--    하나 더 생긴다. PostgREST 가 이름 기반으로 호출하므로 모호성이 생긴다.
--    따라서 기존 7인자 함수를 DROP 하고 9인자로 다시 만든다.
--    DROP 하면 COMMENT 와 GRANT 가 함께 사라지므로 아래에서 다시 선언한다.
--
-- 2. 기존 7개 인자의 이름과 순서를 그대로 두고 뒤에만 붙였다. 새 인자가 NULL 이면
--    현행 동작과 완전히 동일해야 한다.
--
-- 3. 필터는 빈 질의 경로와 검색 질의 경로 **양쪽 모두**에 적용해야 한다. 한쪽만 고치면
--    검색어를 지웠을 때 필터가 조용히 풀린다.
--
-- 술어 자체는 gacha_filter_product_ids 를 그대로 쓴다. 여기서 다시 구현하지 않는다.
-- v_has_tax_filter 로 감싸서 필터가 없을 때는 서브플랜이 아예 실행되지 않게 한다.

drop function if exists public.search_gacha_products(
  text, text, integer, integer, boolean, real, boolean
);

CREATE OR REPLACE FUNCTION public.search_gacha_products(
  q                text    DEFAULT '',
  p_manufacturer   text    DEFAULT NULL,
  p_limit          integer DEFAULT 20,
  p_offset         integer DEFAULT 0,
  p_fuzzy          boolean DEFAULT true,
  p_min_similarity real    DEFAULT 0.4,
  p_has_variants   boolean DEFAULT false,
  p_category_ids   uuid[]  DEFAULT NULL,
  p_series_ids     uuid[]  DEFAULT NULL
)
RETURNS TABLE (
  id                   uuid,
  manufacturer         text,
  name                 text,
  name_ja              text,
  name_ko              text,
  name_en              text,
  jan_code             text,
  product_code         text,
  price_jpy            integer,
  release_month        date,
  release_week_text    text,
  types_count          integer,
  official_image_url   text,
  source_url           text,
  source_type          text,
  status               text,
  created_at           timestamptz,
  updated_at           timestamptz,
  last_seen_at         timestamptz,
  name_parts           jsonb,
  total_count          bigint,
  match_score          real,
  match_kind           text,
  matched_aliases      jsonb,
  matched_variant_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $fn$
DECLARE
  v_phrase       text;
  v_phrase_terms text[];  -- phrase + 그 별칭 확장
  v_fuzzy_phrase text[];  -- 위 중 유사도에 쓸 것만
  v_token_groups jsonb;   -- [[t1 변형들], [t2 변형들], ...]
  v_fuzzy_groups jsonb;   -- 위 중 유사도에 쓸 것만 (슬롯 수는 동일)
  v_token_count  integer;
  v_all_terms    text[];  -- 전부 평탄화 (kind 판정 / 변형명 조회용)
  v_aliases      jsonb;   -- [{"alias":..,"canonical_terms":[..]}]
  v_sim          real;
  v_has_tax_filter boolean;
BEGIN
  v_sim := least(greatest(coalesce(p_min_similarity, 0.4), 0.05), 1.0);

  -- 택소노미 필터가 없으면 아래 IN 서브플랜은 실행조차 되지 않는다.
  v_has_tax_filter := (p_category_ids IS NOT NULL OR p_series_ids IS NOT NULL);

  -- <% 연산자는 pg_trgm.word_similarity_threshold 를 본다.
  -- set_limit() 은 % 용 similarity_threshold 만 바꾸므로 여기서는 쓸 수 없다.
  -- is_local = true 라 트랜잭션이 끝나면 원래 값으로 돌아간다.
  PERFORM set_config('pg_trgm.word_similarity_threshold', v_sim::text, true);

  v_phrase := public.gacha_normalize_search_text(q);

  -- 질의어가 비면 기존 목록 동작을 그대로 유지한다.
  IF v_phrase = '' THEN
    RETURN QUERY
    SELECT
      gp.id, gp.manufacturer, gp.name, gp.name_ja, gp.name_ko, gp.name_en,
      gp.jan_code, gp.product_code, gp.price_jpy, gp.release_month,
      gp.release_week_text, gp.types_count, gp.official_image_url,
      gp.source_url, gp.source_type, gp.status, gp.created_at, gp.updated_at,
      gp.last_seen_at, gp.name_parts,
      COUNT(*) OVER() AS total_count,
      0::real     AS match_score,
      NULL::text  AS match_kind,
      '[]'::jsonb AS matched_aliases,
      NULL::text  AS matched_variant_name
    FROM public.gacha_products gp
    LEFT JOIN public.gacha_product_search_docs d ON d.product_id = gp.id
    WHERE gp.status = 'active'
      AND (p_manufacturer IS NULL OR gp.manufacturer = p_manufacturer)
      AND (NOT p_has_variants OR coalesce(d.has_variant, false))
      AND (NOT v_has_tax_filter OR gp.id IN (
            SELECT f.product_id
              FROM public.gacha_filter_product_ids(p_category_ids, p_series_ids, true) f
          ))
    ORDER BY gp.release_month DESC NULLS LAST, gp.name ASC
    LIMIT p_limit OFFSET p_offset;
    RETURN;
  END IF;

  -- 토큰 분해 + 토큰별 별칭 확장. 토큰은 5개까지만 본다.
  WITH raw AS (
    SELECT ord, public.gacha_normalize_search_text(w) AS tok
      FROM unnest(regexp_split_to_array(btrim(q), '\s+')) WITH ORDINALITY AS u(w, ord)
  ),
  toks AS (
    SELECT ord, tok FROM raw WHERE tok <> '' ORDER BY ord LIMIT 5
  ),
  expanded AS (
    SELECT t.ord, ARRAY[t.tok] || coalesce(a.canonical_norms, '{}'::text[]) AS variants
      FROM toks t
      LEFT JOIN public.gacha_search_aliases a
        ON a.alias_norm = t.tok
       AND a.status = 'approved'
  )
  SELECT jsonb_agg(to_jsonb(e.variants) ORDER BY e.ord), count(*)::integer
    INTO v_token_groups, v_token_count
    FROM expanded e;

  v_token_groups := coalesce(v_token_groups, '[]'::jsonb);
  v_token_count  := coalesce(v_token_count, 0);

  -- phrase 확장 (질의어 전체가 하나의 별칭인 경우)
  SELECT ARRAY[v_phrase] || coalesce(a.canonical_norms, '{}'::text[])
    INTO v_phrase_terms
    FROM (SELECT 1) AS anchor
    LEFT JOIN public.gacha_search_aliases a
      ON a.alias_norm = v_phrase
     AND a.status = 'approved';

  v_fuzzy_groups := CASE WHEN p_fuzzy
                         THEN public.gacha_search_fuzzy_groups(v_token_groups)
                         ELSE '[]'::jsonb END;
  v_fuzzy_phrase := CASE WHEN p_fuzzy
                         THEN public.gacha_search_fuzzy_terms(v_phrase_terms)
                         ELSE '{}'::text[] END;

  -- 적중한 별칭 목록 (토큰 + phrase 양쪽). 모든 행에 같은 값이 실린다.
  SELECT coalesce(jsonb_agg(DISTINCT jsonb_build_object(
           'alias', a.alias,
           'canonical_terms', to_jsonb(a.canonical_terms)
         )), '[]'::jsonb)
    INTO v_aliases
    FROM public.gacha_search_aliases a
   WHERE a.status = 'approved'
     AND (
       a.alias_norm = v_phrase
       OR a.alias_norm IN (
         SELECT public.gacha_normalize_search_text(w)
           FROM unnest(regexp_split_to_array(btrim(q), '\s+')) AS w
       )
     );

  SELECT array_agg(DISTINCT t)
    INTO v_all_terms
    FROM (
      SELECT unnest(v_phrase_terms) AS t
      UNION
      SELECT jsonb_array_elements_text(grp) FROM jsonb_array_elements(v_token_groups) AS grp
    ) z
   WHERE t <> '';

  RETURN QUERY
  -- 후보 집합이 곧 매칭 집합이다. 뒤에서 다시 걸러내지 않는다.
  -- 토큰은 교집합(모든 토큰이 각자 매칭), phrase 는 합집합으로 얹는다.
  --
  -- ⚠️ 반드시 unnest/jsonb JOIN docs 형태로 써야 trgm GIN 인덱스를 탄다.
  --    상관 EXISTS 로 쓰면 인덱스를 못 타고 전체 행 스캔이 된다(실측 1029ms → 146ms).
  WITH token_hits AS (
    SELECT g.ord, d.product_id
      FROM jsonb_array_elements(v_token_groups) WITH ORDINALITY AS g(grp, ord)
      CROSS JOIN LATERAL jsonb_array_elements_text(g.grp) AS t
      JOIN public.gacha_product_search_docs d ON d.doc_all LIKE '%' || t || '%'
    UNION
    SELECT g.ord, d.product_id
      FROM jsonb_array_elements(v_fuzzy_groups) WITH ORDINALITY AS g(grp, ord)
      CROSS JOIN LATERAL jsonb_array_elements_text(g.grp) AS t
      JOIN public.gacha_product_search_docs d ON t <% d.doc_fuzzy
  ),
  cand AS (
    SELECT th.product_id
      FROM token_hits th
     GROUP BY th.product_id
    HAVING count(DISTINCT th.ord) = v_token_count AND v_token_count > 0
    UNION
    SELECT d.product_id
      FROM unnest(v_phrase_terms) AS t
      JOIN public.gacha_product_search_docs d ON d.doc_all LIKE '%' || t || '%'
    UNION
    SELECT d.product_id
      FROM unnest(v_fuzzy_phrase) AS t
      JOIN public.gacha_product_search_docs d ON t <% d.doc_fuzzy
  ),
  scored AS (
    SELECT
      gp.id            AS pid,
      gp.release_month AS rel,
      gp.name          AS nm,
      GREATEST(
        -- phrase 점수
        (
          SELECT coalesce(max(public.gacha_search_term_score(
                   t, d.doc_primary, d.doc_series, d.doc_variant, d.doc_code, d.doc_fuzzy,
                   p_fuzzy, v_sim)), 0)
            FROM unnest(v_phrase_terms) AS t
        ),
        -- 토큰 AND 점수: 가장 약한 토큰 기준(weakest link).
        -- 하나라도 0이면 전체 0. x0.9 라서 동점일 때 phrase 매칭이 항상 앞선다.
        CASE WHEN v_token_count = 0 THEN 0::real ELSE (
          SELECT CASE WHEN min(z.s) <= 0 THEN 0::real ELSE (min(z.s) * 0.9)::real END
            FROM (
              SELECT coalesce(max(public.gacha_search_term_score(
                       t, d.doc_primary, d.doc_series, d.doc_variant, d.doc_code, d.doc_fuzzy,
                       p_fuzzy, v_sim)), 0) AS s
                FROM jsonb_array_elements(v_token_groups) AS grp
                CROSS JOIN LATERAL jsonb_array_elements_text(grp) AS t
               GROUP BY grp
            ) z
        ) END
      )::real AS score,
      d.doc_primary, d.doc_series, d.doc_variant, d.doc_code
    FROM cand c
    JOIN public.gacha_products gp            ON gp.id = c.product_id
    JOIN public.gacha_product_search_docs d  ON d.product_id = c.product_id
    WHERE gp.status = 'active'
      AND (p_manufacturer IS NULL OR gp.manufacturer = p_manufacturer)
      AND (NOT p_has_variants OR d.has_variant)
      AND (NOT v_has_tax_filter OR gp.id IN (
            SELECT f.product_id
              FROM public.gacha_filter_product_ids(p_category_ids, p_series_ids, true) f
          ))
  ),
  ranked AS (
    SELECT s.*, COUNT(*) OVER() AS total
      FROM scored s
     WHERE s.score > 0
     ORDER BY s.score DESC, s.rel DESC NULLS LAST, s.nm ASC
     LIMIT p_limit OFFSET p_offset
  )
  SELECT
    gp.id, gp.manufacturer, gp.name, gp.name_ja, gp.name_ko, gp.name_en,
    gp.jan_code, gp.product_code, gp.price_jpy, gp.release_month,
    gp.release_week_text, gp.types_count, gp.official_image_url,
    gp.source_url, gp.source_type, gp.status, gp.created_at, gp.updated_at,
    gp.last_seen_at, gp.name_parts,
    r.total AS total_count,
    r.score AS match_score,
    public.gacha_search_match_kind(
      v_all_terms, r.doc_primary, r.doc_series, r.doc_variant, r.doc_code
    ) AS match_kind,
    v_aliases AS matched_aliases,
    mv.variant_name AS matched_variant_name
  FROM ranked r
  JOIN public.gacha_products gp ON gp.id = r.pid
  -- 변형명은 LIMIT 이후에만 조회한다. scored 안에 넣으면 매칭된 전체 집합에 대해
  -- 변형 테이블을 뒤지게 된다.
  LEFT JOIN LATERAL (
    SELECT coalesce(gv.name_ko, gv.name_ja, gv.name) AS variant_name
      FROM public.gacha_product_variants gv
      -- 가장 긴 검색어에 걸린 변형을 고른다. 짧은 토큰은 여러 변형에 걸리므로
      -- sort_order 순으로만 뽑으면 엉뚱한 변형 이름이 표시된다.
      CROSS JOIN LATERAL (
        SELECT max(length(t)) AS best
          FROM unnest(v_all_terms) AS t
         WHERE public.gacha_normalize_search_text(
                 concat_ws(' ', gv.name, gv.name_ja, gv.name_ko, gv.name_en)
               ) LIKE '%' || t || '%'
      ) m
     WHERE gv.product_id = r.pid
       AND gv.status = 'active'
       AND m.best IS NOT NULL
     ORDER BY m.best DESC, gv.sort_order
     LIMIT 1
  ) mv ON true
  ORDER BY r.score DESC, gp.release_month DESC NULLS LAST, gp.name ASC;
END;
$fn$;

COMMENT ON FUNCTION public.search_gacha_products(text, text, integer, integer, boolean, real, boolean, uuid[], uuid[]) IS
  '가챠 상품 검색 v2 + 택소노미 필터. 별칭 확장 + 토큰 AND + trigram 유사도 + 변형(상세) 상품명 포함. p_category_ids / p_series_ids 는 gacha_filter_product_ids 를 통과한다(축 안 OR, 축 간 AND).';

GRANT EXECUTE ON FUNCTION
  public.search_gacha_products(text, text, integer, integer, boolean, real, boolean, uuid[], uuid[])
  TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
