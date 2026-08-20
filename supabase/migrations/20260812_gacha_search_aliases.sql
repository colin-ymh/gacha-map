-- 가챠 검색 별칭 사전
--
-- 배경: `먼작귀`(→치이카와), `나히아`(→나의히어로아카데미아) 같은 커뮤니티 약칭은
-- 정식 명칭과 공통 문자가 거의 없어 trigram 유사도로는 절대 매칭되지 않는다.
-- 사전이 유일한 해법이다.
--
-- 별칭은 특정 상품이 아니라 "검색어 → 정식 명칭" 매핑으로 둔다.
-- 상품에 직접 연결하지 않기 때문에 신규 상품이 들어와도 재연결이 필요 없다.
-- 검색 시 질의어를 canonical_terms로 확장한 뒤 기존 문서 매칭에 태운다.
--
-- 데이터는 gacha-collector가 LLM으로 생성해 status='pending'으로 적재하고,
-- 어드민이 승인해야 status='approved'가 되어 검색에 반영된다.
-- 계약 상세: docs/collector-handoff/20260812-search-alias-generation.md
--
-- 실행 전 예상 영향:
--   - 신규 테이블 1개, 신규 함수 2개, 트리거 2개, 정책 2개.
--   - 데이터 행 생성 0건. 승인된 별칭이 없는 동안 검색 동작은 그대로다.
-- 재실행 시: IF NOT EXISTS / CREATE OR REPLACE 라 멱등하다.

BEGIN;

CREATE TABLE IF NOT EXISTS public.gacha_search_aliases (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 사용자가 실제로 입력할 법한 검색어. 예: '먼작귀'
  alias           text NOT NULL,
  -- 정규화본. 질의어도 같은 함수를 통과하므로 이 값으로 정확 일치 조회한다.
  alias_norm      text GENERATED ALWAYS AS (public.gacha_normalize_search_text(alias)) STORED,
  -- 확장될 정식 명칭들. 표시용 원문. 예: {'치이카와','ちいかわ'}
  canonical_terms text[] NOT NULL,
  -- 위의 정규화본. 매칭에 실제로 쓰인다. BEFORE 트리거가 파생한다.
  canonical_norms text[] NOT NULL DEFAULT '{}',
  alias_type      text NOT NULL CHECK (alias_type IN
                    ('abbreviation','nickname','romaji','typo','translation','character')),
  locale          text CHECK (locale IN ('ko','ja','en')),
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','rejected')),
  source          text NOT NULL CHECK (source IN ('collector_llm','manual','user_log')),
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gacha_search_aliases_alias_not_blank CHECK (btrim(alias) <> ''),
  CONSTRAINT gacha_search_aliases_canonical_not_empty CHECK (cardinality(canonical_terms) > 0)
);

COMMENT ON TABLE public.gacha_search_aliases IS
  '가챠 검색어 별칭 사전. status=approved 만 검색에 반영된다. collector가 pending으로 적재.';

-- 유니크를 approved에만 건다.
-- pending 후보는 같은 alias로 여러 건 공존해야 어드민이 그중 하나를 고를 수 있다.
-- (전체에 유니크를 걸면 먼저 들어온 나쁜 후보가 더 나은 후보를 막는다)
CREATE UNIQUE INDEX IF NOT EXISTS gacha_search_aliases_approved_alias_key
  ON public.gacha_search_aliases (alias_norm)
  WHERE status = 'approved';

CREATE INDEX IF NOT EXISTS gacha_search_aliases_status_idx
  ON public.gacha_search_aliases (status);

-- ---------------------------------------------------------------------------
-- canonical_norms 파생 트리거
-- ---------------------------------------------------------------------------
-- 배열이라 GENERATED ALWAYS AS 로는 만들 수 없어서 트리거로 파생한다.
-- 빈 문자열로 정규화되는 항목은 매칭에 무의미하므로 버린다.
CREATE OR REPLACE FUNCTION public.derive_gacha_search_alias_norms()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
BEGIN
  SELECT coalesce(array_agg(DISTINCT n), '{}'::text[])
    INTO NEW.canonical_norms
    FROM unnest(NEW.canonical_terms) AS t
   CROSS JOIN LATERAL public.gacha_normalize_search_text(t) AS n
   WHERE n <> '';

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS gacha_search_aliases_derive_norms ON public.gacha_search_aliases;
CREATE TRIGGER gacha_search_aliases_derive_norms
  BEFORE INSERT OR UPDATE OF canonical_terms
  ON public.gacha_search_aliases
  FOR EACH ROW
  EXECUTE FUNCTION public.derive_gacha_search_alias_norms();

-- updated_at 은 기존 공통 트리거를 재사용한다.
DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
     WHERE proname = 'update_updated_at'
       AND pg_function_is_visible(oid)
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgname = 'gacha_search_aliases_updated_at'
       AND tgrelid = 'public.gacha_search_aliases'::regclass
  ) THEN
    CREATE TRIGGER gacha_search_aliases_updated_at
      BEFORE UPDATE ON public.gacha_search_aliases
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at();
  END IF;
END $do$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.gacha_search_aliases ENABLE ROW LEVEL SECURITY;

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'gacha_search_aliases'
       AND policyname = 'public can view approved gacha_search_aliases'
  ) THEN
    CREATE POLICY "public can view approved gacha_search_aliases"
      ON public.gacha_search_aliases
      FOR SELECT
      TO public
      USING (status = 'approved');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'gacha_search_aliases'
       AND policyname = 'admins can manage gacha_search_aliases'
  ) THEN
    CREATE POLICY "admins can manage gacha_search_aliases"
      ON public.gacha_search_aliases
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles
           WHERE user_profiles.id = auth.uid()
             AND user_profiles.role = 'admin'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.user_profiles
           WHERE user_profiles.id = auth.uid()
             AND user_profiles.role = 'admin'
        )
      );
  END IF;
END $do$;

GRANT SELECT ON public.gacha_search_aliases TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.gacha_search_aliases TO authenticated;

-- ---------------------------------------------------------------------------
-- 정규화 함수 변경 시 재계산
-- ---------------------------------------------------------------------------
-- gacha_normalize_search_text() 는 IMMUTABLE 로 선언돼 있고 alias_norm/doc_* 는
-- 쓰기 시점에 계산돼 저장된다. 즉 함수 정의를 바꿔도 기존 값은 옛 규칙 그대로 남는다.
-- 함수를 수정했다면 반드시 이 함수를 실행해 전체를 재계산해야 한다.
CREATE OR REPLACE FUNCTION public.rebuild_gacha_search_norms()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_ids uuid[];
BEGIN
  -- alias_norm(generated) 과 canonical_norms(trigger) 를 함께 재계산시킨다.
  UPDATE public.gacha_search_aliases
     SET canonical_terms = canonical_terms;

  SELECT coalesce(array_agg(id), '{}'::uuid[])
    INTO v_ids
    FROM public.gacha_products;

  IF cardinality(v_ids) > 0 THEN
    PERFORM public.refresh_gacha_product_search_docs(v_ids);
  END IF;
END;
$fn$;

COMMENT ON FUNCTION public.rebuild_gacha_search_norms() IS
  'gacha_normalize_search_text() 정의를 바꾼 뒤 반드시 실행. 저장된 정규화 값 전체 재계산.';

-- ⚠️ SECURITY DEFINER 함수는 생성 시 PUBLIC에게 EXECUTE가 기본 부여된다.
-- 이 함수는 별칭 전체 + 검색 문서 전체를 재작성하므로 anon이 반복 호출하면
-- 그대로 부하 공격이 된다. PUBLIC 권한을 회수하고 운영 주체에게만 남긴다.
-- Supabase는 anon/authenticated 에게 직접 EXECUTE 를 주므로 FROM PUBLIC 만으로는
-- 회수되지 않는다. 두 역할에서 명시적으로 회수한다.
REVOKE ALL ON FUNCTION public.rebuild_gacha_search_norms() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rebuild_gacha_search_norms() TO service_role;

-- 별칭 정규화 트리거 함수도 직접 호출 경로를 막는다.
REVOKE ALL ON FUNCTION public.derive_gacha_search_alias_norms()
  FROM PUBLIC, anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
