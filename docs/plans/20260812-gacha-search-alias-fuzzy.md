# 가챠 상품 검색 개선 — 별칭 사전 + pg_trgm 유사도 + 변형(상세) 상품명

> v2 — codex adversarial review 반영본. BLOCKER 3건 + MAJOR 8건 수정 완료.

## Context

현재 가챠 상품 검색은 `search_gacha_products` RPC의 순수 `ILIKE '%q%'` 하나뿐이다
(`supabase/migrations/20260630_gacha_product_name_parts.sql:70-86`).

- **오타 불가** — `치이가와` 입력 시 0건
- **별칭 불가** — `먼작귀`, `나히아`는 정식 명칭과 공통 문자가 0. 어떤 문자열 유사도로도 안 풀린다 → **사전 필수**
- **상세(변형) 상품명 검색 불가** — `gacha_product_variants` 29,363행이 검색에서 완전히 배제됨
- **다중 토큰 불가** — `치이카와 마스코트`가 `치이카와 하트 러버 마스코트`를 못 찾는다
- **랭킹 없음** — `ORDER BY release_month DESC`. 정확히 일치한 상품이 뒤로 밀림

3층으로 나눈다.

| 층                           | 해결 대상                                        | 담당                                                   |
| ---------------------------- | ------------------------------------------------ | ------------------------------------------------------ |
| A. 별칭 사전                 | `먼작귀→치이카와`, `나히아→나의히어로아카데미아` | 스키마·확장 로직 = 우리 / **데이터 = gacha-collector** |
| B. pg_trgm 유사도 + 토큰 AND | 오타, 부분 일치, `별칭 + 추가어` 복합 질의       | 우리                                                   |
| C. 변형(상세) 상품명         | `gacha_product_variants` 4개 이름 컬럼           | 우리 (데이터 이미 존재)                                |

**활용 자산**: `name_parts.series.{ja,ko}`가 이미 채워져 있어(예: `{"ja":"ちいかわ","ko":"치이카와"}`)
별칭의 정식 명칭 앵커로 그대로 쓴다.

**검증된 환경 사실**

- PG 17.6. `normalize()` volatility = `i`(IMMUTABLE) → generated column 사용 가능 (dev에서 확인)
- pg_trgm 미설치(설치 가능), pg_cron 설치됨
- `gacha_product_variants` 실제 컬럼: `name`, `normalized_name`, `name_ja`, `name_ko`, `name_en`, `status` …
  (마이그레이션 파일보다 컬럼이 많다 — 반드시 실제 스키마 기준으로 작업)
- `/api/gacha-products`는 `createClient()` = **anon 키**. service role은 `createAdminClient()` (`apps/web/src/lib/supabase/server.ts:34`)
- `NOTIFY pgrst, 'reload schema';` 는 기존 마이그레이션 9개에서 쓰는 필수 관례
- 활성 상품 12,372 / 변형 29,363(name_ko 23,510) / name_parts 있는 상품 10,014

**사용자 결정**: 범위 = DB+API+모바일 / pg_trgm 승인(dev→prod) / 별칭 데이터는 collector LLM 자동
생성(수동 시드 없음) / 검색어 로깅은 익명만.

---

## Scope

**Phase A — DB (기획서 불필요)**: pg_trgm, 정규화 함수, 검색 도큐먼트 + dirty queue, 별칭 테이블, RPC v2
**Phase B — Web API (기획서 불필요)**: `/api/gacha-products` 연동, `has_variants+q` 버그 수정
**Phase C — 모바일 무변화 배선 (기획서 불필요)**: shared 타입 확장, 훅이 신규 필드 파싱. **화면 변화 0**
**Phase D — collector 핸드오프 문서**
**Phase E — 모바일 신규 UI**: ❌ **이번 범위 제외 (사용자 결정)**. Notion 기획서 + Penpot 선행 필요
**Phase F — 검색어 로그**: ❌ **컷 (사용자 결정)**. collector가 로그 마이닝을 실제로 쓸 때 추가

## Out of Scope

- 별칭 **데이터** 생성 (collector 담당)
- pgvector 시맨틱 검색 (12k 행에 과잉, 슬랭 별칭도 못 풂), pgroonga
- 샵(shop) 검색
- 초성 검색(ㅊㅇㅋㅇ)

---

## ⚠️ 선행 확인 필요 — Phase E 차단

CLAUDE.md Spec Rule: _기획서 없이 UI 작업 불가, UI(Penpot) 없이 프론트 개발 불가._

Notion `🔍 가챠 검색 기획`(app.notion.com/p/373203d520db811b85dcee9729af857f) 확인 결과 —
카드 표시 항목·빈 상태·정렬 정책은 있으나 **별칭 안내 칩, 유사 검색 안내, 변형명 표시에 대한 기획은 없다.**

→ **Phase A~D는 즉시 착수 가능**(백엔드 계약, 화면 변화 없음).
→ **Phase E는 기획서 §추가 + Penpot 디자인 후 별도 세션.** 이 계획서에는 요구사항만 남긴다.

---

## Relevant Files

- `supabase/migrations/20260630_gacha_product_name_parts.sql` — 현행 RPC
- `supabase/migrations/20260626_add_gacha_product_variants_and_extraction_results.sql` — admin RLS 패턴, `NOTIFY pgrst`
- `supabase/migrations/20260811_purge_scan_images_cron.sql` — pg_cron 패턴
- `apps/web/src/app/api/gacha-products/route.ts:106,270,286-348` — `hasVariants`, RPC 분기
- `apps/web/src/lib/supabase/server.ts:34` — `createAdminClient()`
- `apps/mobile/hooks/useGachaProductSearch.ts` / `packages/shared/src/types/index.ts:207-253`
- 호출부: `apps/mobile/app/shop-search.tsx`, `components/organisms/search/SearchOverlay.tsx`,
  `app/(tabs)/index.tsx`, `app/(tabs)/map.tsx` — Phase E에서 `appliedAlias` 전달 지점 결정

---

## Plan

### Phase A — 마이그레이션 (dev 먼저)

#### A1. `20260812_gacha_search_foundation.sql`

**확장**

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
```

**정규화 함수** (regexp는 dev PG17.6에서 파싱 검증 완료 — `Ａ-Ｂ_Ｃ%[]\・（テスト）` → `abcテスト`)

```sql
CREATE OR REPLACE FUNCTION public.gacha_normalize_search_text(p text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT regexp_replace(
    lower(normalize(coalesce(p, ''), NFKC)),
    '[[:space:]_/.,''"!?&·・:()（）\[\]【】%\\-]', '', 'g'
  );
$$;
```

- `NFKC`: 전각→반각, 가나 호환자 통일, **한글 NFD→NFC**까지 처리
- `%` `_` `\` 제거 → 이후 LIKE 와일드카드 주입 불가. `-`는 문자군 끝에 배치
- 마이그레이션 주석에 위 검증 SQL을 남긴다
- ⚠️ **이 함수 정의를 나중에 바꾸면 저장된 `alias_norm`/`doc_*`은 자동 재계산되지 않는다.**
  A4의 `rebuild_gacha_search_norms()` 를 반드시 함께 실행. 마이그레이션 상단에 경고 주석 필수

**검색 도큐먼트**

```sql
CREATE TABLE public.gacha_product_search_docs (
  product_id  uuid PRIMARY KEY REFERENCES public.gacha_products(id) ON DELETE CASCADE,
  doc_primary text NOT NULL DEFAULT '',  -- name, name_ja, name_ko, name_en
  doc_series  text NOT NULL DEFAULT '',  -- name_parts.series.{ja,ko} + tags + product_type.{ja,ko}
  doc_variant text NOT NULL DEFAULT '',  -- active 변형의 name, name_ja, name_ko, name_en
  doc_code    text NOT NULL DEFAULT '',  -- jan_code, product_code
  doc_all     text NOT NULL DEFAULT '',
  has_variant boolean NOT NULL DEFAULT false,  -- active 변형 존재 여부 (has_variants 필터용)
  updated_at  timestamptz NOT NULL DEFAULT now()
);
```

- 모든 `doc_*` 는 `gacha_normalize_search_text()` 통과값 저장. 질의어도 같은 함수 통과 → 일관 매칭
- `doc_variant` 는 **`status='active'` 변형만**. RPC가 SECURITY DEFINER라 RLS를 우회하므로
  필터를 명시하지 않으면 hidden/archived 변형명으로 상품이 검색된다
- 인덱스: `doc_all`, `doc_primary` 에 `USING gin (col extensions.gin_trgm_ops)`
- RLS 활성화 + **정책 0개**. SECURITY DEFINER RPC(테이블 소유자 권한)만 읽는다

**Dirty queue + 배치 refresh** (row trigger로 aggregate 돌리면 collector 벌크 쓰기가 죽는다)

```sql
CREATE TABLE public.gacha_product_search_dirty (
  product_id uuid PRIMARY KEY,
  queued_at  timestamptz NOT NULL DEFAULT now()
);
```

- `gacha_products` / `gacha_product_variants` 양쪽에 `AFTER INSERT OR UPDATE OR DELETE FOR EACH ROW` 트리거.
  하는 일은 `INSERT INTO ...dirty VALUES (product_id) ON CONFLICT DO NOTHING` 뿐 — **O(1), aggregate 없음**
- `gacha_products` 트리거는 `UPDATE OF (name, name_ja, name_ko, name_en, jan_code, product_code, name_parts, status)` 로 한정
- `refresh_gacha_product_search_docs(p_product_ids uuid[] DEFAULT NULL, p_batch_limit int DEFAULT 5000)`
  - 인자가 있으면 그 상품만, 없으면 dirty queue에서 `p_batch_limit` 만큼 뽑아 처리 후 큐에서 삭제
  - collector가 ingest 직후 직접 호출해 즉시 반영 가능 (트리거 비활성화 필요 없음 — 별도 저장소 service_role은 소유자 권한이 없어 애초에 불가능)
- pg_cron 2분 주기로 `SELECT public.refresh_gacha_product_search_docs();`
  → **최대 2분 신선도 지연**. 검색 용도로 허용
- 마이그레이션 말미: 전체 상품을 dirty에 넣고 `refresh(NULL, 999999)` 로 초기 백필

#### A2. `20260812_gacha_search_aliases.sql`

```sql
CREATE TABLE public.gacha_search_aliases (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alias           text NOT NULL,
  alias_norm      text GENERATED ALWAYS AS (public.gacha_normalize_search_text(alias)) STORED,
  canonical_terms text[] NOT NULL,   -- 원문 (표시용)
  canonical_norms text[] NOT NULL,   -- 정규화본 (매칭용) — BEFORE 트리거로 파생
  alias_type      text NOT NULL CHECK (alias_type IN
                    ('abbreviation','nickname','romaji','typo','translation','character')),
  locale          text CHECK (locale IN ('ko','ja','en')),
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','rejected')),
  source          text NOT NULL CHECK (source IN ('collector_llm','manual','user_log')),
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
-- approved 만 유니크. pending 후보는 같은 alias로 여러 건 공존 → 어드민이 고른다
CREATE UNIQUE INDEX gacha_search_aliases_approved_alias_key
  ON public.gacha_search_aliases (alias_norm) WHERE status = 'approved';
CREATE INDEX gacha_search_aliases_lookup_idx
  ON public.gacha_search_aliases (alias_norm) WHERE status = 'approved';
```

- RLS: `SELECT USING (status = 'approved')` (anon/authenticated) + admin 전체 관리 정책
  (`20260626_...:152` 패턴 복사). collector는 service_role → RLS 우회
- `updated_at` 은 기존 `public.update_updated_at` 트리거 재사용

#### A3. `20260812_search_gacha_products_v2.sql` — RPC 교체

```sql
DROP FUNCTION IF EXISTS public.search_gacha_products(text,text,integer,integer);

CREATE FUNCTION public.search_gacha_products(
  q               text    DEFAULT '',
  p_manufacturer  text    DEFAULT NULL,
  p_limit         integer DEFAULT 20,
  p_offset        integer DEFAULT 0,
  p_fuzzy         boolean DEFAULT true,
  p_min_similarity real   DEFAULT 0.4,
  p_has_variants  boolean DEFAULT false
) RETURNS TABLE (
  /* 기존 21개 컬럼 전부 동일 */
  total_count          bigint,
  match_score          real,
  match_kind           text,   -- exact|prefix|primary|series|code|variant|fuzzy
  matched_aliases      jsonb,  -- [{"alias":"먼작귀","canonical_terms":["치이카와","ちいかわ"]}]
  matched_variant_name text
)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp;
```

**질의 처리 — 토큰 분해 + 별칭 확장 (BLOCKER 수정 핵심)**

1. `v_tokens := 원문 q 를 공백으로 split → 각 토큰을 gacha_normalize_search_text() → 빈 값 제거 → 최대 5개`
2. `v_phrase := gacha_normalize_search_text(q)` (전체를 붙인 형태)
3. 토큰별 확장: `v_expand[i] := ARRAY[tok_i] || approved alias(alias_norm = tok_i).canonical_norms`
4. phrase 확장: `v_phrase_expand := ARRAY[v_phrase] || approved alias(alias_norm = v_phrase).canonical_norms`
5. `v_aliases jsonb` := 위 4·5에서 실제로 적중한 별칭들의 `{alias, canonical_terms}` 배열

> 이게 `먼작귀 키홀더` → `(치이카와 OR ちいかわ) AND 키홀더` 를 만든다.
> 토큰 분해 없이 alias_norm 정확 일치만 하면 이 질의는 0건이 된다.

**임계값 (BLOCKER 수정)**

```sql
PERFORM set_config('pg_trgm.word_similarity_threshold', p_min_similarity::text, true);
```

- `set_limit()` 은 `%` 용 `similarity_threshold` 만 바꾼다. `<%` 는 `word_similarity_threshold`(기본 0.6)를 본다 → 그대로 두면 `p_min_similarity` 가 무시된다
- **추가로 스코어 계산부에 `word_similarity(t, doc) >= p_min_similarity` 를 명시**해 GUC에 정합성을 의존하지 않는다

**매칭 조건** — `phrase 매칭 OR 모든 토큰 매칭`

- phrase: `EXISTS (SELECT 1 FROM unnest(v_phrase_expand) v WHERE d.doc_all LIKE '%'||v||'%')`
- token-AND: 모든 `i` 에 대해 `EXISTS (SELECT 1 FROM unnest(v_expand[i]) v WHERE d.doc_all LIKE '%'||v||'%' OR (p_fuzzy AND v <% d.doc_all))`
- `p_manufacturer` 필터, `gp.status='active'`, `p_has_variants` 이면 `d.has_variant`

**스코어** — 하나의 term `t` 에 대한 점수 `s(t)`:

| 조건                                                  | s(t)     | match_kind |
| ----------------------------------------------------- | -------- | ---------- |
| `doc_primary = t`                                     | 5.0      | exact      |
| `doc_primary LIKE t \|\| '%'`                         | 4.0      | prefix     |
| `doc_primary LIKE '%'\|\|t\|\|'%'`                    | 3.0      | primary    |
| `doc_code LIKE '%'\|\|t\|\|'%'`                       | 2.5      | code       |
| `doc_series LIKE '%'\|\|t\|\|'%'`                     | 2.5      | series     |
| `doc_variant LIKE '%'\|\|t\|\|'%'`                    | 2.0      | variant    |
| `word_similarity(t, doc_primary) >= p_min_similarity` | 1.0 + ws | fuzzy      |
| `word_similarity(t, doc_all) >= p_min_similarity`     | 0.5 + ws | fuzzy      |
| 그 외                                                 | 0        | —          |

- `phrase_score := max(s(v) for v in v_phrase_expand)`
- `token_score  := min over i of (max(s(v) for v in v_expand[i])) * 0.9`
  — 최약 토큰 기준(weakest link). ×0.9로 정확 phrase가 항상 앞선다
- `match_score := greatest(phrase_score, token_score)`, `match_kind` 는 이긴 쪽의 kind

**정렬 / 페이징**

- `ORDER BY match_score DESC, gp.release_month DESC NULLS LAST, gp.name ASC`
- `COUNT(*) OVER()` 는 **LIMIT 이전 CTE**에서 계산 (총건수 정확)
- `matched_variant_name` 은 **LIMIT 적용 후 바깥 쿼리에서 LATERAL 조회**.
  안쪽에 두면 전체 매칭셋에 대해 변형 테이블을 뒤진다. `status='active'` 필터 필수
- `q` 가 빈 값이면 기존 목록 동작 유지 (`match_score` = 0, `matched_aliases` = `'[]'`)

**마이그레이션 말미**: `NOTIFY pgrst, 'reload schema';` — 없으면 PostgREST가 새 시그니처를 모른다

#### A4. 정규화 함수 drift 대비

`rebuild_gacha_search_norms()` — `gacha_normalize_search_text` 정의를 바꿀 때 실행:

- `UPDATE gacha_search_aliases SET alias = alias;` (generated `alias_norm` 재계산) + `canonical_norms` 재파생
- 전체 상품을 dirty queue에 재적재 후 `refresh_gacha_product_search_docs()`

### Phase B — Web API

`apps/web/src/app/api/gacha-products/route.ts`

- RPC 호출에 `p_fuzzy`, `p_min_similarity`, **`p_has_variants: hasVariants`** 전달
- **버그 수정**: 현재 `hasVariants`는 line 270 PostgREST 쿼리에만 적용되고 line 286 RPC 분기에서는 무시된다.
  `has_variants=true&q=...` 조합(모바일 `app/(tabs)/index.tsx`가 직접 호출)이 필터 없이 응답 중.
  RPC의 `p_has_variants` 로 처리
- `toPostgrestSearchTerm()` 은 **RPC 경로에서 제거** (정규화·이스케이프가 SQL로 이관). PostgREST 폴백 경로엔 유지
- 응답: 상품별 `match_score` / `match_kind` / `matched_variant_name` 통과 +
  최상위 `applied_aliases` (row[0]의 `matched_aliases`를 끌어올림, 없으면 `[]`)
- 기존 route 단위 테스트가 있으면 함께 갱신

### Phase C — 모바일 배선 (화면 변화 없음)

- `packages/shared/src/types/index.ts`: `GachaProduct` 에 optional `match_score?`, `match_kind?`,
  `matched_variant_name?` 추가. `GachaSearchResponse { products, total, offset, limit, applied_aliases }`
- `apps/mobile/hooks/useGachaProductSearch.ts`: `applied_aliases` 파싱 → `appliedAliases` 반환값 추가.
  페이지 병합 시 첫 페이지 값 유지
- **UI 렌더링 변경 없음.** 사용자 체감 개선은 "검색이 더 잘 됨"으로만 나타난다 → 기획서 불필요

### Phase D — gacha-collector 핸드오프

`docs/collector-handoff/20260812-search-alias-generation.md` (기존 `20260720-weekly-product-collection.md` 형식)

1. **쓰기 대상**: `public.gacha_search_aliases`, `source='collector_llm'`, `status='pending'` (전체 컬럼·CHECK 명시)
2. **입력**: `SELECT DISTINCT name_parts->'series'->>'ko', ->>'ja' FROM gacha_products WHERE status='active'`
3. **LLM 스펙**: 시리즈당 한국어 커뮤니티 약칭·별명·로마자·흔한 오타 배열.
   예 — `나의히어로아카데미아` → `나히아`,`히로아카`,`MHA` / `ちいかわ` → `먼작귀`,`치이카와`,`치카와`
4. **품질 가드**: alias 2자 이상 / 범용어 블록리스트(`피규어`,`캡슐`,`가샤폰`,`마스코트`,`키홀더`,`아크릴`…) 금지 /
   타 시리즈 정식 명칭과 충돌 시 폐기 / 같은 alias의 pending 중복은 skip
5. **승인 흐름**: `pending` 적재 → 어드민 승인 시 `approved`. 승인 전엔 검색 무영향
6. **ingest 후 필수 호출**: `SELECT public.refresh_gacha_product_search_docs();`
   (트리거 비활성화 시도 금지 — service_role에 소유자 권한 없음)
7. **백필 요청**: `name_parts` 없는 상품 2,358건 시리즈/태그 채우기 / 변형 `name_ko` 미번역 5,853건 번역

### Phase E — 모바일 신규 UI ❌ 이번 범위 제외

사용자 결정으로 보류. **구현하지 않는다.** 착수 조건: Notion `🔍 가챠 검색 기획`에 절 추가 → Penpot → 별도 세션.

다음 세션을 위한 요구사항 메모:

- 별칭 안내 칩 — `'먼작귀' → '치이카와' 검색 결과`
- `match_kind='variant'` 카드에 `상세: {matched_variant_name}` 한 줄
- 표시 지점 결정 필요: `shop-search.tsx`, `SearchOverlay.tsx`(부모 `app/(tabs)/index.tsx`·`map.tsx` 경유),
  API 직접 호출 모달들 — 어디에 노출하고 어디서 무시할지
- i18n 신규 키를 `messages/{en,ja,ko,zh}.json` 4개 전부 / 색상은 `constants/colors.ts` import
- 구현 후 Penpot 동기화

> Phase C에서 API 필드는 이미 훅까지 흘려두므로, 다음 세션은 렌더링만 붙이면 된다.

### Phase F — 검색어 로그 ❌ 컷

사용자 결정. collector가 로그 마이닝을 실제로 쓸 시점에 별도 계획으로 추가한다.
(당시 참고: 원문 미저장·정규화본 64자·user_id 없음·90일 purge, 기입은 `createAdminClient()`)

### Phase G — prod 적용

dev 검증 통과 → 사용자 승인 → prod 적용. **`main` 머지 전 완료** (CLAUDE.md).
배포 순서 **DB 먼저 → web 나중**. route는 이름 기반 필드 접근이라 구버전 web + 신버전 RPC 조합도 정상.

---

## Verification

### DB (dev, Supabase MCP `execute_sql`)

1. `SELECT (SELECT count(*) FROM gacha_product_search_docs) = (SELECT count(*) FROM gacha_products WHERE status='active');` → `true` (하드코딩 수치 비교 금지)
2. 정확 일치 우선: `search_gacha_products('치이카와')` → 1위 `match_kind IN ('exact','prefix')`, score 내림차순
3. **오타**: `search_gacha_products('치이가와')` → 0건 아님, `match_kind='fuzzy'`
4. **다중 토큰**: `search_gacha_products('치이카와 마스코트')` → 중간에 다른 단어가 낀 상품도 매칭
5. **변형명**: 실제 `gacha_product_variants.name_ko` 값으로 질의 → `match_kind='variant'` + `matched_variant_name` 채워짐
6. **hidden 변형 누출 차단**: 변형 1건을 `status='hidden'` 으로 바꾸고 refresh → 그 이름으로 검색 시 **0건**이어야 함 (원복)
7. **별칭 + 별칭+추가어**: dev에만 임시 approved 행 삽입
   `('먼작귀', ARRAY['치이카와','ちいかわ'], 'nickname','ko','approved','manual')` →
   `'먼작귀'`, `'먼작귀 키홀더'`, `'나히아 피규어'` 3종 질의 검증 + `matched_aliases` 확인 → **검증 후 삭제**
8. **임계값 실효 확인**: `p_min_similarity` 를 0.2 / 0.4 / 0.8 로 바꿔 결과 수가 실제로 달라지는지.
   안 달라지면 `word_similarity_threshold` 설정이 안 먹은 것
9. **has_variants**: `search_gacha_products('치이카와', NULL, 20, 0, true, 0.4, true)` → 전부 active 변형 보유
10. `EXPLAIN (ANALYZE, BUFFERS)` — `<%` / `LIKE` 각각 GIN trgm 사용 확인. **2자 질의**는 트라이그램 추출이 안 돼 full scan으로 퇴화하므로 별도 측정
11. **RLS**: anon 키로 `gacha_product_search_docs`, `gacha_search_aliases(status='pending')` 직접 SELECT → 0건/거부. RPC 경유는 정상
12. **회귀**: `q=''` 목록, `get_new_arrival_gacha()`, `get_daily_featured_gacha()`
13. `get_advisors(type='security')` 경고 없음
14. **PostgREST reload**: 마이그레이션 직후 REST로 `rpc/search_gacha_products` 신규 파라미터 호출이 404/400 없이 동작

### API

```
curl 'localhost:3000/api/gacha-products?q=치이가와&include_shops=true&limit=5'
curl 'localhost:3000/api/gacha-products?q=먼작귀%20키홀더&include_shops=true&limit=5'
curl 'localhost:3000/api/gacha-products?q=치이카와&has_variants=true&limit=5'   # 버그 수정 확인
curl 'localhost:3000/api/gacha-products?sort=new_arrivals&limit=5'              # 회귀
```

→ `applied_aliases`, `match_kind`, `matched_variant_name` 존재. `has_variants` 결과가 전부 변형 보유.

### 모바일 (Phase C 범위)

- expo 실행 → 검색 탭에서 오타/다중토큰 질의가 결과를 내는지. **UI 변화 없음이 정상**
- 무한 스크롤 2페이지 이상 로드 시 중복 없음, `appliedAliases` 유지
- 홈 화면 `has_variants` 사용 지점 회귀 확인

### 빌드

`rtk tsc`, `rtk lint`

---

## Risks / Questions

| 리스크                                                                                                                    | 대응                                                                        |
| ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **별칭 데이터 도착 전까지 `먼작귀`·`나히아`는 여전히 0건.** 체감 개선은 오타 허용 + 다중 토큰 + 변형명 검색 + 랭킹에 한정 | 사용자가 수동 시드를 제외한 결과. Phase D를 먼저 전달해 collector 병렬 착수 |
| **Phase E(별칭 칩·변형명 표시)가 이번에 빠져 시각적 변화가 없다**                                                         | 사용자 결정. 검색 품질 자체는 개선되나 "왜 이게 나왔는지" 안내는 다음 세션  |
| dirty queue 배치 → 신규 상품 검색 반영 최대 2분 지연                                                                      | collector가 ingest 직후 `refresh_*()` 직접 호출하면 즉시 반영               |
| 정규화 함수 정의 변경 시 저장된 norm이 stale                                                                              | `rebuild_gacha_search_norms()` 제공 + 함수 상단 경고 주석                   |
| 2자 질의는 trgm 인덱스 퇴화 → full scan                                                                                   | 12k 행이라 허용 범위. EXPLAIN으로 실측 후 필요 시 최소 길이 2 가드          |
| `p_min_similarity=0.4` 튜닝 필요                                                                                          | RPC 파라미터라 재배포 없이 조정 가능                                        |
| RPC DROP+CREATE                                                                                                           | 단일 트랜잭션. `NOTIFY pgrst` 필수                                          |
| prod 마이그레이션                                                                                                         | dev 검증 후 사용자 승인 받고 적용, `main` 머지 전 완료                      |

## 완료 조건

- [ ] pg_trgm 설치 + 정규화 함수 + 검색 도큐먼트 + dirty queue/배치 refresh (dev)
- [ ] `gacha_search_aliases` 테이블 + RLS (dev)
- [ ] RPC v2 — 토큰 AND + 별칭 확장 + `word_similarity_threshold` 실효 + active 변형만 + `p_has_variants` + `NOTIFY pgrst`
- [ ] Verification 1~14 전부 통과 (특히 4·6·7·8·9)
- [ ] `/api/gacha-products` 연동 + `has_variants&q` 버그 수정 + curl 4종 통과
- [ ] shared 타입 + 모바일 훅 배선, 화면 변화 0, `rtk tsc` / `rtk lint` 통과
- [ ] `docs/collector-handoff/20260812-search-alias-generation.md` 작성
- [ ] 사용자 승인 후 prod 마이그레이션 적용 (`main` 머지 전)
