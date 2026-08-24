# 가챠 택소노미(시리즈/카테고리) 정비 및 브라우징 기반 구축

작성일: 2026-08-21
작성: 메인 세션(Opus) / 검토: codex adversarial review 1회 반영

## Request

1. 가챠 상품의 **시리즈**와 **카테고리** 구조를 전수 파악한다.
2. 현재 구조가 **옳게 설계된 것인지** 판정한다.
3. 최종 목표는 UI에서 **카테고리별 탐색**, **애니메이션 시리즈별 탐색**을 제공하는 것이며, **검색 정확도 향상**에도 활용한다.
4. 시리즈 `kind` 분류 / 계층 부여는 **자동(LLM 분류)** 방식. (사용자 확정)
5. 관련 DDL은 **collector(gacha-collector 리포)에서 진행**되었다. (사용자 확정)

## 현황 조사 결과 (실측)

조사 대상: dev `epcsyfirxeqzjfnltcai`, prod `llawvidldrjjqwdbgfxh`, 리포 `gacha-map` / `gacha-collector`.

### 진실 소스가 둘로 갈려 있음

```
[A] gacha_products.name_parts (jsonb)          ← 현재 실제로 쓰이는 경로
      { series: {ja, ko, source}, product_type: {ja, ko},
        tags: [...], version, characters?, keywords? }
        └→ gacha_product_search_docs.doc_series   (텍스트 flatten)
             └→ search_gacha_products()            ← 앱 검색 RPC

[B] 정규화 택소노미 (6 테이블)                  ← 읽는 쪽이 아무도 없음
      gacha_series ──< gacha_product_series >── gacha_products
        └ gacha_series_aliases ──(트리거 미러)──→ gacha_search_aliases (legacy)
      gacha_categories ──< gacha_product_categories >── gacha_products
        └ gacha_category_aliases   (검색 연동 없음)
```

`[B]`는 `[A]`를 파싱해 만든 파생물이다 (`source='name_parts'` 100%).

### 실측 데이터

```
gacha_products            10,105   (active 10,100, name_parts NULL 91)
gacha_series               2,719   (전부 kind='unknown', status='active', source='name_parts')
gacha_categories              79
gacha_product_series       5,836   → 커버 상품 5,766 (57.1%)
gacha_product_categories  16,621   → 커버 상품 8,564 (84.8%)
gacha_series_aliases         179   (전부 approved)
gacha_category_aliases       131   (전부 approved)
```

`category_type` 분포: `product_type` 23 / `subject` 21 / `line` 17 / `genre` 12 / `origin` 6.

**`gacha_product_categories.category_type × relation_type` 교차표 (예외 0건 → 유도 가능):**

```
product_type → product_type   6,138
line         → line             607
genre        → tag            3,209
subject      → tag            5,150
origin       → tag            1,517
```

**`gacha_product_series.relation_type`은 유도 불가.** CHECK 도메인이
`primary / collaboration / crossover / line / unknown` 이고 실제 값은 `primary` 5,696 / `collaboration` 140.
콜라보 상품 의미를 담고 있어 **제거 대상이 아니다.**

**`gacha_series.kind` CHECK 도메인은 이미 존재한다** (전 행이 `unknown`일 뿐):
`anime / manga / game / character_brand / toy_line / franchise / other / unknown`
`status` 도메인: `active / hidden / archived` (`merged` 없음).

시리즈별 상품 수 분포:

| 상품 수 | 시리즈 개수       | 관계 행 수 |
| ------- | ----------------- | ---------- |
| 1개     | **2,183 (80.3%)** | 2,183      |
| 2개     | 216               | 432        |
| 3–5개   | 192               | 701        |
| 6–20개  | 97                | 941        |
| 21개+   | 31                | 1,579      |

상위: 산리오 캐릭터즈 193 / 포켓몬스터 176 / 닛코리노 89 / 별의 커비 79 / 치이카와 75 / 귀멸의 칼날 71.
롱테일 1건 예: `데스 스트랜딩 2 온 더 비치`, `산리오 캐릭터즈 좋아하는 리카짱`, `시나모롤(I.시나모롤)`, `홀로라이브 3기생`.

**시리즈 커버리지 57%의 원인 (초안에서 오진했던 부분, 실측으로 정정):**

```
name_parts.series 가 ko/ja 둘 다 빈 문자열   : 4,195
series 값 있는데 gacha_product_series 행 없음 :    53
```

→ 정규화 단계 누락이 아니라 **상품명 파싱 단계에서 시리즈를 못 뽑은 것**이다. 재연결 배치가 아니라 파싱/추출 개선이 필요하다.

`gacha_series.name_ja` 에 한글 포함: **45행** (디즈니 캐릭터, 시나모롤, 무민, 디즈니 프린세스 등).

### 마이그레이션 / 소유권 상태

| 항목                                                      | dev        | collector 리포 파일    | prod     |
| --------------------------------------------------------- | ---------- | ---------------------- | -------- |
| `add_gacha_series_alias_model` (20260814010814)           | 적용       | 있음                   | **없음** |
| `add_gacha_product_category_model` (20260820022202)       | 적용       | 있음 (파일명 20260814) | **없음** |
| `fix_pita_defome_category_alias` (20260820022247)         | 적용       | **파일 없음**          | **없음** |
| `improve_product_type_category_matching` (20260820022518) | 적용       | **파일 없음**          | **없음** |
| `fix_gacha_series_collab_split_rules`                     | **미적용** | 있음                   | 없음     |

- prod에 `%series%` / `%categor%` 테이블 **0개**. 택소노미 전체가 prod에 없다.
- prod 검색 RPC는 정상 배포됨: `search_gacha_products(q, p_manufacturer, p_limit, p_offset, p_fuzzy, p_min_similarity, p_has_variants)`.
- `gacha-map` 검색 마이그레이션의 dev 적용 버전명(`*_final`, `harden_grants`)은 리포 파일명과 다르지만, **파일 내용이 최종 상태(doc_fuzzy·GRANT 포함)를 모두 커버**한다. 내용 드리프트가 아니라 버전명 불일치다. (코덱스 P0-4 일부 반박)

### 문서 모순 (드리프트의 근본 원인)

- `gacha-collector/CLAUDE.md:73` — "`gacha-map`은 서비스 API, UI, **DB schema source of truth**를 담당합니다."
- `gacha-collector/docs/db-schema.md` — "상품 마스터 스키마의 source of truth는 `gacha-map` DB 마이그레이션입니다."
- 그러나 **실제 택소노미 DDL은 collector 리포에만 있다.**

문서와 실제가 반대다. 이 모순을 먼저 끊지 않으면 앞으로도 같은 드리프트가 반복된다.

### 앱 코드 연동 상태

`apps/`, `packages/` 전체에서 택소노미 4테이블 참조 **0건**.
`search_gacha_products()`의 `p_series` 파라미터는 `doc_series` 텍스트 매칭 점수 가산용이며, ID 기반 필터가 아니다.
`refresh_gacha_product_series()` 함수 **없음** (카테고리는 `refresh_gacha_product_categories()` 있고 collector가 호출).

## 구조 판정

**설계 방향은 옳다.** 시리즈(IP 축)/카테고리(속성 축) 분리, N:M 조인, alias 분리, `*_norm` + unique, `confidence`/`source` 추적 — 정석.

**문제는 설계가 아니라 소유권 모순 · 미배포 · 미연동 · 데이터 품질이다.**

| #   | 문제                                                                              | 심각도 |
| --- | --------------------------------------------------------------------------------- | ------ |
| G0  | DDL 소유 리포가 문서와 실제가 반대 → 드리프트 재발 구조                           | **P0** |
| G1  | prod에 택소노미 테이블 자체가 없음                                                | P0     |
| G2  | 마이그레이션 2건이 파일 없이 dev에만 적용됨                                       | P0     |
| G3  | 앱 코드가 택소노미를 전혀 읽지 않음                                               | P0     |
| G4  | `kind` 2,719행 전부 `unknown` → "애니메이션 시리즈별" 불가                        | P0     |
| G5  | 시리즈 계층 없음 → 산리오/헬로키티/시나모롤 형제, 롤업 불가                       | P1     |
| G6  | 시리즈 80%가 상품 1개 롱테일 → 브라우징 목록 구성 불가                            | P1     |
| G7  | 신규 상품용 `refresh_gacha_product_series()` 부재 → 시리즈가 백필 이후 갱신 안 됨 | P1     |
| G8  | 검색 RPC에 `series_id`/`category_id` 필터 없음                                    | P1     |
| G9  | 시리즈 커버리지 57% — **원인은 name_parts 파싱 미추출 4,195건**                   | P1     |
| G10 | category alias가 검색에 연결 안 됨 (series alias만 legacy 미러링됨)               | P2     |
| G11 | `name_ja` 한글 오염 45행                                                          | P2     |
| G12 | `gacha_product_categories.relation_type` 중복 저장                                | P2     |
| G13 | 검색 문서가 `name_parts` 기반 → 이중 진실 소스                                    | P2     |

## Scope

1. **DDL 소유권 확정 + 문서 모순 제거 + 마이그레이션 인벤토리 일치** (G0, G2)
2. prod 배포 경로 확립 (G1)
3. 스키마 확장: `parent_id`, `is_browsable`, `merged_into_id`, `kind_source`, `kind_confidence` (G5, G6)
4. 자동 분류로 `kind` 채우기 + 계층 부여 + 롱테일 정리 (G4, G5, G6)
5. `refresh_gacha_product_series()` 신설 및 collector 연결 (G7)
6. 브라우징 집계 뷰 + RPC (G3)
7. 검색 RPC에 택소노미 필터 결합 (G8)

## Out of Scope

- **UI 구현.** 프로젝트 룰상 노션 기획서 → Penpot → 프론트엔드 순서 강제. 본 계획은 데이터/API 레이어까지만.
- `gacha_product_series.relation_type` 제거 — **유도 불가하므로 유지한다.**
- `gacha_product_categories.relation_type` 제거 (G12) — 별도 deprecation 계획으로 분리.
- 검색 문서 생성 소스를 `name_parts` → 정규화 테이블로 전환 (G13) — 별도 계획.
- `gacha_series.kind` 도메인 재정의 — **기존 8값 도메인을 그대로 쓴다.**
- 카테고리 79개 자체의 축 재설계.
- `gacha_products.name_parts` 스키마 변경.
- G9의 근본 해결(파싱 개선) — 원인 규명까지만 본 계획에 포함, 파싱 규칙 개선은 collector 별도 작업.

## Relevant Files

### gacha-collector (데이터 수집·갱신 스크립트만)

- `scripts/lib/gacha-product-categories.ts` (카테고리 refresh 호출 헬퍼 — 시리즈판의 템플릿)
- `scripts/lib/gacha-product-series.ts` (시리즈 refresh 헬퍼, Phase 2에서 추가됨)
- `scripts/lib/gacha-product-line-terms.ts`
- `scripts/decompose-gacha-product-names.ts` (G9 파싱 개선 담당)
- `docs/data-pipeline.md` (dry-run 운영 규칙)
- `CLAUDE.md`, `docs/db-schema.md` — 소유권 문구가 이미 올바름. **수정하지 않는다.**

### gacha-map (스키마 소유 + 소비)

- `supabase/migrations/20260814010814_add_gacha_series_alias_model.sql` (kind/status/relation CHECK, alias sync 트리거)
- `supabase/migrations/20260820022202_add_gacha_product_category_model.sql` (`refresh_gacha_product_categories()`)
- `supabase/migrations/20260820022247_fix_pita_defome_category_alias.sql`
- `supabase/migrations/20260820022518_improve_product_type_category_matching.sql`
- `supabase/migrations/20260812_gacha_search_foundation.sql` — `gacha_product_search_docs` / `doc_series`
- `supabase/migrations/20260812_search_gacha_products_v2.sql` — **함수명은 `search_gacha_products`** (파일명만 v2)
- `supabase/migrations/20260812_gacha_search_aliases.sql`
- `packages/shared` — 택소노미 타입
- `apps/mobile`, `apps/web` — 검색 RPC 호출부 (회귀 대상)

## Plan

### Phase 0 — 소유권 원복 및 드리프트 해소 ✅ 완료 (2026-08-22)

> **방향 정정**: 초안과 codex 리뷰는 "실제 상태(collector)에 맞춰 문서를 고치자"였으나, 사용자 확인 결과 **collector의 역할은 데이터 수집 + DB upsert뿐**임이 확정되었다. 따라서 문서가 옳고 실무가 어긋난 것이며, **DDL 소유권을 문서대로 `gacha-map`으로 원복**한다. collector 문서(`CLAUDE.md`, `docs/db-schema.md`)는 **수정하지 않는다.**

1. **DDL 단일 소유 리포 = `gacha-map`** 으로 확정. collector는 데이터를 넣는 스크립트만 담당한다.
   - **경계 규칙**: 테이블/컬럼/제약/인덱스/함수 = gacha-map. 데이터 수집·갱신 스크립트 = collector.
   - collector는 DDL이 필요하면 gacha-map에 요청한다.
2. 택소노미 마이그레이션을 collector → gacha-map으로 이관. (완료)
3. dev에만 적용된 고아 마이그레이션 2건을 `schema_migrations.statements`에서 덤프해 gacha-map에 복원. (완료)
4. `fix_gacha_series_collab_split_rules` → **폐기(삭제)**. 내용이 `add_gacha_series_alias_model` 파일에 이미 반영되어 있고, dev 데이터도 이미 올바른 상태(`헌터×헌터` 단일 시리즈)임을 실측 확인. (완료)
5. 인벤토리 대조. (완료)

**결과 — dev 적용 4건 ↔ gacha-map 파일 4건 1:1 일치, collector 잔여 0**

| dev version      | gacha-map 파일                                                          |
| ---------------- | ----------------------------------------------------------------------- |
| `20260814010814` | `20260814010814_add_gacha_series_alias_model.sql`                       |
| `20260820022202` | `20260820022202_add_gacha_product_category_model.sql`                   |
| `20260820022247` | `20260820022247_fix_pita_defome_category_alias.sql` (덤프 복원)         |
| `20260820022518` | `20260820022518_improve_product_type_category_matching.sql` (덤프 복원) |

**발견 — 이관 파일 2개는 "누적 스냅샷"이다.** collector에서 적용 후에도 제자리 수정을 반복해서, 파일 내용이 해당 버전이 실제로 적용한 것이 아니라 **이후 수정까지 모두 포함된 최종 상태**다. 실측:

- `20260814010814` 파일 → collab split 수정분(`헌터×헌터`) 포함
- `20260820022202` 파일 → `022247`의 `ぴたでふぉめ` alias + `022518`의 `char_length(alias_norm) >= 2` 매칭 + line_patterns 17개 전부 포함

prod에 순서대로 재생하면 최종 상태는 동일하며 뒤 2건은 멱등 no-op이다. 각 파일 헤더에 `HISTORY NOTE`로 명시하고 **dev 재적용 금지**를 박아두었다. 버전별 원본이 필요하면 dev `schema_migrations`에서 다시 덤프 가능하다.

**남은 것**: 파일 4개가 untracked 상태 — 커밋 필요. prod는 여전히 미적용(Phase 6에서 처리).

### Phase 1 — 스키마 확장 (**gacha-map 리포**, 마이그레이션 1개)

기존 도메인을 **바꾸지 않고 추가만** 한다.

1. `gacha_series` 컬럼 추가:
   - `parent_id uuid REFERENCES gacha_series(id) ON DELETE SET NULL` + 인덱스
   - `merged_into_id uuid REFERENCES gacha_series(id)` + 인덱스
   - `is_browsable boolean NOT NULL DEFAULT false`
   - `kind_source text`, `kind_confidence real CHECK (0 <= x <= 1)`
2. 계층 무결성 제약:
   - 자기참조 금지 CHECK (`parent_id <> id`)
   - **깊이 2단 제한**: `parent_id`가 가리키는 행의 `parent_id`는 NULL이어야 한다 (트리거 검증)
   - 사이클 검출 쿼리를 검증 스크립트에 포함
3. 병합 표현:
   - **`status='merged'`를 새로 만들지 않는다.** 기존 도메인의 `archived`를 쓰고 `merged_into_id`로 구분한다.
   - `merged_into_id IS NOT NULL` 이면 `status='archived'` 강제 CHECK.
   - 물리 삭제 금지.
4. `relation_type`은 **양쪽 다 손대지 않는다.**

**완료 조건**: dev 적용 후 제약 위반 0건, 기존 collector 배치 1회 정상 완료, 기존 검색 회귀 없음.

### Phase 2 — 갱신 경로 신설 (collector 리포)

브라우징 데이터가 신규 상품에 대해 계속 유지되도록 먼저 만든다.

1. `refresh_gacha_product_series(p_product_ids uuid[])` 신설.
   - 기존 백필 SQL(`20260814_add_gacha_series_alias_model.sql`)의 로직을 함수로 추출한다.
   - `relation_type` (`primary`/`collaboration`) 판정 로직을 보존한다.
   - `refresh_gacha_product_categories()`와 동일한 시그니처/멱등성 규약을 따른다.
2. collector 스크립트의 상품 저장·승인·구조분해 후처리에 위 함수 호출을 연결한다 (`scripts/lib/gacha-product-categories.ts` 패턴 참고).

**완료 조건**: dev에서 신규 상품 1건 투입 시 `gacha_product_series` 행이 자동 생성됨.

### Phase 3 — 자동 분류 (collector 리포, 스크립트)

**착수 전 파일럿 100건으로 비용·정확도를 실측한다** (모델/게이트웨이는 collector 기존 OpenAI 경로 재사용).

1. **`kind` 분류** — 기존 도메인 8값 사용
   - 대상: `gacha_series` 2,719건.
   - 입력: `name_ko`, `name_ja`, 소속 상품명 샘플 최대 5건, 연결된 `genre` 카테고리.
   - 출력: `kind` + `kind_confidence`, `kind_source='llm_batch_YYYYMMDD'`.
   - `kind_confidence < 0.7` → `kind='unknown'` 유지 + `note`에 후보 기록. 자동 확정 금지.
   - 배치 50건, 재시도 3회.
   - "애니메이션 시리즈별" UI는 `kind IN ('anime','manga')`로 매핑한다.
2. **계층 부여** — 상품 3개 이상 시리즈(약 320건)로 **한정**
   - 1단계 규칙 기반: `name_ko_norm`이 다른 시리즈명을 접두 포함 → 부모 후보.
   - 2단계 LLM: 규칙으로 못 잡는 IP 소속(헬로키티→산리오, 시나모롤→산리오).
   - **깊이 2단 제한.** 부모 시리즈는 `is_browsable=true` 강제.
3. **롱테일 정리**
   - 상품 1개 시리즈 2,183건 중 다른 시리즈명 접두 포함 → 병합: `gacha_product_series` 재연결 후 원본 `status='archived'`, `merged_into_id` 기록.
   - **UPDATE 전 dry-run 결과표(병합 전/후 쌍) 필수 출력**, 사용자 승인 후 실행.
   - 복구 쿼리를 스크립트에 동봉한다.
   - 병합 불가 잔여는 `is_browsable=false` 유지.
4. **`is_browsable` 산정** — 계층 롤업 후(자손 상품 수 합산) 3개 이상 → `true`. 멱등 배치.
5. **`name_ja` 오염 정리 (45행)**
   - **before/after CSV를 먼저 생성**하고 사용자 확인 후 UPDATE.
   - 낮은 confidence는 NULL 처리 대신 `note`에 review 표시로 남긴다.
6. **G9 원인 기록** — `name_parts.series` 빈 값 4,195건 목록을 추출해 collector 파싱 개선 백로그로 넘긴다. 본 계획에서 파싱을 고치지는 않는다.

**완료 조건**: `kind='unknown'` 비율 30% 이하, `is_browsable=true` 시리즈 200~400건, 상위 50개 시리즈 육안 검수 통과, depth>2 및 사이클 0건.

### Phase 4 — 브라우징 API (gacha-map 리포)

**전제**: 노션 기획서 확인. 없으면 Phase 4는 **보류**하고 사용자에게 보고한다 (프로젝트 Spec Rule). 기획서 없이 응답 필드를 추측해 확정하지 않는다.

1. materialized view `gacha_series_browse`
   - `series_id`, `name_ko/ja/en`, `kind`, `parent_id`, `depth`, `direct_product_count`, `rollup_product_count`, `representative_image_url`
   - unique 인덱스 필수 (`REFRESH ... CONCURRENTLY` 조건)
2. materialized view `gacha_category_browse`
   - `category_id`, `name_ko/ja/en`, `category_type`, `display_order`, `product_count`, `representative_image_url`
3. RPC `browse_gacha_series(p_kind text, p_parent_id uuid, p_limit int, p_offset int)`
   - `is_browsable AND status='active'` 필터
   - 정렬 `rollup_product_count DESC, name_ko ASC, series_id ASC` — **`series_id` tie-breaker 필수**
4. RPC `browse_gacha_categories(p_category_type text)` — `status='active'`, `display_order` 정렬
5. RPC `list_gacha_products_by_series(p_series_id uuid, p_include_descendants boolean, ...)` — 재귀 CTE, 깊이 상한 2
6. RPC `list_gacha_products_by_category(p_category_id uuid, ...)`
7. 모든 RPC: `SECURITY DEFINER` + `search_path` 고정 + `anon`/`authenticated` GRANT — 기존 `search_gacha_products` 패턴 그대로. 배포 후 `NOTIFY pgrst, 'reload schema'`.
8. MV 갱신은 collector 배치 종료 훅에서만 수행한다.

**완료 조건**: 대표 쿼리 세트 10개에 대해 dev p95 200ms 이내, 페이지네이션 중복/누락 0건.

### Phase 5 — 검색 결합 (gacha-map 리포)

1. `search_gacha_products()`에 `p_series_ids uuid[] DEFAULT NULL`, `p_category_ids uuid[] DEFAULT NULL` 추가.
   - **기존 7개 인자 순서·이름 유지**, 신규는 뒤에 추가. 기본값 NULL이면 현행 동작과 완전 동일.
   - `COMMENT` / `GRANT` 를 **새 시그니처 기준**으로 다시 선언한다 (시그니처 변경 시 기존 GRANT 소실).
   - **빈 질의 경로와 검색 질의 경로가 분리되어 있으므로 양쪽 모두에 필터를 적용한다.**
2. 필터는 후보 축소 단계에서 `EXISTS` 서브쿼리로 적용.
3. category alias 검색 연동(G10)은 **별도 항목으로 분리**한다:
   - series alias는 이미 `gacha_search_aliases`로 트리거 미러링되어 검색이 읽는다 → **건드리지 않는다.**
   - category alias는 동일 미러링이 없다 → 미러링 추가 vs 직접 조회 중 선택. 본 Phase에서는 설계만 확정하고 구현은 후속.

   **확정한 설계 (2026-08-23, 구현은 후속)**: `gacha_category_aliases` 를 `gacha_search_aliases` 로 미러링하지 **않는다.** 이유 —
   - 시리즈 별칭은 "키티 → 헬로키티"처럼 **같은 대상의 다른 이름**이라 검색어 확장이 맞다.
   - 카테고리 별칭은 "ぴたでふぉめ → 피타 데포메"처럼 **분류 용어**다. 검색어로 확장하면 `마스코트` 검색이 마스코트 카테고리 상품 1,550개를 전부 끌어와 결과가 무의미해진다.
   - 대신 **검색어가 카테고리 별칭과 정확히 일치하면 해당 카테고리 필터를 제안**하는 방식으로 간다 (검색 결과 상단에 "마스코트 카테고리 보기" 칩). 확장이 아니라 유도다.
   - 이 방식은 `p_category_ids` 필터가 이미 있으므로 **RPC 변경 없이 UI만으로 구현 가능**하다.

4. `name_parts.series` ↔ `gacha_product_series` 불일치 모니터링 쿼리 추가.

   ```sql
   -- 정상 상태: 두 값 모두 0에 가까워야 한다.
   select
     -- name_parts 에 시리즈가 있는데 정규화 행이 없음 (정규화 누락)
     count(*) filter (
       where (coalesce(p.name_parts->'series'->>'ko','') <> ''
              or coalesce(p.name_parts->'series'->>'ja','') <> '')
         and not exists (select 1 from gacha_product_series ps where ps.product_id = p.id)
     ) as missing_mapping,
     -- name_parts 가 비었는데 정규화 행이 있음 (유령 매핑)
     count(*) filter (
       where coalesce(p.name_parts->'series'->>'ko','') = ''
         and coalesce(p.name_parts->'series'->>'ja','') = ''
         and exists (select 1 from gacha_product_series ps where ps.product_id = p.id)
     ) as orphan_mapping
   from gacha_products p
   where p.status = 'active' and p.name_parts is not null;
   ```

   2026-08-23 dev 실측: `missing_mapping` 53, `orphan_mapping` 0. 53건은 `refresh_gacha_product_series()` 를 한 번 돌리면 해소된다.

**완료 조건**: `apps/web` 기존 검색 테스트(`rtk vitest run`) 전부 통과 + 신규 필터 테스트 통과 + 모바일 호출부 스모크.

### Phase 6 — prod 배포

**순서 엄수. 신규 마이그레이션만 적용하면 실패한다.**

1. prod에 **Phase 0의 기존 4개 택소노미 마이그레이션부터 순서대로 적용**한다.
2. 이어서 Phase 1 / 2 / 4 / 5 마이그레이션을 적용한다.
3. **prod 백필은 taxonomy 전용 명령으로 분리한다.** 외부 상품 수집 배치를 prod에 그대로 돌리지 않는다.
   - `--dry-run` 필수, DB host guard, 예상 row count 사전 출력, 롤백 절차 문서화.
   - 저트래픽 시간대 실행.
4. `main` 머지 전 prod 적용 완료 (프로젝트 룰).

**완료 조건**: prod 브라우징 RPC 정상 응답, 검색 회귀 스모크 통과, 백필 row count가 dry-run 예측치와 일치.

## Verification

| 단계    | 검증 방법                                                                                       |
| ------- | ----------------------------------------------------------------------------------------------- |
| Phase 0 | 인벤토리 스크립트: dev/prod `schema_migrations` ↔ 두 리포 파일 diff, "적용됐는데 파일 없음" 0건 |
| Phase 1 | 제약 위반 쿼리 0건, 사이클/depth>2 검출 0건, collector 배치 1회 정상                            |
| Phase 2 | dev 신규 상품 1건 투입 → `gacha_product_series` 자동 생성 확인                                  |
| Phase 3 | `kind` 분포 / `is_browsable` 개수 / 커버리지 쿼리, 상위 50개 육안 검수, 병합 dry-run 대조       |
| Phase 4 | 대표 쿼리 10개 p95 측정, 페이지네이션 중복/누락 테스트, `EXPLAIN ANALYZE` 확인                  |
| Phase 5 | `rtk vitest run` (web) + 모바일 스모크 + 신규 필터 케이스                                       |
| Phase 6 | prod 스모크, 백필 row count 대조                                                                |

## Risks / Questions

| #   | 리스크                                            | 완화                                                                        |
| --- | ------------------------------------------------- | --------------------------------------------------------------------------- |
| R1  | 두 리포가 같은 DB를 공유해 마이그레이션 순서 충돌 | Phase 0에서 소유 경계 확정 + 문서 모순 제거                                 |
| R2  | LLM 오분류가 UI에 노출                            | `kind_confidence` 0.7 미만은 `unknown` 유지, 상위 50개 육안 검수            |
| R3  | 시리즈 병합 비가역                                | `merged_into_id` 추적, 물리 삭제 금지, dry-run 승인 후 실행, 복구 쿼리 동봉 |
| R4  | `name_ja` 자동 교정으로 원본 소실                 | before/after CSV 선행, 낮은 confidence는 NULL 대신 review 표시              |
| R5  | MV 갱신과 collector 배치 경합                     | `CONCURRENTLY` + unique 인덱스, 배치 종료 훅에서만 갱신                     |
| R6  | 검색 RPC 시그니처 변경이 앱 회귀 유발             | 기존 인자 순서 유지 + 기본값 NULL + GRANT/COMMENT 재선언 + 양쪽 경로 테스트 |
| R7  | prod 백필 부하 / 잘못된 배치 실행                 | taxonomy 전용 명령 분리, dry-run, host guard, 저트래픽 실행                 |
| R8  | LLM 배치 2,719건 비용/시간 미산정                 | Phase 3 착수 전 파일럿 100건 실측                                           |
| R9  | 기획서 부재로 Phase 4 API 계약이 추측이 됨        | 노션 기획서 확인 전 Phase 4 보류                                            |

### 확인 필요 항목

**해결됨 (2026-08-22 사용자 확인)**

1. ~~DDL 소유 리포~~ → **`gacha-map`**. collector는 데이터 수집 + DB upsert만. collector 문서는 수정하지 않음.
2. ~~`fix_gacha_series_collab_split_rules` 미적용 사유~~ → **폐기**. 내용이 본 파일에 이미 반영, dev 데이터도 정상.
3. ~~브라우징 UI 노션 기획서~~ → **2026-08-22 작성 완료.** [🗂️ 가챠 카테고리·시리즈 탐색 기획](https://app.notion.com/p/3c4203d520db81b4bfc7edb79627a3b4) (부모: `화면 기획`). Phase 4 차단 해제됨 — 단 §13 선행 조건(collector의 kind 분류·계층·병합)이 끝나야 실제 착수 의미가 있음.
   - 확정 사항: 진입점 = **검색 탭 가챠 탭의 빈 상태**(신규 탭 없음, 기존 "q 없이 20개 나열" 동작 대체) / 첫 화면 = **한 화면에 카테고리 3축 + 인기 시리즈 4섹션**
   - 카테고리 5축 중 `line`·`origin`은 1차 UI 미노출 (line은 시리즈와 개념 중복, origin은 `일본` 1,355건이라 변별력 없음)
   - "애니메이션 시리즈별" = `kind IN ('anime','manga')`, `unknown`은 `전체` 칩에서만 노출

**미해결 (해당 Phase 착수 전 필요)**

4. ~~LLM 분류에 쓸 모델/게이트웨이~~ → **collector 기존 OpenAI 경로 재사용 확정.** 현재 사용 모델: `gpt-5.4-nano` / `gpt-5.4-mini` / `gpt-4o-mini` / `gpt-4o`. 분류·계층 판정은 `gpt-5.4-mini` 권장(nano는 IP 성격 판단에 부족). 별도 게이트웨이 도입 안 함.
5. prod taxonomy 백필 실행 주체·절차가 이미 있는가? (Phase 6)
6. `is_browsable` 임계값 "상품 3개"(→ 약 320개 노출) 적절한가? (Phase 3, 실데이터 보고 재판단 가능)

## 후속 과제 (본 계획 범위 밖, 별도로 다룬다)

작업 중 드러났지만 이번 계획에서 처리하지 않기로 한 것들. 잊지 않으려고 남긴다.

### F1. `parent_id` 에 archived 시리즈를 넣는 것을 DB가 막지 않는다

Phase 1 트리거(`gacha_series_validate_hierarchy`)는 깊이 2단·자기참조·병합 체인만 검사한다. **`parent_id` 가 `status='archived'` 이거나 `merged_into_id` 가 걸린 시리즈를 가리켜도 통과한다.**

2026-08-24 실제로 collector 쪽에서 `산리오`(archived, `산리오 캐릭터즈`로 병합됨)를 계층 부모로 쓰려는 시도가 있었다. 이렇게 되면 헬로키티·시나모롤 등이 화면에 나오지 않는 부모에 매달린다.

지금은 collector 스크립트에서 `active AND merged_into_id IS NULL` 로 거르는 것으로 대응했다.

**왜 지금 트리거로 안 막았나**: 병합·계층 배치가 진행 중이라 중간 상태에서 걸릴 수 있다. 데이터가 안정된 뒤(Phase 3 완료 후) 제약으로 올릴지 판단한다.

```sql
-- 넣는다면 이런 형태. gacha_series_validate_hierarchy 에 추가.
if new.parent_id is not null then
  perform 1 from public.gacha_series p
   where p.id = new.parent_id and p.status = 'active' and p.merged_into_id is null;
  if not found then
    raise exception 'gacha_series parent % is not an active, unmerged series', new.parent_id
      using errcode = 'check_violation';
  end if;
end if;
```

검출 쿼리 (0이어야 한다):

```sql
select count(*) from public.gacha_series c
  join public.gacha_series p on p.id = c.parent_id
 where p.status <> 'active' or p.merged_into_id is not null;
```

### F2. 검색이 원래 느리다

단일 토큰 약 280ms, 다중 토큰 약 650ms. Phase 5와 무관하며 prod 구버전에서도 동일하게 측정됐다(288ms / 655ms). 별도 과제.

### F3. `other` 칩을 만들지 결정 필요

full kind apply 후 노출 후보 중 `other` 가 31.6%였다. 기획서 §6-3의 kind 필터 칩에 `other` 대응이 없어서 그만큼이 `전체` 탭에서만 보인다. 병합·계층이 끝나 숫자가 안정되면 다시 보고 판단한다.

### F4. 콜라보 분리가 `×` 기호에만 걸린다

`refresh_gacha_product_series()` 의 분리 규칙은 `×` 가 있을 때만 동작한다. `도라에몽 헬로키티` 처럼 공백으로 이어진 콜라보는 잡지 못해서, 롱테일 병합 후보로 올라왔다가 제외했다. 공백 패턴까지 넓히려면 오탐이 늘어나므로 별도 설계가 필요하다.

### F5. 제품 라인 × IP 분해

`오네무탄 주술회전`, `데포라바! 스파이 패밀리` 같은 시리즈는 시리즈=IP, 카테고리(`line`)=제품 라인으로 분해되어야 맞다. 현재는 하나의 시리즈로 남아 있고, 병합·계층 후보에서 제외만 해둔 상태다.

## Adversarial Review

codex adversarial review 1회 수행. 지적 사항을 실측으로 재확인한 결과:

**채택 (P0)**

1. **DDL 소유권 모순** — `gacha-collector/CLAUDE.md:73`과 `docs/db-schema.md`가 "gacha-map이 DB schema SoT"라 명시하는데 실제 택소노미 DDL은 collector에만 있음. 확인됨. → Phase 0에 차단 조건으로 추가.
   **단, 해소 방향은 codex 제안과 반대로 갔다.** codex는 "실제(collector)에 맞춰 문서를 고쳐라"였으나, 사용자 확인 결과 collector 역할이 데이터 수집·upsert로 한정되므로 **문서가 옳고 실무가 틀렸다**. DDL을 gacha-map으로 원복하고 collector 문서는 그대로 두었다. (2026-08-22 완료)
2. **`gacha_product_series.relation_type` 제거는 오류** — CHECK 도메인이 `primary/collaboration/crossover/line/unknown`이고 실제 `primary` 5,696 / `collaboration` 140. 유도 불가. 초안의 제거 지시는 **철회**. 카테고리 쪽 중복(G12)만 남기되 별도 deprecation으로 분리.
3. **병합 스키마 부재** — `merged_into_id` 컬럼 없음, `status` CHECK에 `merged` 없음(`active/hidden/archived`). 확인됨. → `archived` + `merged_into_id` 방식으로 변경, DDL을 Phase 1에 명시.
4. **`kind` 도메인 재정의는 충돌** — 기존 CHECK가 이미 `anime/manga/game/character_brand/toy_line/franchise/other/unknown`. 초안의 새 도메인 제안은 **철회**, 기존 도메인 사용으로 변경.

**채택 (P1/P2)** 5. `refresh_gacha_product_series()` 부재 → Phase 2 신설. 6. 함수명은 `search_gacha_products` (파일명만 `_v2`). 빈 질의/검색 질의 경로 분리 → 양쪽 필터 적용 + GRANT 재선언 명시. 7. 기획서 의존 → Phase 4를 노션 기획서 확인 전 보류로 변경. 8. prod "collector 배치 1회 실행" 모호 → taxonomy 전용 명령 + dry-run + host guard로 구체화. 9. alias 결합 중복 → series는 기존 미러링 유지, category는 설계만 확정하고 구현 분리. 10. 검증 조건 느슨함 → p95/대표 쿼리 세트, `series_id` tie-breaker 명시로 변경. 11. `name_ja` 감사 로그 → before/after CSV 선행으로 변경.

**일부 반박 (P0-4)**

- gacha-map 검색 마이그레이션 드리프트 주장: 리포 파일이 `doc_fuzzy`와 `GRANT EXECUTE`를 모두 포함하고 있어 **내용 드리프트가 아니라 적용 버전명 불일치**다. 재적용 대상이 아니며 Phase 0에서 기록만 한다. 다만 "두 리포 × dev/prod 전체 인벤토리" 확장 제안 자체는 채택.

**자체 정정 (코덱스 무관)**

- 초안의 "시리즈 커버리지 57%는 정규화 실패, 약 4,200건 재연결 필요" 주장은 오류. 실측 결과 `name_parts.series` 빈 값 4,195건 / 정규화 누락 53건. 원인은 **파싱 미추출**이며, 대응이 재연결 배치 → 파싱 개선 백로그로 바뀜.

**판정: 초안 그대로 착수 불가.** 위 반영본 기준으로 진행하며, Phase 0 확인 항목 1·2·3이 해소되어 Phase 1 착수 가능해졌다.

## Final Plan

위 "Plan" 섹션이 리뷰 반영된 최종안이다. 실행 순서와 담당:

| Phase             | 상태            | 담당                                             | 리포          | 차단 조건                        |
| ----------------- | --------------- | ------------------------------------------------ | ------------- | -------------------------------- |
| 0 소유권·드리프트 | ✅ 완료 (08-22) | 메인 세션 (MCP)                                  | 양쪽          | —                                |
| 1 스키마 확장     | 진행 중         | 메인 세션 (`apply_migration`)                    | **gacha-map** | Phase 0 완료                     |
| 2 refresh 함수    | 대기            | 메인 세션 (DDL) + collector (호출 연결은 완료됨) | **gacha-map** | Phase 1 완료                     |
| 3 자동 분류       | 대기            | collector                                        | collector     | Phase 1 완료 + 파일럿 100건 승인 |
| 4 브라우징 API    | 보류            | backend-agent → 메인 세션 적용                   | gacha-map     | **노션 기획서 작성**             |
| 5 검색 결합       | 대기            | backend-agent → 메인 세션 적용                   | gacha-map     | Phase 4 완료                     |
| 6 prod 배포       | 대기            | 메인 세션 (MCP)                                  | 양쪽          | 전 Phase dev 검증 완료           |

**모든 DDL은 gacha-map 리포에 둔다.** collector는 데이터를 넣는 스크립트만 담당한다.

마이그레이션 적용(`apply_migration`)과 노션/Penpot 조회는 **메인 세션 전용**이다. 서브에이전트에 위임하지 않는다.

### 진행 로그

- **2026-08-22 Phase 0 완료** — 택소노미 마이그레이션 4건 gacha-map 이관·복원, collector 잔여 0, dev ↔ 파일 1:1 일치.
- **2026-08-22 Phase 2 collector측 선행 완료** — `scripts/lib/gacha-product-series.ts` 헬퍼 + 5개 스크립트 연결. `PGRST202`를 graceful 처리하므로 RPC 배포 전에도 안전. **gacha-map이 `refresh_gacha_product_series()` RPC를 만들면 바로 동작한다.**
- **2026-08-22 Phase 1 dev 적용 완료** — `20260822_gacha_series_browse_columns.sql`. `gacha_series`에 `parent_id` / `merged_into_id` / `is_browsable` / `kind_source` / `kind_confidence` 추가, CHECK 4개 + 부분 인덱스 3개 + `gacha_series_validate_hierarchy_trg` 트리거. 롤백되는 트랜잭션 안에서 위반 시도 8건 전부 의도대로 동작 확인(깊이3 차단, 부모→자식 전환 차단, 자기참조, merged인데 active, 병합 체인, confidence 범위, 정상 케이스 2건 허용). 기존 2,719행 무변경, 검색 RPC 정상. **prod 미적용.**
- **2026-08-22 Phase 2 dev 적용 완료** — `20260822_refresh_gacha_product_series.sql`. 기존 백필 SQL을 `refresh_gacha_product_series(uuid[])` 함수로 추출. `primary`/`collaboration` 판정과 `×` 분리 규칙(헌터×헌터 보존) 그대로 유지. 검증: 롤백 트랜잭션 안에서 전체 refresh 실행 → 기존 5,836행을 **checksum 동일**하게 재현(primary 5,696 / collaboration 140), scoped 호출·빈 배열 경로 정상. 파일 ↔ 배포 함수 일치 확인. **prod 미적용.**
  - **추가 3건** (원본 백필 대비): ① `merged_into_id`를 따라가 Phase 3 병합이 refresh로 되살아나지 않게 함 ② `ON CONFLICT DO UPDATE`를 `source='name_parts'`로 제한(수동 매핑 보호, 현재 no-op) ③ **분리될 콜라보 제목의 시리즈 엔티티를 만들지 않음**
  - ③은 첫 배포판의 결함을 고친 것. 첫 버전은 `헬로키티×에반게리온` 같은 전체 제목을 시리즈로 만들고 상품은 `헬로키티`/`에반게리온`에 매핑해서, **상품 0개짜리 고아 시리즈**를 남겼다(G6 롱테일 악화). 수정 후 전체 refresh 시 신규 고아 0건 확인. 테스트로 생긴 고아 2건은 참조 0 확인 후 삭제, dev는 기준선(시리즈 2,719 / 매핑 5,836 / 커버 5,766)으로 복구.
- **2026-08-22 Phase 3 인계서 전달** — `docs/collector-handoff/20260822-series-auto-classification.md`. collector가 착수 가능한 상태(Phase 1·2 dev 적용 완료). 실측 근거: 노출 후보(상품 3개+) 320건 / 싱글톤 2,183건 / 규칙 병합 후보 303건 / 규칙 부모-자식 후보 49건 / `name_ja` 오염 45건. 파일럿 100건 선행 필수.
- **2026-08-22 Penpot UI 디자인 완료** — `서비스 UI` 페이지에 보드 3개 신규: `화면_둘러보기 (검색 탭 가챠) - 모바일`(1505,10800) / `화면_카테고리 전체 목록 - 모바일`(1940,10800) / `화면_시리즈 전체 목록 - 모바일`(2375,10800). 헤더는 기존 `샵·가챠 통합 검색 화면` 보드에서 복제해 스타일 100% 일치. 실측 컴포넌트 스펙(칩 h32/r16/pad12, 섹션헤더, 목록 행, kind 필터칩)을 기획서 §15에 기록. **§5·§7 상품 목록은 기존 `화면_목록 화면 (가챠 탭)` 재사용 전제로 신규 보드 미작성.**
  - **명칭 오류 발견·정정**: 하단 탭바의 "검색" 탭은 실제로는 **찜 목록 화면**(샵/상품 세그먼트 + 찜 카드 + 탭바)이다. 본 탐색 화면이 들어가는 곳은 지도 위에 뜨는 **검색 오버레이**(`/search`, 뒤로가기 + 샵/가챠 탭, 탭바 없음). 기획서 §3-1에 경고 박스로 명시.
  - 신규로 정의한 것 2개: **공용 칩 컴포넌트**(코드베이스에 공용 칩이 없어 개별 구현이 흩어져 있음), **섹션 헤더 + 더보기 패턴**(기존 부재).
- **2026-08-23 상품 목록에 필터 바 추가 (기획서 §17 신설 + Penpot 보드 1개)** — 데일리샷 카테고리 화면을 레퍼런스로 검토. 초안 §5·§7이 `제목 + 총 개수 + 무한 스크롤`뿐이라 마스코트 1,550개를 훑을 방법이 없던 문제를 보완.
  - 채택: **축별 드롭다운 3개(진입 축 제외) + 선택 칩 + 초기화 + 총 개수 + 정렬 3종.** 축 안 OR / 축 간 AND. 정렬 전부에 `id ASC` tie-breaker.
  - 미채택: 좌측 2-pane 레일(우리 카테고리는 계층 없는 다중 태그라 우측 pane을 채울 데이터가 없음), 2열 그리드(샵수·최저가 손실 + 검색 결과와 parity 깨짐), 전용 카테고리 탭(지도가 주 동선).
  - **API 영향**: `list_gacha_products_by_category` / `list_gacha_products_by_series`에 `p_filter_category_ids uuid[]`, `p_filter_series_ids uuid[]`, `p_sort text` 추가. 카테고리 id는 `category_type`으로 축을 판별해 그룹핑 후 축 안 OR / 축 간 AND로 평가해야 함 — 전부 AND 하거나 전부 OR 하면 틀림. 필터·정렬·페이지네이션 코어는 `search_gacha_products`와 공유 필수(§10 일관성 요구).
  - Penpot: `화면_카테고리별 상품 목록 (필터) - 모바일` (2810, 10800). 상품 카드는 기존 `화면_목록 화면 (가챠 탭)` 스펙 그대로.
- **2026-08-23 Phase 4 dev 적용 완료** — `20260823_gacha_browse_views.sql` + `20260823_gacha_browse_rpcs.sql`.
  - MV 2개: `gacha_category_browse`(79행) / `gacha_series_browse`(2,719행). 각각 unique 인덱스 보유 → `REFRESH ... CONCURRENTLY` 가능. 갱신 함수 `refresh_gacha_browse_views()` 신설, 동작 확인.
  - RPC 5개: `browse_gacha_categories` / `browse_gacha_series` / **`browse_gacha_products`(코어)** / `list_gacha_products_by_category` / `list_gacha_products_by_series`. 뒤 두 개는 코어를 부르는 얇은 래퍼 — §17-6의 "검색과 코어 공유" 요구를 구조로 강제. **Phase 5는 이 코어를 재사용해야 하며 술어를 다시 구현하면 안 된다.**
  - 검증 — 축 의미: 고양이 512 · 동물 1518 → OR 1,824(합 2,030보다 작음 = 중복 제거됨), 마스코트 ∩ 고양이 → 89(AND), 3축 → 30. 페이지네이션: 10페이지 200행 전부 distinct, 중복 0. 정렬 3종 동작. 롤업: 롤백 트랜잭션에서 가짜 계층(산리오←헬로키티+구데타마) 만들어 direct 193 → rollup 266, child_count 2 확인. 집계: 가짜 샵 연결 주입 시 popular 1위 등극 + `available_shop_count`·`min_price_krw` 정확.
  - 성능(dev): 카테고리 목록 1.7ms / 시리즈 목록 3.4ms / 1,550건 첫 페이지 61.9ms / 축 필터 46.7ms / offset 1000 59.1ms / 무필터 10,105건 61.1ms. 목표 p95 200ms 충족.
  - **`browse_gacha_series()`는 현재 0행을 반환한다** — `is_browsable`이 전부 false라서. Phase 3(collector) 완료 전까지 시리즈 탐색 화면은 빈 상태다. 정상.
  - dev에 `available` 샵 연결이 0건이라 `popular` 정렬은 실데이터로 구분되지 않는다(전부 0 → 2차 키 `release_start_date`로 떨어짐). prod 데이터에서 재확인 필요.
  - **prod 미적용.**
- **2026-08-23 Phase 5 dev 적용 완료** — `20260823_gacha_filter_product_ids.sql` + `20260823_search_gacha_products_taxonomy_filter.sql`.
  - **5A** — 필터 술어를 `gacha_filter_product_ids(uuid[], uuid[], boolean)` 로 추출하고 `browse_gacha_products` 를 그 위에 다시 얹었다. 술어가 한 벌만 존재하게 만드는 것이 목적(§10). 리팩터링 무손실 확인: 1550 / 1824 / 89 / 30 전부 Phase 4와 동일.
  - **5B** — `search_gacha_products` 에 `p_category_ids uuid[]`, `p_series_ids uuid[]` 추가. 기존 7인자의 이름·순서는 그대로 두고 뒤에만 붙였다.
    - 인자 추가는 시그니처 변경이라 `CREATE OR REPLACE` 로는 오버로드가 하나 더 생긴다(PostgREST 이름 호출에서 모호). **DROP 후 재생성**했고, 그때 사라지는 `COMMENT`/`GRANT` 를 새 시그니처로 다시 선언했다. 확인: 함수 1개만 존재, grants `anon, authenticated, service_role` 복원.
    - **빈 질의 경로와 검색 질의 경로 양쪽 모두**에 필터를 걸었다. 한쪽만 걸면 검색어를 지웠을 때 필터가 조용히 풀린다.
    - `v_has_tax_filter` 불리언으로 감싸 필터 미사용 시 서브플랜이 실행되지 않게 했다.
  - 검증 — 하위 호환: 기존 7인자 호출 결과 불변(산리오 20건). 빈 질의 무필터 10,100 / +마스코트 1,550. 검색 무필터 1,845 / +고양이 109 / +2축 89. **`검색 '마스코트' + (마스코트 ∩ 고양이)` = 89 로 browse 의 `mascot_AND_cat` 89 와 일치** — §10이 요구한 "탐색과 검색이 같은 결과에 도달"이 실제로 성립.
  - 성능 — **회귀 없음.** prod에 남아 있는 구버전을 대조군으로 사용: dev 신버전(상품 10,100) 273ms/627ms vs prod 구버전(상품 12,461) 288ms/655ms. 필터 적용 시 오히려 빨라진다(283ms → 260ms, 후보가 줄어서).
  - ⚠️ **별건으로 드러난 것: 검색 자체가 원래 느리다.** 단일 토큰 ~280ms, 다중 토큰 ~650ms. Phase 5와 무관한 기존 이슈이며 prod에서도 동일하다. 별도 과제로 다뤄야 한다.
  - **prod 미적용.**
- **2026-08-22 B-1 collector측 착수** — `decompose:gacha-product-names`에 `--missing-series-only` 옵션 추가, 독립 브랜드/제품 라인을 series로 뽑도록 prompt 보강. dev dry-run으로 미추출 4,195건 확인. 실제 재분해·커버리지 75% 측정은 미완.
