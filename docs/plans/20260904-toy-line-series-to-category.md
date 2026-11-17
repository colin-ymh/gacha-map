# toy_line 시리즈를 line 카테고리로 이관

> 🔴 **2026-09-06 후속 정정** — 이 문서가 `line` 사전에 넣은 24건 중 **4건은 형태가 아니라
> 브랜드였다.** 닛코리노·판다의 구멍·컵의 후치코·포켓토미카를 시리즈로 되돌린다.
>
> 이 문서는 커버리지(88% 미커버)를 근거로 "전부 오네무탄·메지루시와 같은 부류의 진짜
> 가챠 종류"라고 판정했는데, **커버리지는 형태냐 브랜드냐를 가리는 근거가 아니다.**
> 상품명에 외부 IP가 붙는 비율로 다시 재면 닛코리노 0%, 포켓토미카 0%, 판다의 구멍 1.3%,
> 컵의 후치코 3.4%다. 자체 캐릭터에 소재만 바꿔 다는 브랜드다.
>
> 반대로 `캡슐 플라레일`은 **유지**한다 — IP 종류는 8개로 적지만 상품 107개 전부가
> 토마스 IP를 달고 있어 형태 라인이 맞다.
>
> 후속 계획: `docs/plans/20260906-brand-lines-to-series-and-representative-image.md`

## Request

> 시리즈에는 애니메이션이나 프랜차이즈 같은것만 들어가게 하고, 오네무탄, 메지루시 같은
> 가챠 종류를 부르는건 카테고리로 들어가야할거같은데? 데이터 자체를 좀 클린하게 수정해야하지않나?

시리즈 축은 **IP**만 담고, 상품 형태·제품 라인을 가리키는 이름(오네무탄=자는 모습 마스코트,
메지루시=이름표 마스코트)은 **카테고리 축**으로 옮긴다. 표시 필터로 가리는 게 아니라 데이터를
정리한다.

## 배경 — 왜 지금 양쪽에 있나

2026-08월 1단계에서 "A안"으로 처리한 것은 `browse_gacha_series` RPC에
`and b.kind <> 'toy_line'` 한 줄을 추가한 **표시 차단**이었다. 시리즈 행은 그대로 뒀고,
`line` 카테고리 링크는 collector가 별도로 만들었다. 그래서 같은 개념이 두 테이블에 공존한다.

## 실측 (dev, 2026-09-04)

### 시리즈 kind 분포 (active)

| kind            | active  | browsable |
| --------------- | ------- | --------- |
| other           | 2,356   | 97        |
| anime           | 263     | 37        |
| franchise       | 223     | 44        |
| game            | 191     | 26        |
| character_brand | 188     | 49        |
| manga           | 177     | 28        |
| **toy_line**    | **216** | **31**    |
| unknown         | 93      | 5         |

### toy_line(active) 216개 내역

| 구분                                | 개수 | 비고                                   |
| ----------------------------------- | ---- | -------------------------------------- |
| 상품 4건 이상                       | 31   | `is_browsable=true` 31개와 정확히 일치 |
| 상품 1~3건                          | 185  | 롱테일                                 |
| 상품 0건                            | 0    | —                                      |
| 이미 같은 이름 `line` 카테고리 존재 | 2    | 메지루시, 오네무탄                     |
| 다른 category_type과 이름 충돌      | 0    | 이관 시 충돌 없음                      |

### 상품 링크 커버리지 — **통째 archive가 불가능한 이유**

toy_line 시리즈에 걸린 상품 링크 837건 중, `line` 카테고리로도 커버되는 것은 **98건뿐**.
**739건(88%)이 미커버**다.

미커버 상위: 닛코리노 178, 캡슐 플라레일 70, 판다의 구멍 60, 컵의 후치코 51, 푸티또 22,
포켓토미카 18. 전부 오네무탄·메지루시와 같은 부류의 진짜 가챠 종류인데, 대응하는 `line`
카테고리가 아직 만들어지지 않았을 뿐이다.

→ **archive만 하면 739건이 분류를 잃는다. 이관(승격)이 정답이다.**

기존 `line` 카테고리 17개 중 시리즈에도 이름이 겹치는 건 메지루시·오네무탄 2개뿐이고,
그 2개는 상품 링크가 **100% 포함관계**다 (메지루시 시리즈 9 ⊂ 카테고리 180,
오네무탄 시리즈 36 ⊂ 카테고리 90). 즉 이 2개에 한해서는 시리즈 행이 순수 잉여다.

### 롱테일 185개의 정체

| 구분                                          | 개수 |
| --------------------------------------------- | ---- |
| 상품 4건 이상 toy_line 이름으로 시작 (복합명) | 37   |
| 기존 `line` 카테고리 이름으로 시작 (복합명)   | 7    |
| 나머지                                        | 141  |

복합명 예: `오네무탄 TV 애니메이션 <단다단>`, `오네무탄 주술회전—사멸회유—`.
`오네무탄`(가챠 종류) × `단다단`(IP)이 한 시리즈로 뭉쳐 있는 파싱 부산물이다.
올바른 분해는 `카테고리: 오네무탄` + `시리즈: 단다단`.

### 재생성 문제

`toy_line` 시리즈 266개가 **전부 최근 30일 내 생성**(최신 2026-08-23)이다. collector가
지금도 만들고 있다. DB만 정리하면 다음 배치에서 되살아난다.

## Scope

1. **collector 수정 (선행, 필수)** — `toy_line`로 분류된 이름을 `gacha_series`가 아니라
   `gacha_categories(category_type='line')`에 적재하도록 파이프라인 변경.
   `gacha-collector` 리포 작업.
2. **데이터 이관 (dev → 확인 → prod)**
   - 상품 4건 이상 toy_line 31개 → `line` 카테고리로 승격, 상품 링크 이관
   - 이미 카테고리가 있는 2개(메지루시·오네무탄)는 신규 생성 없이 링크만 병합
   - 이관 후 원본 시리즈 행 `status='archived'`
3. **롱테일 185개 처리** — 복합명 분해 규칙 확정 후 별도 단계
4. **RPC 정리** — `browse_gacha_series`의 `kind <> 'toy_line'` 하드코딩 제거
   (데이터가 정리되면 불필요)
5. **UI** — 레일에 `line`(제품 라인) 축 노출

## Out of Scope

- `other` 2,356개 재분류. 노션 §6-3에 따르면 애니멀 어트랙션·일하는 고양이 같은
  **일본 오리지널 캡슐토이 IP**이며 분류 오류가 아니다. 이번 건과 성격이 다르다.
- `origin` 축 노출 (일본 1,355건으로 변별력 없음, 노션 §2 판단 유지)
- 시리즈 계층(`parent_id`) 재정비

## Relevant Files

| 경로                                                              | 역할                                                      |
| ----------------------------------------------------------------- | --------------------------------------------------------- |
| `gacha-collector` 리포 (별도)                                     | toy_line 분류·적재 파이프라인. **DDL 소유권이 여기 있음** |
| `supabase/migrations/`                                            | 이관 마이그레이션                                         |
| `apps/mobile/components/organisms/search/GachaBrowseSections.tsx` | 레일 축 추가                                              |
| `apps/mobile/app/browse/categories.tsx`                           | `type=line` 라벨                                          |
| `apps/mobile/app/browse/series.tsx`                               | `제품 라인` kind 칩 제거 (이미 미사용)                    |
| `apps/mobile/messages/*.json`                                     | `browse.section.line` / `browse.axis.line` 신규           |
| 노션 「가챠 카테고리·시리즈 탐색 기획」 §2, §6-3                  | `line` 미노출 판단 갱신 필요                              |

## 검토 후 방향 전환 (2026-09-04)

초안은 "toy_line 시리즈 → line 카테고리로 **데이터 이관**"이었다. codex 적대적 검토와
후속 실측 결과 **이 접근은 틀렸다.** 실제 구조는 다음과 같다.

### `line` 카테고리는 collector 분류 결과가 아니다

`refresh_gacha_product_categories()` 함수 안에 **하드코딩된 정규식 사전 17개**가 있고,
현재 `line` 카테고리 17개는 정확히 그 목록이다.

```sql
-- supabase/migrations/20260820022518_improve_product_type_category_matching.sql
with line_patterns(category_name_ko, source_pattern) as (values
  ('코로코레', 'ころコレ'),
  ('메지루시', 'めじるし'),
  ('오네무탄', 'おねむたん|オネムタン'),
  ...
```

같은 함수 안에 3중 블록이 있다: ① line 카테고리 upsert ② line alias ③ line 패턴 매칭.

닛코리노(178)·캡슐 플라레일(70)·판다의 구멍(60)·컵의 후치코(51)가 카테고리에 없던 이유는
분류 실패가 아니라 **사전에 등재되지 않아서**다.

→ **정답은 데이터 이관이 아니라 사전 확장이다.** 사전에 추가하고 refresh를 돌리면
카테고리 생성·alias·상품 링크가 전부 자동 생성된다.

### 이 전환으로 사라지는 리스크

| 초안의 문제                                              | 전환 후                                                                                    |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `relation_type`/`source`/`confidence`를 뭘로 채울지 미정 | 함수가 `relation_type='line'`, `source='known_product_line_term'`, `confidence=1`로 채운다 |
| 수동 insert가 다음 refresh에서 삭제됨                    | 사전 기반이라 refresh마다 재생성된다 (멱등)                                                |
| 롤백 전략 부재                                           | 사전에서 항목을 빼고 refresh하면 원복                                                      |
| `name_ko_norm` 전역 유니크 충돌                          | 함수의 기존 upsert 경로를 그대로 탄다                                                      |

### 반드시 지켜야 할 함정 (실측 확인됨)

1. **`source` 기본값이 `'name_parts'`인데, refresh 첫 줄이 이걸 지운다.**

   ```sql
   delete from public.gacha_product_categories pc
   where pc.source in ('name_parts', 'known_product_line_term')
   ```

   수동으로 링크를 넣을 일이 생기면 `source='manual'`을 써야 살아남는다.

2. **시리즈 archive는 durable하다.** `refresh_gacha_product_series()`의
   `on conflict (name_ko_norm) do update`가 `status`를 건드리지 않는다.
   단 `gacha_product_series` 링크는 매 refresh마다 재생성된다 (archived 시리즈를 가리킨 채).
   browse RPC가 `status='active'`로 거르므로 노출은 안 된다.

3. **RPC의 노출 임계값은 `rollup_product_count >= 4`다.**
   롱테일 185개는 지금 1~3건이라 안 뜨지만, 상품이 쌓여 4건을 넘기면 노출된다.
   → **`kind <> 'toy_line'` 필터는 롱테일까지 처리하기 전엔 제거하면 안 된다.**

4. `gacha_product_categories.relation_type`은 `tag/product_type/line/manual/collector_llm/unknown`,
   `gacha_product_series`는 `primary/collaboration/crossover/line/unknown`. 값 집합이 다르므로
   링크를 그대로 복사하면 CHECK 위반이다.

5. `gacha_categories.name_ko_norm`은 **category_type 무관 전역 유니크**
   (`gacha_categories_name_ko_norm_key`).

## Plan

### 1단계 — 사전 확장 (핵심)

상품 4건 이상 toy_line 31개 중 사전에 없는 것을 `line_patterns` / `line_aliases` /
line 카테고리 vocabulary 3곳에 추가한다. 일본어 패턴은 `gacha_products.name_ja`에서 확인됨:

| 한국어명      | 상품 수 | 일본어 패턴 (실측)   |
| ------------- | ------- | -------------------- |
| 닛코리노      | 178     | `にっこりーノ`       |
| 캡슐 플라레일 | 70      | `カプセルプラレール` |
| 판다의 구멍   | 60      | `パンダの穴`         |
| 컵의 후치코   | 51      | `コップのフチ子`     |
| 푸티또        | 22      | `PUTITTO`            |
| 포켓토미카    | 18      | `ポケットトミカ`     |

나머지 25개는 착수 시 같은 방식으로 실측해 채운다.

새 마이그레이션으로 `refresh_gacha_product_categories()`를 `CREATE OR REPLACE` 한다.
기존 함수 전문을 복사해 사전 블록만 늘리는 형태다.

**주의:** `카타즌`(93), `반쵸코`(60), `데포러버`(51), `마치보케`(49) 등은 이미 사전에 있고
카테고리도 있다. 중복 추가하지 말 것.

### 2단계 — refresh 실행 및 검증 (dev)

```sql
select public.refresh_gacha_product_categories();
select public.refresh_gacha_browse_views();
```

`REFRESH MATERIALIZED VIEW CONCURRENTLY a, b`는 PostgreSQL 문법이 아니다.
기존 helper `refresh_gacha_browse_views()`를 쓴다 (category → series 순서로 각각 refresh).

### 3단계 — toy_line 시리즈 archive

사전 확장으로 카테고리 커버리지가 확보된 시리즈만 `status='archived'`.
커버리지 미달인 것은 남긴다 (분류 손실 방지).

### 4단계 — 롱테일 185개

복합명(`오네무탄 TV 애니메이션 <단다단>` = 가챠 종류 × IP) 분해. 44개가 복합명 패턴.
**별도 작업으로 분리 권장.**

### 5단계 — RPC 필터 제거

**4단계 완료 후에만.** 롱테일이 남은 채로 제거하면 상품 누적 시 재노출된다.

### 6단계 — UI 노출

- `apps/web/src/app/api/gacha-browse/categories/route.ts` — 현재 `line`을 400으로 막고 있다
- `GachaBrowseSections.tsx` `RailKey`에 `line` 추가
- `useBrowseAxisOptions.ts` 축 추가
- i18n `browse.section.line` / `browse.axis.line` (ko/en/ja/zh)
- 노션 §2 `line` 미노출 판단 갱신 → Penpot 반영

### 7단계 — prod 적용

dev 확인 후. prod에서 동일 실측을 먼저 반복한다 (사전 매칭 결과가 다를 수 있음).

## Verification

- [ ] refresh 후 `line` 카테고리 17 → 예상 개수 도달
- [ ] 사전 추가분의 상품 링크가 `relation_type='line'`, `source='known_product_line_term'`
- [ ] refresh **두 번** 연속 실행해도 결과 동일 (멱등성)
- [ ] 기존 17개 카테고리의 상품 수가 줄지 않음
- [ ] archive 대상 시리즈의 상품이 전부 line 카테고리로 커버됨 (손실 0)
- [ ] `browse_gacha_series`에 toy_line 노출 없음 (필터 유지 상태)
- [ ] prod 동일 결과

## Risks / Questions

1. **정규식 오매칭.** `PUTITTO`처럼 짧은 라틴 문자열은 다른 상품명에 우연히 걸릴 수 있다.
   사전 추가 전 각 패턴의 매칭 건수를 dry-run으로 확인해야 한다.
2. **`판다의 구멍`(パンダの穴)은 제품 라인인가 브랜드인가.** 카테고리로 옳은지 확인 필요.
3. 롱테일 185개를 이번 범위에 넣을지 결정 필요 (분리 권장).
4. 함수 전문 복사 후 사전만 수정하는 방식이라 diff가 커진다. 사전을 별도 테이블로 빼는
   리팩터링이 더 나은지 판단 필요 — 단 이번 범위를 넘는다.
5. prod 데이터가 dev와 다를 수 있다. 적용 전 재실측 필수.
6. UI 노출은 노션 기획서 → Penpot → 프론트 순서를 지켜야 한다 (프로젝트 규칙).

## Adversarial Review

codex 검토 완료. 지적 7건 중 실측으로 재확인한 결과:

| 지적                                           | 판정                                                                                          |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------- |
| P0 롱테일 남긴 채 RPC 필터 제거 시 회귀        | **타당.** 임계값 `rollup_product_count >= 4` 확인. 5단계를 4단계 뒤로 배치                    |
| P0 `relation_type`/`source` 미정의로 제약 위반 | **타당.** 단 사전 확장 방식으로 전환하며 소멸                                                 |
| P0 collector 선행 조건 모호                    | **부분 타당.** 실제로는 collector가 아니라 이 리포의 SQL 사전 문제였음 — 전제 자체가 틀렸었다 |
| P1 `name_ko_norm` 전역 유니크 충돌             | **타당.** 확인됨                                                                              |
| P1 `REFRESH ... CONCURRENTLY a, b` 문법 오류   | **타당.** helper 사용으로 수정                                                                |
| P1 롤백 전략 부재                              | **타당.** 사전 방식 전환으로 크게 완화                                                        |
| P2 API가 `line`을 400 처리 / UI 축 없음        | **타당.** 6단계에 반영                                                                        |

## Final Plan

위 "Plan" 섹션이 최종안이다. 착수 전 사용자 확인 필요 항목:

1. 롱테일 185개를 이번 범위에 포함할지 (분리 권장)
2. 1단계 사전 확장 대상 31개 전체 목록 확정 (정규식 dry-run 결과 검토 포함)
3. UI 노출(6단계)을 이번에 할지, 데이터 정리만 먼저 할지

---

## 진행 상황 (2026-09-04, dev 적용 완료)

### 적용된 것

| 마이그레이션                                 | 내용                                              |
| -------------------------------------------- | ------------------------------------------------- |
| `expand_line_category_dictionary_categories` | `line` 카테고리 24개 추가 (17 → 41)               |
| `expand_line_category_dictionary_function`   | `refresh_gacha_product_categories()` 사전 17 → 41 |

커밋 파일: `supabase/migrations/20260904_expand_line_category_dictionary.sql`

이후 `refresh_gacha_product_categories()` + `refresh_gacha_browse_views()` 실행.

### 결과

- 링크 재생성: 삭제 18,780 / 생성 19,627 (**순증 847, 손실 0**)
- `line` 카테고리 상품 수가 dry-run 예측과 **정확히 일치**
  (닛코리노 212, 캡슐 플라레일 107, 판다의 구멍 78, 푸티또 76, 컵의 후치코 58 …)
- 기존 17개 카테고리 수치 **전부 불변** (메지루시 180, 카타즌 93, 오네무탄 90, 반쵸코 60 …)
- **멱등성 확인**: 2회차 실행에서 삭제 19,627 = 1회차 생성분과 일치, 재생성 수치 동일

### toy_line 커버리지

| 구분          | 시리즈 | 링크 | 커버 | 비율                 |
| ------------- | ------ | ---- | ---- | -------------------- |
| 상품 4건 이상 | 31     | 605  | 590  | **97.5%** (이전 12%) |
| 롱테일(1~3건) | 185    | 232  | 112  | 48.3%                |

미커버 15건은 **의도적으로 제외한 2개**가 전부다: 리카짱(9), 플라레일(6).

### 정규식 작성 시 걸린 함정

`'ntc\.Puff'`, `'1/64\s?PLUS'`처럼 백슬래시를 쓰면 파일 생성 과정에서 `\\`로 이중
이스케이프돼 정규식이 깨졌다. 백슬래시 없는 동등 표현으로 바꿨다:
`ntc[.]Puff`, `1/64 ?PLUS`.

### 남은 작업

- [ ] **리카짱 kind 수정** — `toy_line` → `character_brand`. リカちゃん은 인형 IP다
- [ ] **플라레일 판단** — 브랜드로 볼지 라인으로 볼지. `プラレール` 패턴은
      `カプセルプラレール` 107건을 삼키므로 넣으려면 negative lookbehind 필요
- [ ] toy_line 시리즈 archive (커버된 것부터)
- [ ] 롱테일 185개 복합명 분해
- [ ] `browse_gacha_series`의 `kind <> 'toy_line'` 필터 제거 (**롱테일 처리 후에만**)
- [ ] prod 적용 (dev 확인 후, prod에서 실측 반복 필수)
- [ ] `line` 축 UI 노출 (노션 → Penpot → 프론트 순서)

---

## 후속 작업 (2026-09-04, dev 적용 완료)

마이그레이션: `20260904_archive_covered_toy_line_series.sql`

### 결과

| 항목                | 이전 | 이후   |
| ------------------- | ---- | ------ |
| active `toy_line`   | 216  | **81** |
| archived `toy_line` | 50   | 174    |
| `character_brand`   | 188  | 195    |
| `franchise`         | 223  | 226    |
| `anime`             | 263  | 264    |

- archive 124개 (커버리지 100%인 것만) + kind 교정 11개
- **분류 손실 0** — archive된 시리즈의 상품 700건이 전부 `line` 카테고리 유지

### kind 교정 내역 (가챠 종류가 아니라 IP)

| → `character_brand` | 리카짱(9), 리카의 옷장(3), 리카(1), 리카 산리오 캐릭터(1), 리카짱 옷장 시리즈(1), 레트로 퍼비(1), 산리오 헬로키티 봉제인형 볼체인(1) |
| → `franchise` | 플라레일(6), 디즈니 모터스(1), 레고 미니피겨 시리즈 3(1) |
| → `anime` | 릴릴 페어릴 ~~요정의 문~~(1) |

### 🔴 판단 뒤집기 — RPC 필터는 제거하지 않는다

초안과 중간 계획 모두 "데이터가 정리되면 `kind <> 'toy_line'` 필터는 불필요"라고
썼다. **틀렸다. 필터는 영구 방어선으로 유지해야 한다.**

근거:

1. collector가 `toy_line` 시리즈를 계속 만든다. dev의 266개가 **전부 최근 30일 내
   생성**이다. 정리해도 새로 들어온다.
2. line 카테고리 사전은 **사후 대응**이다. 신규 제품 라인은 항상 "사전에 없는 상태"로
   먼저 도착하고, 사람이 사전에 등재해야 카테고리가 생긴다.
3. 그 시차 동안 필터가 없으면 신규 `toy_line`이 상품 4건을 넘는 순간 시리즈 목록에
   그대로 노출된다. 정확히 이번에 고친 문제가 재발한다.

현재 잔여 active `toy_line` 81개 중 `rollup_product_count >= 4`인 것은 0건이라
지금 당장은 필터를 빼도 티가 안 난다. 그래서 더 위험하다 — 조용히 있다가 나중에
터진다.

→ **`browse_gacha_series`의 `kind <> 'toy_line'` 필터를 유지한다.** 이 항목을
"제거해야 할 임시 조치"가 아니라 "의도된 설계"로 재분류한다.

### 잔여 active toy_line 81개

전부 미커버(또는 부분 커버)라 archive하면 무분류가 되므로 남겼다. 상품 1~3건짜리
롱테일이고 세 부류가 섞여 있다:

| 유형             | 예                                                                                                                  | 처리 방향                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| 새 라인 후보     | 3D 파일 시리즈(5변형), 식품 샘플 시리즈(3), 냥코 가전/카페/캠프, 데포메·데포메미니, 니토탄                          | 사전 추가 → 커버되면 archive |
| 표기 흔들림 중복 | 규무또/규뭇또!, 모아 쌓아!/모아 쌓아 올려!/모아서 겹쳐서! (전부 `あつめてかさねて`), 컵 테두리의 녀석/컵의 가장자리 | 병합                         |
| 파싱 부산물      | `IP4`(상품명이 태그 나열), `Digit Spinner`                                                                          | archive 또는 hidden          |

필터를 유지하기로 했으므로 이 81개는 **노출 위험이 없다.** 데이터 위생 문제로
남고, 우선순위는 낮다.

## 남은 작업

- [ ] **prod 적용** — dev 확인 후. prod에서 실측 반복 필수.
      적용 순서: `20260904_expand_line_category_dictionary.sql` →
      `refresh_gacha_product_categories()` → `20260904_archive_covered_toy_line_series.sql` →
      `refresh_gacha_browse_views()`
- [ ] 리카(Licca) 계열 5개 시리즈 병합 (표기 흔들림)
- [ ] 잔여 toy_line 81개 정리 (우선순위 낮음)
- [ ] `line` 축 UI 노출 — 노션 §2의 "1차 UI 미노출" 판단 갱신 → Penpot → 프론트.
      현재 `/api/gacha-browse/categories`가 `line`을 400으로 막고 있다
- [ ] collector가 제품 라인을 `name_parts.series`에 넣지 않도록 하는 근본 수정
      (gacha-collector 리포)
