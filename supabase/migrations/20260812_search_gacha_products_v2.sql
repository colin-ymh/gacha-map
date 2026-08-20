-- search_gacha_products v2 — 별칭 확장 + 토큰 AND + trigram 유사도 + 변형명 + 랭킹
--
-- v1 문제 (20260630_gacha_product_name_parts.sql):
--   - 순수 ILIKE '%q%' 라 오타를 못 잡는다
--   - '먼작귀' 같은 약칭은 정식 명칭과 공통 문자가 0이라 영원히 0건
--   - gacha_product_variants(변형/상세 상품명)가 검색에서 배제돼 있다
--   - '치이카와 마스코트' 처럼 토큰 사이에 다른 단어가 끼면 못 찾는다
--   - 정렬이 release_month DESC 뿐이라 정확히 일치한 상품이 뒤로 밀린다
--
-- v2 매칭 방식:
--   질의어를 (a) 공백 기준 토큰과 (b) 전체를 붙인 phrase 두 형태로 정규화한 뒤,
--   각각을 승인된 별칭으로 확장한다. 예)
--     '먼작귀 키홀더'
--       tokens : [['먼작귀','치이카와','ちいかわ'], ['키홀더']]
--       phrase : ['먼작귀키홀더']
--   매칭 = phrase 매칭 OR 모든 토큰이 각자 매칭.
--   즉 (치이카와 OR ちいかわ) AND 키홀더 가 된다.
--
-- 반환 컬럼이 늘어나므로 CREATE OR REPLACE 가 불가능하다. DROP 후 재생성한다.
-- 기존 호출부(apps/web .../api/gacha-products/route.ts)는 필드명으로 접근하므로
-- 컬럼 추가는 하위호환이다. 신규 파라미터는 전부 DEFAULT 가 있어 4-인자 호출도 그대로 동작한다.
--
-- 실행 전 예상 영향:
--   - 함수 5개 신규/교체. 데이터 변경 0건.
--   - 배포 순서는 DB 먼저 → web 나중. 구버전 web + 신버전 RPC 조합도 정상 동작한다.
--
-- dev 실측 (활성 상품 약 1만 건, 워밍업 후):
--   '원피스' 6ms / '치이카와' 39ms / '산리오'(348건) 50ms
--   '먼작귀 키홀더' 57ms / '치이카와 마스코트' 146ms

BEGIN;

-- ---------------------------------------------------------------------------
-- 검색어 1개에 대한 점수
-- ---------------------------------------------------------------------------
-- 어느 필드에서 맞았는지에 따라 차등을 준다. 위에서부터 우선순위.
-- 부분 문자열이 하나도 안 맞을 때만 trigram 유사도로 내려간다(최대 1.5).
--
-- 유사도는 반드시 p_fuzzy_doc(공백 보존본)에 대고 계산한다.
-- word_similarity 는 대상의 단어 경계에 맞춰 구간을 자르므로, 공백을 제거한
-- doc_primary/doc_all 에 대고 계산하면 검색어가 맨 앞에 오지 않는 한 0이 나온다.
-- 임계값은 GUC(pg_trgm.word_similarity_threshold)에 의존하지 않고 명시 비교한다.
--
-- ⚠️ SET search_path 를 붙이면 안 된다. SET 절이 있는 SQL 함수는 인라인되지
--    않아서 행마다 함수 호출 비용이 붙는다. 대신 모든 참조를 스키마 한정한다.
--    (SECURITY INVOKER 라 search_path 미지정이 보안 문제를 만들지 않는다)
--
-- 파라미터 이름이 바뀌면 CREATE OR REPLACE 가 거부되므로 먼저 지운다.
DROP FUNCTION IF EXISTS public.gacha_search_term_score(
  text, text, text, text, text, text, boolean, real);

CREATE FUNCTION public.gacha_search_term_score(
  p_term           text,
  p_primary        text,
  p_series         text,
  p_variant        text,
  p_code           text,
  p_fuzzy_doc      text,
  p_fuzzy          boolean,
  p_min_similarity real
)
RETURNS real
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $fn$
  SELECT CASE
    WHEN p_term IS NULL OR p_term = ''                     THEN 0::real
    WHEN p_primary = p_term                                THEN 5.0::real
    WHEN p_primary LIKE p_term || '%'                      THEN 4.0::real
    WHEN p_primary LIKE '%' || p_term || '%'               THEN 3.0::real
    WHEN p_code <> '' AND p_code LIKE '%' || p_term || '%' THEN 2.6::real
    WHEN p_series LIKE '%' || p_term || '%'                THEN 2.5::real
    WHEN p_variant LIKE '%' || p_term || '%'               THEN 2.0::real
    WHEN p_fuzzy AND extensions.word_similarity(p_term, p_fuzzy_doc) >= p_min_similarity
      THEN 0.5::real + extensions.word_similarity(p_term, p_fuzzy_doc)
    ELSE 0::real
  END;
$fn$;

GRANT EXECUTE ON FUNCTION
  public.gacha_search_term_score(text, text, text, text, text, text, boolean, real)
  TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 매칭 종류 라벨
-- ---------------------------------------------------------------------------
-- UI 표기용이라 페이지에 실린 행(기본 20건)에만 계산한다.
CREATE OR REPLACE FUNCTION public.gacha_search_match_kind(
  p_terms   text[],
  p_primary text,
  p_series  text,
  p_variant text,
  p_code    text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog, pg_temp
AS $fn$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM unnest(p_terms) t WHERE t <> '' AND p_primary = t)
      THEN 'exact'
    WHEN EXISTS (SELECT 1 FROM unnest(p_terms) t WHERE t <> '' AND p_primary LIKE t || '%')
      THEN 'prefix'
    WHEN EXISTS (SELECT 1 FROM unnest(p_terms) t WHERE t <> '' AND p_primary LIKE '%' || t || '%')
      THEN 'primary'
    WHEN EXISTS (SELECT 1 FROM unnest(p_terms) t WHERE t <> '' AND p_code <> '' AND p_code LIKE '%' || t || '%')
      THEN 'code'
    WHEN EXISTS (SELECT 1 FROM unnest(p_terms) t WHERE t <> '' AND p_series LIKE '%' || t || '%')
      THEN 'series'
    WHEN EXISTS (SELECT 1 FROM unnest(p_terms) t WHERE t <> '' AND p_variant LIKE '%' || t || '%')
      THEN 'variant'
    ELSE 'fuzzy'
  END;
$fn$;

-- ---------------------------------------------------------------------------
-- 유사도 경로에서 짧은 검색어 제외
-- ---------------------------------------------------------------------------
-- 3자 미만은 trigram 이 만들어지지 않아 <% 가 GIN 인덱스를 못 타고 전체 행에서
-- word_similarity 를 계산한다. dev 실측: 2자 질의 1650ms → 제외 후 250ms.
CREATE OR REPLACE FUNCTION public.gacha_search_fuzzy_terms(p_terms text[])
RETURNS text[]
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog, pg_temp
AS $fn$
  SELECT coalesce(array_agg(t), '{}'::text[])
    FROM unnest(coalesce(p_terms, '{}'::text[])) AS t
   WHERE length(t) >= 3;
$fn$;

COMMENT ON FUNCTION public.gacha_search_fuzzy_terms(text[]) IS
  '유사도 매칭에 쓸 검색어만 남긴다. 3자 미만은 trigram 인덱스가 퇴화하므로 제외.';

-- 토큰 그룹 버전.
-- ⚠️ 그룹 자체를 제거하면 token_hits 의 ord 가 어긋나
--    HAVING count(DISTINCT ord) = v_token_count 판정이 깨진다.
--    그룹 슬롯은 유지하고 그룹 안의 짧은 검색어만 제거한다.
--    빈 배열이 된 그룹은 유사도 분기에서 행을 내지 않을 뿐, LIKE 분기가 ord 를 공급한다.
CREATE OR REPLACE FUNCTION public.gacha_search_fuzzy_groups(p_groups jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog, pg_temp
AS $fn$
  SELECT coalesce(jsonb_agg(kept ORDER BY ord), '[]'::jsonb)
    FROM (
      SELECT g.ord,
             coalesce((
               SELECT jsonb_agg(t)
                 FROM jsonb_array_elements_text(g.grp) AS t
                WHERE length(t) >= 3
             ), '[]'::jsonb) AS kept
        FROM jsonb_array_elements(coalesce(p_groups, '[]'::jsonb)) WITH ORDINALITY AS g(grp, ord)
    ) z;
$fn$;

-- ---------------------------------------------------------------------------
-- 검색 RPC
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.search_gacha_products(text, text, integer, integer);

CREATE OR REPLACE FUNCTION public.search_gacha_products(
  q                text    DEFAULT '',
  p_manufacturer   text    DEFAULT NULL,
  p_limit          integer DEFAULT 20,
  p_offset         integer DEFAULT 0,
  p_fuzzy          boolean DEFAULT true,
  p_min_similarity real    DEFAULT 0.4,
  p_has_variants   boolean DEFAULT false
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
BEGIN
  v_sim := least(greatest(coalesce(p_min_similarity, 0.4), 0.05), 1.0);

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

COMMENT ON FUNCTION public.search_gacha_products(text, text, integer, integer, boolean, real, boolean) IS
  '가챠 상품 검색 v2. 별칭 확장 + 토큰 AND + trigram 유사도 + 변형(상세) 상품명 포함.';

GRANT EXECUTE ON FUNCTION
  public.search_gacha_products(text, text, integer, integer, boolean, real, boolean)
  TO anon, authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
