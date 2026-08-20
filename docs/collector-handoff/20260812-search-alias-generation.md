# 검색 별칭 사전 생성 — gacha-collector 핸드오프

작성일: 2026-08-12
대상 저장소: `~/Desktop/gacha-collector`
관련 마이그레이션: `supabase/migrations/20260812_gacha_search_aliases.sql`,
`20260812_gacha_search_foundation.sql`, `20260812_search_gacha_products_v2.sql`

---

## 1. 왜 필요한가

가챠맵 검색이 v2로 바뀌면서 오타 허용(trigram), 다중 토큰 AND, 변형(상세) 상품명 검색,
관련도 랭킹이 들어갔다. 하지만 **커뮤니티 약칭은 원리상 알고리즘으로 못 푼다.**

| 사용자 입력 | 정식 명칭    | 공통 문자 |
| ----------- | ------------ | --------- |
| 먼작귀      | 치이카와     | 0         |
| 나히아      | 나의히어로아카데미아 | 부분 |
| 젠레스      | 젠레스 존 제로 | 부분    |

`먼작귀`는 「なんか小さくてかわいいやつ」의 한국어 의역(먼가 작고 귀여운 녀석)에서 온 말이라
`치이카와`와 문자열 유사도가 0이다. 이건 **사전으로만** 해결된다.
그 사전 데이터를 collector가 채운다.

---

## 2. 쓰기 대상 테이블

`public.gacha_search_aliases`

| 컬럼              | 타입     | collector가 채우나 | 설명                                                                 |
| ----------------- | -------- | ------------------ | -------------------------------------------------------------------- |
| `id`              | uuid     | ✗ (기본값)         |                                                                      |
| `alias`           | text     | **✓ 필수**         | 사용자가 입력할 법한 검색어. 예: `먼작귀`                            |
| `alias_norm`      | text     | ✗ (생성 컬럼)      | `gacha_normalize_search_text(alias)` 자동 계산. **직접 쓰지 말 것**   |
| `canonical_terms` | text[]   | **✓ 필수**         | 확장될 정식 명칭들. 예: `{'치이카와','ちいかわ'}`                     |
| `canonical_norms` | text[]   | ✗ (트리거)         | BEFORE 트리거가 파생. **직접 쓰지 말 것**                            |
| `alias_type`      | text     | **✓ 필수**         | `abbreviation` / `nickname` / `romaji` / `typo` / `translation` / `character` |
| `locale`          | text     | 권장               | `ko` / `ja` / `en`                                                   |
| `status`          | text     | **✓ `'pending'`**  | 승인 전엔 검색에 전혀 반영되지 않는다                                |
| `source`          | text     | **✓ `'collector_llm'`** |                                                                 |
| `note`            | text     | 권장               | 근거·출처를 남기면 어드민 승인이 빨라진다                            |

제약:

- `btrim(alias) <> ''`
- `cardinality(canonical_terms) > 0`
- `alias_type`, `locale`, `status`, `source` 는 CHECK 로 값이 고정돼 있다
- **유니크 인덱스는 `status='approved'` 인 행에만 걸린다.**
  즉 같은 `alias`로 `pending` 후보를 여러 건 넣어도 충돌하지 않는다.
  (어드민이 그중 하나를 골라 승인하는 구조. 먼저 들어온 나쁜 후보가 좋은 후보를 막지 않도록 한 설계)

권한: collector는 `service_role`이므로 RLS를 우회한다. 별도 정책 대응 불필요.

### 삽입 예시

```sql
insert into public.gacha_search_aliases
  (alias, canonical_terms, alias_type, locale, status, source, note)
values
  ('먼작귀', array['치이카와','ちいかわ'], 'nickname',     'ko', 'pending', 'collector_llm', '커뮤니티 통용 약칭'),
  ('히로아카', array['나의 히어로 아카데미아','僕のヒーローアカデミア'], 'abbreviation', 'ko', 'pending', 'collector_llm', null);
```

---

## 3. 입력 소스

정식 명칭 목록은 이미 `name_parts.series`에 들어 있다. 이걸 그대로 쓴다.

```sql
select distinct
  name_parts->'series'->>'ko' as series_ko,
  name_parts->'series'->>'ja' as series_ja
from public.gacha_products
where status = 'active'
  and name_parts->'series'->>'ko' is not null;
```

prod 기준 약 **2,789개**의 서로 다른 시리즈가 나온다.

---

## 4. LLM 생성 스펙

시리즈 1건당, 한국인 가챠 이용자가 실제로 검색창에 칠 법한 표현을 배열로 뽑는다.

생성 대상:

1. **한국어 약칭 / 커뮤니티 별명** — `나의 히어로 아카데미아` → `나히아`, `히로아카`
2. **일본어 원제 약칭** — `僕のヒーローアカデミア` → `ヒロアカ`
3. **로마자 / 영문 약어** — `MHA`, `chiikawa`
4. **흔한 오타·표기 흔들림** — `치이카와` → `치카와`, `찌이카와`
5. **대표 캐릭터명** (`alias_type='character'`) — 그 시리즈를 대표하는 경우에만

각 항목의 `canonical_terms`에는 **한국어 정식 명칭과 일본어 원제를 함께** 넣는다.
검색 문서에 두 언어가 모두 들어 있어서 확장 항목이 많을수록 재현율이 올라간다.

---

## 5. 품질 가드 (필수)

이걸 지키지 않으면 검색 품질이 오히려 나빠진다. 승인 단계에서 대량 반려된다.

- `alias`는 **2자 이상**
- **범용어 금지** — 아래 같은 단어는 어떤 시리즈에도 별칭이 될 수 없다:
  `피규어`, `캡슐`, `가샤폰`, `가챠`, `마스코트`, `키홀더`, `아크릴`, `스탠드`,
  `인형`, `봉제인형`, `스트랩`, `뱃지`, `카드`, `컬렉션`, `미니어처`
- **다른 시리즈의 정식 명칭과 충돌하면 폐기.** 예: `원피스`를 어떤 시리즈의 별칭으로 넣으면
  실제 『원피스』 검색이 오염된다. 삽입 전 아래로 확인:
  ```sql
  select 1 from public.gacha_products
  where status='active'
    and public.gacha_normalize_search_text(name_parts->'series'->>'ko')
        = public.gacha_normalize_search_text(:alias);
  ```
- **같은 `alias`의 `pending` 중복은 skip.** upsert 하지 말고 존재 확인 후 insert.
- 확신이 없으면 넣지 않는다. 재현율보다 정밀도가 중요하다 —
  잘못된 별칭 하나가 그 검색어를 통째로 망가뜨린다.

---

## 6. 승인 흐름

```
collector → status='pending' 적재
          → 어드민이 검토 후 status='approved'
          → 이때부터 검색에 반영
```

`pending` / `rejected` 상태는 검색 동작에 **아무 영향이 없다.** 안심하고 대량 적재해도 된다.

---

## 7. ingest 후 필수 호출

상품/변형을 수집·갱신한 뒤 **반드시** 다음을 호출한다.

```sql
select public.refresh_gacha_product_search_docs();          -- 대기 큐 배치 처리
-- 또는 특정 상품만 즉시 반영
select public.refresh_gacha_product_search_docs(array[...]::uuid[]);
```

배경:

- `gacha_products` / `gacha_product_variants`에 건 트리거는 `product_id`를 큐에 넣기만 한다.
  (행마다 변형 전체를 재집계하면 벌크 upsert가 사실상 멈추기 때문)
- 실제 검색 문서 재계산은 위 함수가 한다. pg_cron이 2분 주기로도 돌리므로
  호출을 빠뜨려도 최대 2분 뒤엔 반영되지만, 수집 직후 확인이 필요하면 직접 호출할 것.
- **트리거를 비활성화하려 하지 말 것.** service_role에는 테이블 소유자 권한이 없어 실패하며,
  애초에 큐 적재는 O(1)이라 비활성화할 이유가 없다.

> `refresh_gacha_product_search_docs`는 `service_role`에만 EXECUTE가 부여돼 있다.
> anon/authenticated로는 호출되지 않는다.

---

## 8. 함께 요청하는 백필

검색 품질에 직결되는데 현재 비어 있는 데이터다. (prod 기준 수치)

| 항목                                            | 건수  | 왜 필요한가                                                    |
| ----------------------------------------------- | ----- | -------------------------------------------------------------- |
| `name_parts`가 아예 없는 활성 상품              | 2,358 | 시리즈·태그 검색 사각지대. 별칭 확장도 이 상품들엔 안 걸린다   |
| `name_ko`가 비어 있는 활성 변형                 | 5,853 | 상세(변형) 상품명 한국어 검색 커버리지에 직결                  |

---

## 9. 완료 확인 방법

```sql
-- 적재 현황
select status, source, count(*) from public.gacha_search_aliases group by 1,2;

-- 정규화가 제대로 파생됐는지 (직접 채우면 안 되는 두 컬럼)
select alias, alias_norm, canonical_terms, canonical_norms
from public.gacha_search_aliases order by created_at desc limit 20;

-- 승인 후 실제 검색 반영 확인
select name_ko, match_score, match_kind, matched_aliases
from public.search_gacha_products('먼작귀', null, 5, 0);
```
