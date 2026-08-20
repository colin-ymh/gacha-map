# gacha-collector 작업 요청 프롬프트

아래 블록을 `~/Desktop/gacha-collector`에서 그대로 붙여넣는다.

> ⚠️ **선행 조건**: `gacha_search_aliases` 테이블은 아직 **dev에만** 존재한다.
> prod 마이그레이션 적용 전에는 prod 대상 실행이 불가능하다.
> dev(`epcsyfirxeqzjfnltcai`)로 먼저 개발·검증하고, prod 적용 후 prod 실행한다.

---

## 프롬프트 (여기서부터 복사)

가챠맵 검색용 **별칭 사전 생성 스크립트**를 이 저장소에 추가해줘.

### 배경

가챠맵 검색이 개편되면서 오타 허용(pg_trgm), 다중 토큰 AND, 상세(변형) 상품명 검색이 들어갔다.
하지만 커뮤니티 약칭은 원리상 알고리즘으로 못 푼다:

- `먼작귀` → `치이카와` (「なんか小さくてかわいいやつ」의 의역. 공통 문자 0개)
- `나히아` / `히로아카` → `나의 히어로 아카데미아`

문자열 유사도가 0이라 **사전으로만** 해결된다. 그 사전을 이 스크립트가 채운다.

### 산출물

`npm run generate:gacha-search-aliases` 스크립트 1개.
기존 `generate:gacha-product-ko-names`와 같은 구조·같은 OpenAI 설정
(`OPENAI_API_KEY`, `OPENAI_TRANSLATION_MODEL`)을 따른다.

CLI 옵션: `--limit=N`, `--dry-run`, `--series="..."`(단건 테스트용).

### 입력

정식 명칭은 이미 DB에 있다. 새로 만들지 말고 이걸 읽어라.

```sql
select distinct
  name_parts->'series'->>'ko' as series_ko,
  name_parts->'series'->>'ja' as series_ja
from public.gacha_products
where status = 'active'
  and name_parts->'series'->>'ko' is not null;
```

prod 기준 약 2,789개. 이미 `gacha_search_aliases`에 해당 시리즈로 적재한 게 있으면 건너뛰어
재실행이 중복을 만들지 않게 해라.

### 출력 대상 테이블

`public.gacha_search_aliases`

| 컬럼              | 채우나   | 값                                                                            |
| ----------------- | -------- | ----------------------------------------------------------------------------- |
| `alias`           | **필수** | 사용자가 칠 법한 검색어. 예: `먼작귀`                                         |
| `canonical_terms` | **필수** | `text[]`. 확장될 정식 명칭. 예: `{'치이카와','ちいかわ'}`                     |
| `alias_type`      | **필수** | `abbreviation` / `nickname` / `romaji` / `typo` / `translation` / `character` |
| `locale`          | 권장     | `ko` / `ja` / `en`                                                            |
| `status`          | **필수** | 항상 `'pending'`                                                              |
| `source`          | **필수** | 항상 `'collector_llm'`                                                        |
| `note`            | 권장     | 근거·출처. 어드민 승인 판단에 쓰인다                                          |

**`alias_norm`과 `canonical_norms`는 절대 쓰지 마라.** 생성 컬럼과 트리거가 자동으로 채운다.

`canonical_terms`에는 **한국어 정식 명칭과 일본어 원제를 함께** 넣어라.
검색 문서에 두 언어가 다 들어 있어서 확장 항목이 많을수록 재현율이 오른다.

접속은 service_role 키로 한다(RLS 우회). 삽입 예:

```sql
insert into public.gacha_search_aliases
  (alias, canonical_terms, alias_type, locale, status, source, note)
values
  ('먼작귀', array['치이카와','ちいかわ'], 'nickname', 'ko', 'pending', 'collector_llm', '커뮤니티 통용 약칭');
```

### LLM에 시킬 것

시리즈 1건당, 한국인 가챠 이용자가 실제로 검색창에 칠 법한 표현을 뽑는다:

1. 한국어 약칭 / 커뮤니티 별명 — `나의 히어로 아카데미아` → `나히아`, `히로아카`
2. 일본어 원제 약칭 — `僕のヒーローアカデミア` → `ヒロアカ`
3. 로마자 / 영문 약어 — `MHA`, `chiikawa`
4. 흔한 오타·표기 흔들림 — `치이카와` → `치카와`, `찌이카와`
5. 대표 캐릭터명 — 그 시리즈를 대표하는 경우에만 (`alias_type='character'`)

구조화 출력(JSON)으로 받아라:

```json
{
  "aliases": [
    {
      "alias": "먼작귀",
      "alias_type": "nickname",
      "locale": "ko",
      "confidence": 0.95,
      "note": "커뮤니티 통용 약칭"
    }
  ]
}
```

`confidence < 0.7`은 버려라.

### 품질 가드 — 이게 제일 중요하다

**재현율보다 정밀도가 우선이다. 잘못된 별칭 하나가 그 검색어를 통째로 망가뜨린다.**
확신이 없으면 넣지 마라. 아래는 코드로 강제해라. LLM 프롬프트에만 적어두는 걸론 부족하다.

1. `alias` 2자 이상.
2. **범용어 블록리스트** — 어떤 시리즈의 별칭도 될 수 없다:
   `피규어`, `캡슐`, `가샤폰`, `가챠`, `마스코트`, `키홀더`, `아크릴`, `스탠드`,
   `인형`, `봉제인형`, `스트랩`, `뱃지`, `카드`, `컬렉션`, `미니어처`
3. **다른 시리즈의 정식 명칭과 충돌하면 폐기.** 예를 들어 `원피스`를 어떤 시리즈의 별칭으로
   넣으면 실제 『원피스』 검색이 오염된다. 삽입 전 확인:
   ```sql
   select 1 from public.gacha_products
   where status = 'active'
     and public.gacha_normalize_search_text(name_parts->'series'->>'ko')
         = public.gacha_normalize_search_text($1);
   ```
4. `alias`가 자기 시리즈명과 정규화 후 동일하면 무의미하므로 폐기.
5. **같은 `alias`의 `pending` 중복은 skip.** upsert 하지 말고 존재 확인 후 insert.
   (유니크 인덱스는 `status='approved'`인 행에만 걸려 있어 DB가 막아주지 않는다.
   `pending` 중복을 여러 건 허용하는 건 어드민이 후보 중 하나를 고르게 하려는 의도지,
   같은 스크립트가 매번 같은 걸 또 넣으라는 뜻이 아니다.)

### 승인 흐름 — 안심하고 대량 적재해도 된다

`pending` / `rejected` 상태는 검색 동작에 **아무 영향이 없다.**
어드민이 `status='approved'`로 바꿔야만 검색에 반영된다.

### 다른 파이프라인에도 추가할 것

상품·변형을 수집·갱신하는 기존 스크립트 **전부**의 마지막에 이 호출을 넣어라:

```sql
select public.refresh_gacha_product_search_docs();
```

배경: `gacha_products` / `gacha_product_variants` 트리거는 `product_id`를 큐에 넣기만 한다
(행마다 변형 전체를 재집계하면 벌크 upsert가 사실상 멈춘다). 실제 검색 문서 재계산은 위 함수가 한다.
pg_cron이 2분 주기로도 돌리므로 빠뜨려도 최대 2분 뒤엔 반영되지만, 수집 직후 확인이 필요하면 직접 호출해라.

**트리거를 비활성화하려 하지 마라.** service_role에는 테이블 소유자 권한이 없어 실패한다.
애초에 큐 적재는 O(1)이라 비활성화할 이유가 없다.

### 함께 요청하는 백필

검색 품질에 직결되는데 비어 있다 (prod 기준):

| 항목                          | 건수  | 영향                                             |
| ----------------------------- | ----- | ------------------------------------------------ |
| `name_parts`가 없는 활성 상품 | 2,358 | 시리즈·태그 검색 사각지대. 별칭 확장도 안 걸린다 |
| `name_ko`가 빈 활성 변형      | 5,853 | 상세 상품명 한국어 검색 커버리지에 직결          |

별칭 생성과 별개 작업이니 우선순위만 잡아서 알려줘.

### 완료 기준

- `--dry-run --limit=5`로 5개 시리즈 결과를 눈으로 확인 가능
- dev DB에 100건 정도 적재 후 아래가 정상:
  ```sql
  select status, source, count(*) from public.gacha_search_aliases group by 1,2;
  select alias, alias_norm, canonical_terms, canonical_norms
  from public.gacha_search_aliases order by created_at desc limit 20;
  ```
  → `alias_norm` / `canonical_norms`가 자동으로 채워져 있어야 한다
- 같은 명령을 두 번 돌려도 중복 행이 생기지 않는다
- 임의로 1건을 `approved`로 바꾸면 검색에 반영된다:
  ```sql
  select name_ko, match_score, match_kind, matched_aliases
  from public.search_gacha_products('먼작귀', null, 5, 0);
  ```

전체 스키마·계약은 가챠맵 저장소의
`docs/collector-handoff/20260812-search-alias-generation.md` 참고.

## 프롬프트 (여기까지)
