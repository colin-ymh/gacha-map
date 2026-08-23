# collector 인계 (Phase 3): 시리즈 자동 분류 · 계층 · 롱테일 정리

작성일: 2026-08-22
대상 리포: `gacha-collector`
관련 계획: `gacha-map/docs/plans/20260821-gacha-taxonomy-restructure.md` (Phase 3)
선행 인계: `docs/collector-handoff/20260821-taxonomy-ownership-and-series-refresh.md`

## 선행 조건 — 이미 완료됨

gacha-map 쪽 Phase 1 / Phase 2가 dev에 적용되어 있다. **collector는 바로 착수 가능하다.**

### 새로 쓸 수 있는 컬럼 (`gacha_series`)

| 컬럼              | 타입                           | 용도                                |
| ----------------- | ------------------------------ | ----------------------------------- |
| `parent_id`       | uuid FK self                   | 계층(부모 시리즈). 깊이 2단 제한    |
| `merged_into_id`  | uuid FK self                   | 병합 대상. `status='archived'` 필수 |
| `is_browsable`    | boolean NOT NULL DEFAULT false | UI 목록 노출 여부                   |
| `kind_source`     | text                           | 분류 출처 (`llm_batch_YYYYMMDD` 등) |
| `kind_confidence` | real                           | 0~1                                 |

### 새 RPC

`refresh_gacha_product_series(p_product_ids uuid[] default null)` — 배포 완료. `scripts/lib/gacha-product-series.ts`가 이미 호출하므로 **`PGRST202` 없이 정상 동작**한다. 한 번 돌려서 확인해 달라.

이 함수는 `merged_into_id`를 따라가므로, **병합한 시리즈는 이후 refresh로 되살아나지 않는다.**

### 🔴 추가 요청 (2026-08-23) — 집계 뷰 갱신 호출

브라우징 화면용 집계 materialized view 2개가 dev에 배포됐다.

```
gacha_category_browse   카테고리별 상품 수 · 대표 이미지
gacha_series_browse     시리즈별 상품 수(자손 롤업 포함) · 하위 개수 · 대표 이미지
```

**이 뷰들은 자동 갱신되지 않는다.** 택소노미 데이터를 바꾸는 배치가 끝나면 반드시 호출해 달라:

```ts
await supabase.rpc("refresh_gacha_browse_views");
```

- 대상: 작업 1~4(kind 분류 / 계층 / 병합 / `is_browsable`) 배치 **각각의 종료 시점**, 그리고 `decompose:gacha-product-names` 등 상품 수집·재분해 배치 종료 시점.
- `REFRESH MATERIALIZED VIEW CONCURRENTLY`를 쓰므로 **트랜잭션 안에서 호출하면 실패**한다. 자동 커밋 컨텍스트에서 단독 호출할 것.
- 배치 도중 여러 번 부를 필요 없다. 종료 훅에서 1회면 충분하다.
- 호출을 빠뜨리면 화면의 상품 수·노출 목록이 옛날 값으로 굳는다.

`refresh_gacha_product_series()`와 마찬가지로, RPC 미배포 환경을 대비해 `PGRST202`는 graceful하게 무시하는 편이 안전하다.

---

## DB가 거부하는 것 — 미리 알고 있어야 할 제약

배치가 아래를 시도하면 **에러로 거부**된다. 방어 코드 없이 짜면 배치가 중단된다.

| 시도                                                 | 결과                                    |
| ---------------------------------------------------- | --------------------------------------- |
| `parent_id = id` (자기참조)                          | CHECK 위반                              |
| 손자 만들기 (부모가 이미 자식)                       | `gacha_series depth limit (2) exceeded` |
| 자식이 이미 있는 시리즈를 자식으로 만들기            | `already has children`                  |
| `merged_into_id` 설정하면서 `status`를 `active`로 둠 | CHECK 위반                              |
| 이미 병합된 시리즈를 병합 대상으로 지정 (병합 체인)  | `merge chain not allowed`               |
| `kind_confidence`가 0~1 밖                           | CHECK 위반                              |
| `kind`를 기존 8값 밖의 값으로                        | CHECK 위반                              |

**`kind` 허용값 (변경 금지)**:
`anime` / `manga` / `game` / `character_brand` / `toy_line` / `franchise` / `other` / `unknown`

**`status` 허용값**: `active` / `hidden` / `archived` — `merged`는 없다. 병합은 `archived` + `merged_into_id`로 표현한다.

---

## 현재 데이터 실측 (dev, 2026-08-22)

```
gacha_series                     2,719   (kind 전부 unknown)
  상품 3개 이상 (노출 후보)          320
  상품 1개 (롱테일)               2,183
  접두 규칙상 병합 후보               303
  접두 규칙상 부모-자식 후보           49
name_ja에 한글 오염                  45
gacha_product_series             5,836   (primary 5,696 / collaboration 140)
커버된 상품                        5,766 / 10,105 (57%)
```

---

## 작업 1 — `kind` 분류 (2,719건)

### 입력

- `gacha_series.name_ko`, `name_ja`
- 해당 시리즈 소속 상품명 샘플 **최대 5건** (`gacha_products.name` / `name_ko`)
- 연결된 `genre` 카테고리 (`gacha_product_categories` → `gacha_categories where category_type='genre'`)

### 출력

`kind` + `kind_confidence` + `kind_source = 'llm_batch_YYYYMMDD'`

### 규칙

- **`kind_confidence < 0.7` 이면 `kind='unknown'` 유지.** 후보값은 `note`에만 기록하고 자동 확정하지 않는다.
- 배치 50건, 실패 시 재시도 3회.
- 멱등하게: 이미 `kind_source`가 같은 배치 ID면 skip.

### 분류 기준

| kind              | 의미                        | 예                                           |
| ----------------- | --------------------------- | -------------------------------------------- |
| `anime`           | 애니메이션 원작/기반        | 귀멸의 칼날, 주술회전, 하이큐!!              |
| `manga`           | 만화 원작 (애니화 안 됨)    | —                                            |
| `game`            | 게임 IP                     | 포켓몬스터, 별의 커비                        |
| `character_brand` | 캐릭터 자체가 브랜드        | 산리오 캐릭터즈, 헬로키티, 치이카와, 무민    |
| `franchise`       | 영화/미디어 프랜차이즈      | 스타워즈, 토이 스토리, 디즈니 프린세스       |
| `toy_line`        | 제조사 제품 라인            | 캡슐 플라레일, 컵의 후치코, 오네무탄, 푸티또 |
| `other`           | 위에 안 맞음                | 일하는 고양이                                |
| `unknown`         | 판단 불가 / confidence 낮음 | —                                            |

> **UI 연결**: "애니메이션 시리즈별 탐색"은 `kind IN ('anime','manga')`로 매핑한다. 이 두 값의 정확도가 가장 중요하다.

### 완료 기준

`kind='unknown'` 비율 **30% 이하**.

---

## 작업 2 — 계층(`parent_id`) 부여

**상품 3개 이상 시리즈(약 320건)로 한정한다.** 롱테일 전체에 계층을 붙이지 않는다.

### 1단계 — 규칙 기반 (약 49건)

`name_ko_norm`이 다른 시리즈명을 접두로 포함하면 부모 후보:

```
산리오 캐릭터즈 좋아하는 리카짱  →  산리오 캐릭터즈
```

### 2단계 — LLM (규칙으로 못 잡는 IP 소속)

```
헬로키티   →  산리오 캐릭터즈
시나모롤   →  산리오 캐릭터즈
구데타마   →  산리오 캐릭터즈
```

### 제약

- **깊이 2단.** 조부모 이상 금지 (트리거가 거부한다).
- 부모가 되는 시리즈는 `is_browsable = true` 강제.
- 부모 후보가 자식이 될 수 없고, 자식이 부모가 될 수 없다. **부모부터 확정한 뒤 자식을 붙이는 순서**로 짜야 트리거에 안 걸린다.

---

## 작업 3 — 롱테일 병합 (신중히)

싱글톤 2,183건 중 접두 규칙 병합 후보 **303건**.

### 절차 (순서 엄수)

1. 병합 쌍 후보를 뽑는다 (자식 norm이 부모 norm으로 시작, 부모는 상품 3개 이상).
2. **dry-run 결과표를 출력한다.** 각 행에 `병합 전 이름 / 병합 후 이름 / 옮겨질 상품 수`.
3. **사용자 승인을 받는다.** 승인 없이 UPDATE 금지.
4. 실행:
   - `gacha_product_series`를 부모로 재연결
   - 원본을 `status='archived'`, `merged_into_id=<부모 id>`로 설정
5. **물리 삭제 금지.**
6. 복구 쿼리를 스크립트에 동봉한다:

```sql
-- 특정 배치 되돌리기
update public.gacha_series
set status = 'active', merged_into_id = null
where merged_into_id is not null
  and note like '%<배치ID>%';
-- 이후 refresh_gacha_product_series() 재실행으로 매핑 복원
```

### 주의

`refresh_gacha_product_series()`가 `merged_into_id`를 따라가므로, 병합 후 refresh를 돌려도 매핑이 부모로 유지된다. **병합 전에 반드시 이 동작을 dev에서 1회 확인해 달라.**

---

## 작업 4 — `is_browsable` 산정

계층 롤업 후(자손 상품 수 합산) **상품 3개 이상 → `true`**.

- 멱등 배치로 구현한다. 여러 번 돌려도 같은 결과여야 한다.
- 부모 시리즈는 자손 합산 기준으로 판정한다.
- 병합된(`archived`) 시리즈는 항상 `false`.

**예상 결과: 200~400건.** 이 범위를 크게 벗어나면 보고해 달라 (임계값 재조정 필요).

---

## 작업 5 — `name_ja` 한글 오염 정리 (45건)

```
디즈니 캐릭터 / 시나모롤 / 무민 / 디즈니 프린세스 …
```

`name_ja`에 한국어가 들어가 있어 i18n이 깨진다.

### 절차

1. **before/after CSV를 먼저 생성**한다.
2. 확인 후 UPDATE.
3. 확신 없는 건은 **NULL 처리하지 말고** `note`에 review 표시로 남긴다.

대상 추출:

```sql
select id, name_ko, name_ja from public.gacha_series where name_ja ~ '[가-힣]';
```

---

## LLM 설정

**콜렉터의 기존 OpenAI 경로를 그대로 재사용한다.** (별도 게이트웨이 도입하지 않음)

현재 콜렉터가 쓰는 모델: `gpt-5.4-nano`, `gpt-5.4-mini`, `gpt-4o-mini`, `gpt-4o`.

권장:

- **작업 1 `kind` 분류 → `gpt-5.4-mini`.** IP 성격 판단이라 `nano`는 부족할 가능성이 높다.
- **작업 2 계층 판정 → `gpt-5.4-mini`.** 소속 관계 추론이 필요하다.

### 착수 전 필수 — 파일럿

**전체 2,719건을 돌리기 전에 100건 파일럿을 먼저 실행한다.**

보고할 것:

- 소요 시간 / 토큰 / 비용
- 육안 검수 정확도 (100건 중 몇 건 맞았는지)
- `confidence >= 0.7` 비율

파일럿 결과를 보고 전체 실행 여부를 결정한다.

---

## 검증 쿼리

```sql
-- kind 분포
select kind, count(*), round(avg(kind_confidence)::numeric, 2) avg_conf
from public.gacha_series group by 1 order by 2 desc;

-- 계층 무결성 (둘 다 0이어야 한다)
select count(*) depth_over_2 from public.gacha_series c
  join public.gacha_series p on p.id = c.parent_id where p.parent_id is not null;
select count(*) cycles from public.gacha_series a
  join public.gacha_series b on b.id = a.parent_id and a.id = b.parent_id;

-- 병합 정합성 (0이어야 한다)
select count(*) bad_merge from public.gacha_series
where merged_into_id is not null and status <> 'archived';

-- 노출 후보 수 (200~400 기대)
select count(*) from public.gacha_series where is_browsable;

-- 커버리지
select round(100.0 * count(distinct ps.product_id) / (select count(*) from public.gacha_products where status='active'), 1) pct
from public.gacha_product_series ps;
```

---

## 작업 순서 (의존성 있음)

```
0. refresh_gacha_product_series() 동작 확인
1. kind 분류 파일럿 100건 → 보고 → 승인 → 전체 2,719건
2. 계층 부여 (부모 먼저, 자식 나중)
3. 롱테일 병합 dry-run → 승인 → 실행
4. is_browsable 산정 (2·3 이후여야 롤업이 맞다)
5. name_ja 정리 (독립, 언제 해도 됨)
```

---

## 건드리지 말 것 (재확인)

| 대상                                                        | 이유                                              |
| ----------------------------------------------------------- | ------------------------------------------------- |
| `gacha_product_series.relation_type`                        | `primary`(5,696) / `collaboration`(140) 의미 보존 |
| `gacha_series_aliases` → `gacha_search_aliases` 미러 트리거 | 검색이 legacy 테이블을 읽는다                     |
| `kind` / `status` CHECK 도메인                              | 기존 값만 사용                                    |
| DDL 전반                                                    | 컬럼·제약이 더 필요하면 **gacha-map에 요청**한다  |

---

## 보고 형식

작업 완료 시 프로젝트 룰대로 보고하고, 마지막 줄에 `Slack summary:` 를 포함해 달라.
