# collector 인계: 택소노미 스키마 소유권 원복 + 시리즈 갱신 경로

작성일: 2026-08-21
대상 리포: `gacha-collector`
관련 계획: `gacha-map/docs/plans/20260821-gacha-taxonomy-restructure.md`

## 배경

가챠 상품의 **시리즈/카테고리 분류 테이블**(택소노미) 6개의 DDL이 현재 `gacha-collector/supabase/migrations/`에 있다.

그러나 `gacha-collector/CLAUDE.md`와 `docs/db-schema.md`는 원래부터 이렇게 규정하고 있다:

> `gacha-map`은 서비스 API, UI, **DB schema source of truth**를 담당합니다.
> `gacha-collector`는 배치성 수집, 번역 후보 생성, DB upsert만 담당합니다.

**문서가 맞고 실무가 어긋났다.** 사용자 확인 결과 collector의 역할은 "데이터 수집 + DB 삽입"으로 확정되었으므로, 스키마 소유권을 문서대로 `gacha-map`으로 원복한다.

### 어긋난 결과 (실측)

- dev에 적용됐는데 **어느 리포에도 파일이 없는 마이그레이션 2건** 발생
  - `fix_pita_defome_category_alias` (20260820022247)
  - `improve_product_type_category_matching` (20260820022518)
- **prod에 택소노미 테이블이 하나도 없음** (`%series%` / `%categor%` 조회 0행)

---

## A. 즉시 처리 — 스키마 소유권 원복

### A-1. 택소노미 마이그레이션 파일을 `gacha-map`으로 이관

collector에서 **삭제**하고 gacha-map으로 옮길 파일:

| 파일                                                                   | 처리                        |
| ---------------------------------------------------------------------- | --------------------------- |
| `supabase/migrations/20260814_add_gacha_series_alias_model.sql`        | gacha-map으로 이관          |
| `supabase/migrations/20260814_add_gacha_product_category_model.sql`    | gacha-map으로 이관          |
| `supabase/migrations/20260814_fix_gacha_series_collab_split_rules.sql` | **폐기(삭제)** — 사유는 A-3 |

이관 시 파일명은 gacha-map 컨벤션(`YYYYMMDD_<name>.sql`)을 따르고, **dev에 적용된 버전 번호와 이름을 유지**한다:

```
20260814010814  add_gacha_series_alias_model
20260820022202  add_gacha_product_category_model
```

> 이관은 **파일 이동만** 한다. dev에는 이미 적용된 상태이므로 **재적용하지 않는다.**

### A-2. 고아 마이그레이션 2건 복원

`fix_pita_defome_category_alias`, `improve_product_type_category_matching`은 dev에만 적용되고 파일이 없다.

**이 작업은 gacha-map 메인 세션이 처리한다** (Supabase MCP로 `schema_migrations.statements` 덤프 → gacha-map에 파일 생성). collector 쪽 조치 불필요. 인지만 하면 된다.

### A-3. `fix_gacha_series_collab_split_rules` 폐기 사유

이 파일은 시리즈명의 `×` 처리를 고치려던 것이다.

```
"짱구 × 산리오"  →  분리해야 함 (콜라보)
"헌터×헌터"      →  분리하면 안 됨 (제목의 일부)
```

**dev 데이터 실측 결과 이미 올바른 상태다:**

```
헌터×헌터                      ← 단일 시리즈로 존재 (분리 안 됨)
애니멀 어트랙션 『생물x보석』   ← 분리 안 됨
```

수정 내용이 후속 마이그레이션에 이미 반영된 것으로 판단된다. 파일을 남겨두면 나중에 재실행되어 백필이 덮어씌워질 위험이 있으므로 **삭제**한다.

### A-4. 앞으로의 규칙

- collector의 `supabase/migrations/`에 **택소노미 관련 DDL을 추가하지 않는다.**
- 테이블/컬럼/제약/인덱스/함수가 필요하면 **gacha-map에 요청**한다.
- collector가 담당하는 것은 **데이터를 넣고 갱신하는 스크립트**뿐이다.
- `CLAUDE.md` / `docs/db-schema.md`의 소유권 문구는 **그대로 둔다** (이미 올바름).

---

## B. collector 본업으로 남는 작업

### B-1. `name_parts.series` 미추출 4,195건 — 파싱 개선 (우선순위 높음)

시리즈 분류 커버리지가 57%(10,105 중 5,766)에 그치는 **근본 원인**이다.

```
name_parts.series 가 ko/ja 둘 다 빈 문자열   : 4,195   ← 진짜 원인
series 값 있는데 정규화 행 없음               :    53   ← 정규화는 정상
```

정규화 단계 문제가 아니라 **상품명 분해 단계에서 시리즈를 뽑아내지 못한 것**이다.

- 담당 스크립트: `scripts/decompose-gacha-product-names.ts` (`npm run decompose:gacha-product-names`)
- 요청: 빈 값 4,195건의 상품명 패턴을 분석해 추출 규칙을 보강한다. 규칙으로 안 되면 LLM 추출 경로를 검토한다.
- 목표: 시리즈 커버리지 **75% 이상**.
- 대상 목록 추출 쿼리:

```sql
SELECT id, name
FROM gacha_products
WHERE name_parts IS NOT NULL
  AND coalesce(name_parts->'series'->>'ko','') = ''
  AND coalesce(name_parts->'series'->>'ja','') = '';
```

### B-2. `refreshGachaProductSeries` 헬퍼 추가 + 호출 연결

**문제**: 카테고리는 갱신 경로가 있는데 시리즈는 없다.

```
카테고리:  refresh_gacha_product_categories()  ← 있음, collector가 호출 중
시리즈:    (없음)                              ← 최초 백필 SQL이 전부
```

그래서 신규 상품이 들어와도 `gacha_product_series`에 행이 생기지 않는다.

**gacha-map이 먼저 제공할 것**: `refresh_gacha_product_series(p_product_ids uuid[])` RPC
(기존 백필 로직을 함수로 추출. `relation_type`의 `primary`/`collaboration` 판정 로직 보존)

**collector가 할 것**: `scripts/lib/gacha-product-categories.ts`와 **완전히 동일한 패턴**으로 헬퍼를 만들고 같은 호출부에 연결한다.

- 신규 파일: `scripts/lib/gacha-product-series.ts`
  - `refreshGachaProductSeries(supabase, productIds?)`
  - `PGRST202` / schema cache 에러는 기존과 동일하게 **graceful하게 무시**한다 (RPC 배포 전에도 스크립트가 죽지 않도록)
- 호출을 연결할 스크립트 (카테고리와 동일한 5곳):
  - `scripts/collect-gacha-products.ts`
  - `scripts/decompose-gacha-product-names.ts`
  - `scripts/normalize-gacha-product-name-terms.ts`
  - `scripts/approve-gacha-product-name-candidates.ts`
  - `scripts/import-gacha-product-ko-names.ts`

> **순서 의존**: gacha-map이 RPC를 dev에 배포한 뒤 collector 연결을 검증한다. 다만 graceful 처리 덕분에 collector 쪽 작업을 먼저 머지해도 안전하다.

### B-3. 시리즈 자동 분류 배치 (gacha-map 스키마 작업 이후)

gacha-map이 `gacha_series`에 다음 컬럼을 추가한 **후**에 착수한다:

```
parent_id         계층(부모 시리즈)
merged_into_id    병합 추적
is_browsable      UI 노출 여부
kind_source       분류 출처
kind_confidence   분류 신뢰도
```

collector가 만들 배치 (신규 스크립트):

1. **`kind` 분류** — 2,719건 전부 `unknown`인 상태.
   - **기존 CHECK 도메인을 그대로 쓴다**: `anime / manga / game / character_brand / toy_line / franchise / other / unknown`
   - 입력: `name_ko`, `name_ja`, 소속 상품명 샘플 5건, 연결된 `genre` 카테고리
   - `kind_confidence < 0.7` → `unknown` 유지 + `note`에 후보만 기록. **자동 확정 금지.**
   - `kind_source = 'llm_batch_YYYYMMDD'`
   - 배치 50건, 재시도 3회
   - **착수 전 파일럿 100건으로 비용·정확도를 실측한다.**

2. **계층(parent) 부여** — 상품 3개 이상 시리즈(약 320건)로 **한정**
   - 1차 규칙: `name_ko_norm`이 다른 시리즈명을 접두 포함 → 부모 후보
   - 2차 LLM: 헬로키티 → 산리오 캐릭터즈 같은 IP 소속 관계
   - **깊이 2단 제한.** 조부모 이상 금지.

3. **롱테일 병합** — 상품 1개짜리 2,183건 (전체의 80%)
   - 다른 시리즈명을 접두 포함하면 그쪽으로 병합
   - `gacha_product_series` 재연결 → 원본은 `status='archived'` + `merged_into_id` 기록
   - **물리 삭제 금지.**
   - **UPDATE 전 dry-run 결과표(병합 전/후 쌍)를 출력하고 사용자 승인을 받는다.**
   - 복구 쿼리를 스크립트에 동봉한다.

4. **`name_ja` 한글 오염 정리** — 45건 (디즈니 캐릭터, 시나모롤, 무민, 디즈니 프린세스 등)
   - **before/after CSV를 먼저 생성**하고 확인 후 UPDATE
   - 확신 없는 건은 NULL 대신 `note`에 review 표시로 남긴다

---

## C. 건드리지 말 것

| 대상                                                        | 이유                                                                                                     |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `gacha_product_series.relation_type`                        | `primary`(5,696) / `collaboration`(140) 의미를 담고 있다. 유도 불가한 실데이터다. 제거 검토했다가 철회함 |
| `gacha_series_aliases` → `gacha_search_aliases` 미러 트리거 | 검색 RPC가 legacy 테이블을 읽고 있다. 끊으면 검색이 깨진다                                               |
| `gacha_series.kind` CHECK 도메인                            | 기존 8값을 그대로 쓴다. 재정의 검토했다가 철회함                                                         |
| `gacha_products.name_parts` 스키마                          | 변경 없음. 값 채우기(B-1)만 개선한다                                                                     |

---

## D. prod 배포 주의

prod에는 택소노미 테이블이 **하나도 없다.** 신규 마이그레이션만 적용하면 실패한다.

- 적용 순서: 기존 택소노미 마이그레이션 4건 → 신규 마이그레이션
- 마이그레이션 적용은 **gacha-map 메인 세션이 Supabase MCP로 수행**한다. collector에서 직접 적용하지 않는다.
- prod 백필은 **taxonomy 전용 명령으로 분리**한다. 외부 상품 수집 배치를 prod에 그대로 돌리지 않는다.
  - `--dry-run` 필수, DB host guard, 예상 row count 사전 출력, 롤백 절차 문서화
  - 저트래픽 시간대 실행

---

## 요약 — collector가 지금 할 일

| #   | 작업                                                   | 선행 조건                                           |
| --- | ------------------------------------------------------ | --------------------------------------------------- |
| A-1 | 택소노미 마이그레이션 2개 gacha-map으로 이관, 1개 삭제 | 없음 (지금 가능)                                    |
| A-4 | 앞으로 택소노미 DDL 추가 금지                          | 없음                                                |
| B-1 | `decompose-gacha-product-names` 시리즈 추출 규칙 보강  | 없음 (지금 가능)                                    |
| B-2 | `refreshGachaProductSeries` 헬퍼 + 5개 스크립트 연결   | gacha-map RPC 배포 (graceful 처리로 선행 머지 가능) |
| B-3 | kind 분류 / 계층 / 병합 / name_ja 정리 배치            | gacha-map 컬럼 추가 완료                            |
