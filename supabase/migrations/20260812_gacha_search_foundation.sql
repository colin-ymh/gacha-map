-- 가챠 상품 검색 개선 — 기반 인프라 (정규화 함수 + 검색 도큐먼트 + 갱신 파이프라인)
--
-- 배경: search_gacha_products가 순수 ILIKE '%q%' 하나뿐이라 오타·다중 토큰·
-- 변형(상세) 상품명 검색이 전부 불가능했다. 이 마이그레이션은 그 위에 올릴
-- 기반만 만든다. 실제 검색 RPC 교체는 20260812_search_gacha_products_v2.sql.
--
-- 구성:
--   1) pg_trgm 확장 (유사도 검색용 GIN 인덱스)
--   2) gacha_normalize_search_text() — 질의어/문서 공통 정규화
--   3) gacha_product_search_docs — 상품 1건당 검색용 텍스트 묶음
--   4) gacha_product_search_dirty — 갱신 대기 큐
--   5) refresh_gacha_product_search_docs() — 큐 배치 처리 / 지정 상품 즉시 처리
--   6) 트리거 2개 (gacha_products, gacha_product_variants) — 큐에 넣기만 함
--   7) pg_cron 2분 주기 배치
--
-- 실행 전 예상 영향:
--   - 신규 테이블 2개, 신규 함수 4개, 신규 트리거 2개, cron job 1건.
--   - gacha_product_search_docs에 gacha_products 행 수만큼 행 생성 (약 1.2만 행).
--   - 기존 테이블의 데이터는 변경하지 않는다. 기존 RPC도 건드리지 않는다.
-- 재실행 시:
--   - 전부 IF NOT EXISTS / CREATE OR REPLACE / cron upsert라 멱등하다.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) pg_trgm
-- ---------------------------------------------------------------------------
-- Supabase 관례상 extensions 스키마에 설치한다.
-- 이 확장의 연산자(<%, gin_trgm_ops 등)를 쓰는 함수는 반드시
-- SET search_path에 extensions를 포함해야 한다.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- 2) 공통 정규화 함수
-- ---------------------------------------------------------------------------
-- 질의어와 검색 문서를 같은 규칙으로 접어서 비교 가능하게 만든다.
--   - NFKC: 전각→반각(Ａ→a), 가나 호환 문자 통일, 한글 NFD→NFC 결합
--   - lower: 대소문자 무시
--   - 공백/구두점 제거: "치이카와 마스코트" 와 "치이카와마스코트" 를 같게 취급
--   - %, _, \ 제거: 이후 LIKE 패턴에 그대로 끼워도 와일드카드 주입이 불가능하다
--     (그래서 호출부에서 별도 이스케이프를 하지 않는다)
--   - '-' 는 문자군 맨 끝에 둬야 범위 지정으로 해석되지 않는다
--
-- ⚠️ 이 함수의 정의를 바꾸면 이미 저장된 gacha_product_search_docs.doc_* 와
--    gacha_search_aliases.alias_norm 은 자동으로 재계산되지 않는다.
--    반드시 public.rebuild_gacha_search_norms() 를 함께 실행할 것.
--    (rebuild_gacha_search_norms 는 20260812_gacha_search_aliases.sql 에 정의)
--
-- 검증 (dev PG 17.6):
--   select public.gacha_normalize_search_text('Ａ-Ｂ_Ｃ%[]\・（テスト）');
--   -- => 'abcテスト'
CREATE OR REPLACE FUNCTION public.gacha_normalize_search_text(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
-- 본문이 pg_catalog 내장 함수만 쓰므로 pg_catalog 로 고정한다.
-- 생성 컬럼/인덱스 식에서 쓰이는 함수라 search_path 가 흔들리면 안 된다.
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT regexp_replace(
    lower(normalize(coalesce(p, ''), NFKC)),
    '[[:space:]_/.,''"!?&·・:()（）\[\]【】%\\-]',
    '',
    'g'
  );
$$;

COMMENT ON FUNCTION public.gacha_normalize_search_text(text) IS
  '가챠 검색용 텍스트 정규화. 정의 변경 시 rebuild_gacha_search_norms() 필수.';

-- 공백 보존 변형. 유사도(trigram) 매칭 전용이다.
--
-- 왜 따로 필요한가:
-- pg_trgm의 word_similarity()는 대상 문자열의 "단어" 경계에 맞춰 부분 구간을
-- 잘라 비교한다. 공백을 전부 지우면 문서 전체가 단어 하나가 되어, 검색어가
-- 문자열 맨 앞에 오지 않는 한 유사도가 0으로 떨어진다. 실측:
--   word_similarity('치이가와', 'ちいかわ貯金箱ちいかわ貯金箱치이카와저금통')     => 0.000
--   word_similarity('치이가와', 'ちいかわ貯金箱 ちいかわ貯金箱 치이카와 저금통') => 0.400
-- 그래서 부분 문자열(LIKE) 매칭은 공백 없는 doc_*를, 유사도 매칭은 공백을
-- 유지한 doc_fuzzy를 쓴다.
CREATE OR REPLACE FUNCTION public.gacha_normalize_search_text_ws(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT btrim(
    regexp_replace(
      regexp_replace(
        lower(normalize(coalesce(p, ''), NFKC)),
        '[_/.,''"!?&·・:()（）\[\]【】%\\-]',
        ' ',
        'g'
      ),
      '[[:space:]]+',
      ' ',
      'g'
    )
  );
$$;

COMMENT ON FUNCTION public.gacha_normalize_search_text_ws(text) IS
  '유사도 매칭용 정규화. 공백을 보존해야 word_similarity가 동작한다.';

-- ---------------------------------------------------------------------------
-- 3) 검색 도큐먼트
-- ---------------------------------------------------------------------------
-- 상품 1건 = 1행. 모든 doc_* 컬럼은 gacha_normalize_search_text() 를 통과한
-- 값만 저장한다. 질의어도 같은 함수를 통과하므로 비교가 일관된다.
--
-- 필드를 나눠 두는 이유: 어디서 매칭됐는지에 따라 랭킹 점수를 달리 준다.
-- (상품명 일치 > 시리즈/태그 일치 > 변형명 일치)
CREATE TABLE IF NOT EXISTS public.gacha_product_search_docs (
  product_id  uuid PRIMARY KEY REFERENCES public.gacha_products(id) ON DELETE CASCADE,
  doc_primary text NOT NULL DEFAULT '',
  doc_series  text NOT NULL DEFAULT '',
  doc_variant text NOT NULL DEFAULT '',
  doc_code    text NOT NULL DEFAULT '',
  doc_all     text NOT NULL DEFAULT '',
  -- 유사도 전용. 위 doc_*와 내용은 같지만 공백을 유지한다.
  doc_fuzzy   text NOT NULL DEFAULT '',
  has_variant boolean NOT NULL DEFAULT false,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 이미 배포된 환경을 위한 보강 (테이블이 먼저 만들어졌을 수 있다)
ALTER TABLE public.gacha_product_search_docs
  ADD COLUMN IF NOT EXISTS doc_fuzzy text NOT NULL DEFAULT '';

COMMENT ON TABLE public.gacha_product_search_docs IS
  '가챠 상품 검색용 정규화 텍스트. gacha_products/gacha_product_variants에서 파생. 직접 수정 금지.';
COMMENT ON COLUMN public.gacha_product_search_docs.doc_primary IS 'name, name_ja, name_ko, name_en';
COMMENT ON COLUMN public.gacha_product_search_docs.doc_series IS 'name_parts의 series/tags/product_type';
COMMENT ON COLUMN public.gacha_product_search_docs.doc_variant IS 'status=active 변형의 이름들만';
COMMENT ON COLUMN public.gacha_product_search_docs.doc_code IS 'jan_code, product_code';
COMMENT ON COLUMN public.gacha_product_search_docs.doc_fuzzy IS
  '유사도 매칭 전용. 공백 보존 정규화본. word_similarity는 단어 경계가 있어야 동작한다.';
COMMENT ON COLUMN public.gacha_product_search_docs.has_variant IS 'active 변형 보유 여부 (has_variants 필터용)';

CREATE INDEX IF NOT EXISTS gacha_product_search_docs_all_trgm_idx
  ON public.gacha_product_search_docs
  USING gin (doc_all extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS gacha_product_search_docs_primary_trgm_idx
  ON public.gacha_product_search_docs
  USING gin (doc_primary extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS gacha_product_search_docs_fuzzy_trgm_idx
  ON public.gacha_product_search_docs
  USING gin (doc_fuzzy extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS gacha_product_search_docs_has_variant_idx
  ON public.gacha_product_search_docs (has_variant)
  WHERE has_variant;

-- RLS 켜고 정책은 두지 않는다.
-- 이 테이블은 search_gacha_products(SECURITY DEFINER)를 통해서만 읽힌다.
-- SECURITY DEFINER 함수는 소유자 권한으로 돌기 때문에 정책 없이도 접근 가능하고,
-- anon/authenticated의 직접 조회는 default deny로 막힌다.
ALTER TABLE public.gacha_product_search_docs ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 4) 갱신 대기 큐
-- ---------------------------------------------------------------------------
-- 트리거에서 곧바로 문서를 재계산하지 않는 이유:
-- gacha-collector가 변형 수만 행을 벌크 upsert하는데, 행마다 해당 상품의
-- 변형 전체를 aggregate하면 수집 파이프라인이 실질적으로 멈춘다.
-- 트리거는 product_id만 큐에 적재(O(1))하고, 실제 계산은 배치로 넘긴다.
CREATE TABLE IF NOT EXISTS public.gacha_product_search_dirty (
  product_id uuid PRIMARY KEY,
  queued_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.gacha_product_search_dirty IS
  '검색 문서 재계산 대기 큐. refresh_gacha_product_search_docs()가 비운다.';

ALTER TABLE public.gacha_product_search_dirty ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 5) 문서 재계산 함수
-- ---------------------------------------------------------------------------
-- p_product_ids 가 주어지면 그 상품만 즉시 처리하고 큐에서도 제거한다.
-- NULL이면 큐에서 p_batch_limit 만큼 꺼내 처리한다.
-- 반환값: 처리한 상품 수.
--
-- gacha-collector는 ingest 직후 이 함수를 직접 호출해 즉시 반영할 수 있다.
-- (트리거를 비활성화할 필요도, 권한도 없다)
CREATE OR REPLACE FUNCTION public.refresh_gacha_product_search_docs(
  p_product_ids uuid[]  DEFAULT NULL,
  p_batch_limit integer DEFAULT 5000
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ids   uuid[];
  v_count integer;
BEGIN
  IF p_product_ids IS NOT NULL THEN
    v_ids := p_product_ids;
  ELSE
    SELECT coalesce(array_agg(product_id), '{}'::uuid[])
      INTO v_ids
      FROM (
        SELECT product_id
          FROM public.gacha_product_search_dirty
         ORDER BY queued_at
         LIMIT greatest(p_batch_limit, 0)
         FOR UPDATE SKIP LOCKED
      ) q;
  END IF;

  IF v_ids IS NULL OR cardinality(v_ids) = 0 THEN
    RETURN 0;
  END IF;

  -- 삭제된 상품이 큐에 남아 있을 수 있으므로 문서도 함께 정리한다.
  DELETE FROM public.gacha_product_search_docs d
   WHERE d.product_id = ANY (v_ids)
     AND NOT EXISTS (SELECT 1 FROM public.gacha_products p WHERE p.id = d.product_id);

  INSERT INTO public.gacha_product_search_docs (
    product_id, doc_primary, doc_series, doc_variant, doc_code, doc_all,
    doc_fuzzy, has_variant, updated_at
  )
  SELECT
    gp.id,
    src.doc_primary,
    src.doc_series,
    src.doc_variant,
    src.doc_code,
    src.doc_primary || src.doc_series || src.doc_variant || src.doc_code,
    src.doc_fuzzy,
    src.has_variant,
    now()
  FROM public.gacha_products gp
  -- 변형은 status='active' 인 것만 넣는다.
  -- search_gacha_products는 SECURITY DEFINER라 RLS를 우회하므로, 여기서
  -- 걸러 두지 않으면 hidden/archived 변형 이름으로 상품이 검색된다.
  -- (아래 src가 v를 참조하므로 반드시 src보다 먼저 와야 한다)
  LEFT JOIN LATERAL (
    SELECT
      public.gacha_normalize_search_text(
        string_agg(concat_ws(' ', gv.name, gv.name_ja, gv.name_ko, gv.name_en), ' ')
      ) AS doc_variant,
      public.gacha_normalize_search_text_ws(
        string_agg(concat_ws(' ', gv.name, gv.name_ja, gv.name_ko, gv.name_en), ' ')
      ) AS doc_variant_ws,
      count(*) > 0 AS has_variant
    FROM public.gacha_product_variants gv
    WHERE gv.product_id = gp.id
      AND gv.status = 'active'
  ) v ON true
  CROSS JOIN LATERAL (
    SELECT
      public.gacha_normalize_search_text(
        concat_ws(' ', gp.name, gp.name_ja, gp.name_ko, gp.name_en)
      ) AS doc_primary,
      public.gacha_normalize_search_text(
        concat_ws(' ',
          gp.name_parts -> 'series' ->> 'ja',
          gp.name_parts -> 'series' ->> 'ko',
          gp.name_parts -> 'product_type' ->> 'ja',
          gp.name_parts -> 'product_type' ->> 'ko',
          gp.name_parts ->> 'version',
          (
            SELECT string_agg(tag, ' ')
              FROM jsonb_array_elements_text(
                     CASE
                       WHEN jsonb_typeof(gp.name_parts -> 'tags') = 'array'
                         THEN gp.name_parts -> 'tags'
                       ELSE '[]'::jsonb
                     END
                   ) AS tag
          )
        )
      ) AS doc_series,
      coalesce(v.doc_variant, '') AS doc_variant,
      public.gacha_normalize_search_text(
        concat_ws(' ', gp.jan_code, gp.product_code)
      ) AS doc_code,
      -- 유사도용: 같은 내용을 공백 유지로 한 번 더 만든다.
      public.gacha_normalize_search_text_ws(
        concat_ws(' ',
          gp.name, gp.name_ja, gp.name_ko, gp.name_en,
          gp.name_parts -> 'series' ->> 'ja',
          gp.name_parts -> 'series' ->> 'ko',
          gp.name_parts -> 'product_type' ->> 'ja',
          gp.name_parts -> 'product_type' ->> 'ko',
          (
            SELECT string_agg(tag, ' ')
              FROM jsonb_array_elements_text(
                     CASE
                       WHEN jsonb_typeof(gp.name_parts -> 'tags') = 'array'
                         THEN gp.name_parts -> 'tags'
                       ELSE '[]'::jsonb
                     END
                   ) AS tag
          ),
          v.doc_variant_ws
        )
      ) AS doc_fuzzy,
      coalesce(v.has_variant, false) AS has_variant
  ) src
  WHERE gp.id = ANY (v_ids)
  ON CONFLICT (product_id) DO UPDATE
    SET doc_primary = excluded.doc_primary,
        doc_series  = excluded.doc_series,
        doc_variant = excluded.doc_variant,
        doc_code    = excluded.doc_code,
        doc_all     = excluded.doc_all,
        doc_fuzzy   = excluded.doc_fuzzy,
        has_variant = excluded.has_variant,
        updated_at  = excluded.updated_at;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  DELETE FROM public.gacha_product_search_dirty
   WHERE product_id = ANY (v_ids);

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.refresh_gacha_product_search_docs(uuid[], integer) IS
  '검색 문서 재계산. 인자 없으면 dirty 큐 배치 처리. collector는 ingest 직후 호출할 것.';

-- ⚠️ SECURITY DEFINER 함수는 생성 시 EXECUTE가 기본 부여된다.
-- 이 함수는 상품 전체를 재계산할 수 있어 anon이 반복 호출하면 부하 공격이 된다.
-- Supabase는 ALTER DEFAULT PRIVILEGES로 public 스키마의 새 함수에 대해
-- anon/authenticated에게 "직접" EXECUTE를 준다. 그래서 FROM PUBLIC 만으로는
-- 회수되지 않고, 반드시 두 역할에서 명시적으로 회수해야 한다.
-- cron 잡은 postgres 권한으로 돌기 때문에 별도 GRANT가 필요 없다.
REVOKE ALL ON FUNCTION public.refresh_gacha_product_search_docs(uuid[], integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_gacha_product_search_docs(uuid[], integer) TO service_role;

-- ---------------------------------------------------------------------------
-- 6) 큐 적재 트리거
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.queue_gacha_product_search_refresh()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_product_id uuid;
BEGIN
  -- gacha_products 트리거면 행의 id, gacha_product_variants 트리거면 product_id.
  IF TG_TABLE_NAME = 'gacha_products' THEN
    v_product_id := coalesce(NEW.id, OLD.id);
  ELSE
    v_product_id := coalesce(NEW.product_id, OLD.product_id);
  END IF;

  IF v_product_id IS NOT NULL THEN
    INSERT INTO public.gacha_product_search_dirty (product_id)
    VALUES (v_product_id)
    ON CONFLICT (product_id) DO NOTHING;
  END IF;

  RETURN NULL;  -- AFTER 트리거라 반환값은 무시된다
END;
$$;

-- 트리거 함수는 트리거를 통해서만 실행되면 된다. 직접 호출 경로를 막는다.
REVOKE ALL ON FUNCTION public.queue_gacha_product_search_refresh()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS gacha_products_search_refresh ON public.gacha_products;
CREATE TRIGGER gacha_products_search_refresh
  AFTER INSERT OR DELETE OR UPDATE OF
    name, name_ja, name_ko, name_en, jan_code, product_code, name_parts, status
  ON public.gacha_products
  FOR EACH ROW
  EXECUTE FUNCTION public.queue_gacha_product_search_refresh();

DROP TRIGGER IF EXISTS gacha_product_variants_search_refresh ON public.gacha_product_variants;
CREATE TRIGGER gacha_product_variants_search_refresh
  AFTER INSERT OR DELETE OR UPDATE OF
    name, name_ja, name_ko, name_en, product_id, status
  ON public.gacha_product_variants
  FOR EACH ROW
  EXECUTE FUNCTION public.queue_gacha_product_search_refresh();

-- ---------------------------------------------------------------------------
-- 7) 초기 백필
-- ---------------------------------------------------------------------------
-- 상품 전체를 한 번 계산해 둔다. 큐를 거치지 않고 직접 처리한다.
-- status에 관계없이 전부 넣는 이유: hidden 상품이 나중에 active로 바뀔 때
-- 문서가 없으면 검색에서 누락된다. 활성 필터는 검색 RPC가 담당한다.
DO $$
DECLARE
  v_ids uuid[];
BEGIN
  SELECT coalesce(array_agg(id), '{}'::uuid[])
    INTO v_ids
    FROM public.gacha_products;

  IF cardinality(v_ids) > 0 THEN
    PERFORM public.refresh_gacha_product_search_docs(v_ids);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 8) 주기 배치
-- ---------------------------------------------------------------------------
-- 2분 주기. 신규/수정 상품의 검색 반영 지연 상한이 2분이라는 뜻이다.
-- 즉시 반영이 필요하면 collector가 refresh_gacha_product_search_docs(ids)를 직접 호출한다.
SELECT cron.schedule(
  'refresh-gacha-search-docs',
  '*/2 * * * *',
  $cron$ SELECT public.refresh_gacha_product_search_docs(); $cron$
);

COMMIT;
