# collector 인계: 자동 수집이 계속 돌아도 안전하도록 남은 5가지

작성일: 2026-08-25
대상 리포: `gacha-collector`
선행: `20260821-taxonomy-ownership-and-series-refresh.md`, `20260822-series-auto-classification.md`

## 배경

Phase 3(택소노미 정비)이 끝났고, 데이터 정합성 쪽은 대부분 방어됐다.

**이미 막힌 것** — 추가 조치 불필요:

| 문제                                              | 방어                                                                       |
| ------------------------------------------------- | -------------------------------------------------------------------------- |
| transliteration 중복 (같은 `name_ja`에 새 음차명) | 기존 대표 한글명 재사용 (collector 수정 완료)                              |
| 병합된 시리즈가 refresh로 부활                    | `refresh_gacha_product_series()` 가 `merged_into_id` 를 따라감             |
| 병합 체인으로 상품이 사라짐                       | AFTER 트리거 자동 평탄화 (`20260825_gacha_series_merge_chain_flatten.sql`) |
| 콜라보 전체 제목이 고아 시리즈로 남음             | 분리될 제목은 시리즈 엔티티를 만들지 않음                                  |
| 깊이 3단 / 자기참조 / 병합 상태 오류              | 트리거 + CHECK                                                             |

이 문서는 **아직 안 막힌 것 5가지**를 다룬다. 핵심은 "수집만 돌면 새 시리즈가 화면에 안 나온다"였고, 그중 가장 큰 건 gacha-map 쪽에서 구조로 해결했다.

---

## 1. ✅ `is_browsable` 산정 배치는 이제 멈춰도 된다 (gacha-map에서 처리 완료)

`is_browsable` 은 **완전히 파생 가능한 값**이었다. 2026-08-25 실측에서 `is_browsable = true` 319건과 `rollup_product_count >= 4` 319건이 정확히 일치했고 편차가 0이었다.

문제는 이 컬럼이 `DEFAULT false` 라서, **자동 수집으로 새 시리즈가 생기면 상품이 아무리 쌓여도 누가 산정 배치를 돌리기 전까지 영원히 화면에 안 나온다**는 것이었다.

**gacha-map 조치** (`20260825_gacha_series_browse_derived_threshold.sql`):

- `browse_gacha_series()` 가 저장된 플래그 대신 `rollup_product_count >= 4` 를 직접 본다
- 수동 제외용으로 `gacha_series.is_hidden` 을 새로 뒀다 (기본값 노출)
- `is_browsable` 은 DEPRECATED. 더 이상 아무도 읽지 않는다

**collector 조치**:

- `browsable-apply` / `browsable-dry-run` 실행 경로를 **더 이상 돌리지 않아도 된다.** 스크립트는 남겨둬도 무해하지만 정기 실행에서는 빼자
- 대신 **`refresh_gacha_browse_views()` 호출이 확실히 붙어 있어야 한다.** 이게 이제 유일한 노출 갱신 경로다

검증됨 (롤백 트랜잭션): 상품 3개짜리 시리즈에 1건을 추가하고 MV만 갱신하니 목록이 293 → 294로 늘었다. 산정 배치 없이 노출된다.

### 🔴 확인 요청

`refresh_gacha_browse_views()` 가 **상품 수집 배치**(`collect:gacha-products`) 종료 훅에도 연결돼 있는지 확인해 달라. 분류/병합 배치에만 붙어 있고 수집 배치에 없으면, 수집만 도는 평상시에 목록이 갱신되지 않는다.

연결 지점은 `refreshGachaProductSeries()` 를 부르는 5개 스크립트와 같다:

```
collect-gacha-products.ts
decompose-gacha-product-names.ts
normalize-gacha-product-name-terms.ts
approve-gacha-product-name-candidates.ts
import-gacha-product-ko-names.ts
```

호출 순서: `refresh_gacha_product_series()` → `refresh_gacha_browse_views()`. 후자가 전자의 결과를 집계하므로 순서가 중요하다.

---

## 2. `kind` 증분 분류 — 주기 배치 필요

새로 생긴 시리즈는 `kind = 'unknown'` 이다. 그대로 두면 kind 필터 칩(`애니메이션`, `게임`, `오리지널` 등)에 잡히지 않고, 시간이 지나면 `unknown` 이 다시 쌓인다.

- **대상**: `kind = 'unknown'` 이고 `rollup_product_count >= 4` 인 시리즈만. 전량 재분류하지 않는다
- **주기**: 주 1회면 충분
- **비용**: 증분이라 미미하다. 전체 2,719건이 약 $1.07 이었으니 주간 증분은 센트 단위
- 기존 규칙 유지: `kind_confidence < 0.7` 이면 `unknown` 유지, `kind_source = 'llm_batch_YYYYMMDD'`
- 도메인은 기존 8값 그대로 (`anime / manga / game / character_brand / toy_line / franchise / other / unknown`)

대상 추출:

```sql
select s.id, s.name_ko, s.name_ja
from public.gacha_series s
join public.gacha_series_browse b on b.series_id = s.id
where s.status = 'active'
  and s.kind = 'unknown'
  and b.rollup_product_count >= 4;
```

> `other` 는 오분류가 아니다. 확인해보니 `애니멀 어트랙션`, `일하는 고양이`, `꼬비토즈칸` 같은 일본 오리지널 캡슐토이 시리즈였고, UI에 `오리지널` 칩으로 노출하기로 했다. 프롬프트를 고칠 필요 없다.

---

## 3. `parent_id` 계층 — 주기 후보 산출, 적용은 승인 후

새 시리즈에는 계층이 붙지 않는다. 완전 자동화는 위험하다 — 지금까지 진행하면서 규칙만으로는 잡히지 않는 오판이 반복해서 나왔다.

- **주기**: 월 1회 정도, dry-run 만 자동으로 생성
- **적용은 사람 승인 후**

지금까지 확립된 필터 (계속 유지):

- `kind = 'toy_line'` 인 시리즈를 부모로 삼지 않는다 (IP가 사라진다)
- 부모는 `status = 'active'` 이고 `merged_into_id IS NULL` 인 것만
- 부모 `name_ko` 가 `gacha_categories` 에 같은 이름으로 있으면 제외 (일반명사)
- 깊이 2단 상한 (트리거가 강제하지만 후보 단계에서 걸러야 배치가 안 죽는다)
- 부모부터 확정하고 자식을 붙이는 순서

---

## 4. 일반명사·지명 시리즈가 계속 생성된다 — 파싱 단계에서 차단

현재 `other` 버킷에 이런 것들이 섞여 있다:

```
고양이(8) · 공룡(7) · 수족관(7) · 후지산(10) · 신칸센(7) · 동물(3) · 판다(5)
```

IP가 아니라 소재/지명인데 시리즈로 만들어졌다. 병합 후보에서 걸러내는 것으로 대응해 왔지만, **파싱이 계속 만들어내므로 근본은 그쪽이다.**

제안: `decompose-gacha-product-names` 에서 시리즈명을 확정하기 전에

- 같은 이름이 `gacha_categories`(active)에 있으면 시리즈로 만들지 않는다
- 지명·일반명사 스톱워드 목록을 두고 단독으로는 시리즈가 되지 않게 한다 (`후지산`, `아사쿠사`, `신칸센`, `수족관` 등)

이미 만들어진 것들은 `is_hidden = true` 로 감출 수 있다. 삭제하지 말 것.

---

## 5. `name_ja` 한글 오염 B그룹 15건

A그룹 31건은 null 처리 완료. B그룹 15건은 **일본어 원문이 살아있어서 null 처리하지 않았다.**

```
僕のヒーローア카デミア      "카" 한 글자
エヴァンゲ리オン           "리" 한 글자
ノラガ미 ARAGOTO           "미" 한 글자
…エンジンコレク션          "션" 한 글자
パイレーツ・オブ・カ리ビアン  "리" 한 글자
```

문자 단위 치환 버그로 보이며 원문이 거의 복구 가능하다.

- 1순위: 역치환 매핑 자동 복구 (`카→カ`, `리→リ`, `미→ミ`, `비→ビ`, `션→ション`). 복구 후 한글이 0이면 확정
- 2순위: 규칙으로 안 잡히면 `note` 에 `name_ja_review` 표시만 남기고 값은 그대로

browsable 은 2건뿐이라 급하지 않다.

```sql
select id, name_ko, name_ja from public.gacha_series
 where status = 'active'
   and name_ja ~ '[가-힣]'
   and name_ja ~ '[ぁ-ゟ゠-ヿ一-龯]';
```

---

## 우선순위

| #   | 항목                                               | 급함     | 비고                          |
| --- | -------------------------------------------------- | -------- | ----------------------------- |
| 1   | `refresh_gacha_browse_views()` 수집 배치 연결 확인 | **높음** | 이게 빠지면 목록이 갱신 안 됨 |
| 4   | 파싱 단계 일반명사 차단                            | 중       | 계속 쌓이는 문제              |
| 2   | `kind` 증분 분류 주기 배치                         | 중       | 주 1회                        |
| 3   | `parent_id` 주기 후보 산출                         | 낮       | 월 1회, 승인 필요             |
| 5   | `name_ja` B그룹 15건                               | 낮       | browsable 2건뿐               |

1번만 확인되면 **평상시 자동 수집은 안전하다.** 나머지는 품질을 점진적으로 올리는 작업이다.
