# 오늘의 가챠 — 인기 슬롯 도입

> v2 — codex adversarial review 반영본. BLOCKER 4건 + MAJOR 8건 수정.

## Context

「오늘의 가챠」는 현재 **순수 랜덤**이다. `get_daily_featured_gacha()`가 후보 풀에서
`md5(날짜 + 상품id)` 순으로 섞어 10개를 뽑고, 7일 내 재등장만 막는다.
사용자 행동(찜·뽑기)은 선정에 전혀 반영되지 않는다.

목표: 최근에 찜이 늘거나 뽑기가 많아진 상품이 앞에 오도록 한다.

### 데이터 현실 (prod 실측, 2026-08-20)

| 신호                      | 전체 | 최근 7일             | 7일 상품수 | 7일 유저수 |
| ------------------------- | ---- | -------------------- | ---------- | ---------- |
| 찜 `product_wishlists`    | 40   | 4                    | 4          | 4          |
| 뽑기 `gacha_roll_results` | 141  | 49                   | 27         | 17         |
| 조회                      | —    | **추적 테이블 없음** | —          | —          |

가입자 131명, 후보 풀 2,151개.

### ⚠️ 윈도우를 7일→14일로 바꾼 이유 (설계의 핵심)

「eligible 조건 + 최소 2명」을 모두 통과하는 인기 후보 수를 실측했다.

| 윈도우   | 최소 1명 | **최소 2명** | 최소 3명 |
| -------- | -------- | ------------ | -------- |
| **7일**  | 19       | **1**        | 0        |
| **14일** | 64       | **14**       | 6        |
| 30일     | 66       | 14           | 6        |
| 60일     | 76       | 18           | 6        |

**7일 윈도우로는 후보가 1개뿐이라 3칸 중 2칸이 항상 랜덤 폴백된다** — 기능이 사실상
동작하지 않으면서 복잡도만 늘어난다. 14일로 늘리면 후보 14개가 확보되고,
30일 이상으로 늘려도 더 늘지 않으므로 **14일이 최적점**이다.

최근성은 윈도우가 아니라 **시간 감쇠**가 담당한다. 반감기 5일이면 14일 전 활동은
현재 활동의 약 14% 가중치라, 후보 풀만 넓히고 순위는 여전히 최근 활동이 지배한다.

### 결정 사항 (사용자)

- 방식: **하이브리드 슬롯** — 앞 3칸 인기 / 뒤 7칸 기존 랜덤
- 신호: **뽑기 + 찜 + 시간 감쇠**. 조회수 계측은 범위 제외
- UI: **배지 없음, 순서만 변경** → 화면 요소 변화 0 → Notion 기획서·Penpot 선행 불필요
- dev 테스트 행 임시 삽입 승인됨 (검증 직후 삭제)

### 반드시 알아야 할 사실 (전부 실측 확인)

1. **prod에 뽑기 유니크 제약이 없다.** `20260706_remove_gacha_roll_day_unique_index.sql`로
   제거됐다. 인덱스는 `pkey`와 `(user_id, rolled_at)` 둘뿐. 한 명이 같은 상품을 무제한
   반복 가능하고 실제로 상위 항목이 14롤/6명이다. → **유저 단위 중복 제거 필수.**
2. **`daily_featured_gacha`에 `UNIQUE(featured_date, rank)`와 `UNIQUE(featured_date, product_id)`가
   둘 다 있다.** rank 부여를 잘못하면 조용히 누락된다.
3. **그날 결과는 한 번 뽑히면 고정.** 행이 있으면 재추첨하지 않으므로 RPC를 고쳐도
   오늘 목록은 안 바뀐다.
4. **모바일이 KST 날짜로 AsyncStorage 캐시**한다 (`useFeaturedGacha.ts:6-7`, 키 `_v4`).
5. `gacha_roll_results`의 타임스탬프 컬럼은 `created_at`이 아니라 **`rolled_at`**이다.

---

## Scope

- `get_daily_featured_gacha()` 교체 — 인기 점수 + 하이브리드 슬롯
- `daily_featured_gacha`에 `slot_type` 컬럼 추가 (**DB 내부용. API 반환에는 노출 안 함**)
- 집계 윈도우 인덱스 보강
- dev 적용 → 검증 → 사용자 승인 → prod

## Out of Scope

- 조회수 계측 신규 구축
- UI 변경 일체. `GachaRollCard.tsx` 안 건드림
- 모바일·웹 코드 변경 (**RPC 반환 형태를 그대로 유지**하므로 불필요)
- 별도 「지금 인기」 섹션
- 검색 개선 건(별도 작업)의 prod 적용

---

## Relevant Files

- `supabase/migrations/20260806_require_variant_image_in_daily_featured_gacha.sql` — **현행 최신 RPC 본**
- `supabase/migrations/20260718_add_daily_featured_gacha.sql` — 테이블 정의·제약
- `supabase/migrations/20260811_get_new_arrival_gacha_backfill.sql` — **`daily_featured_gacha`를 참조하는 최신 신상 RPC. 회귀 대상**
- `supabase/migrations/20260812_gacha_search_foundation.sql` — 최근 마이그레이션 관례(주석·GRANT·`REVOKE`·`NOTIFY pgrst`)
- `apps/web/src/app/api/gacha-products/route.ts:183-239` — `sort=featured` 분기. **수정 불필요**
- `apps/mobile/hooks/useFeaturedGacha.ts` — 캐시 확인용. **수정 불필요**

신규: `supabase/migrations/20260820_daily_featured_popular_slots.sql`
계획서 사본: `docs/plans/20260820-daily-featured-popular-slots.md` (CLAUDE.md 규정 위치)

---

## Plan

### 1. 스키마

```sql
ALTER TABLE public.daily_featured_gacha
  ADD COLUMN IF NOT EXISTS slot_type text NOT NULL DEFAULT 'random'
    CHECK (slot_type IN ('popular','random'));

CREATE INDEX IF NOT EXISTS gacha_roll_results_rolled_at_idx
  ON public.gacha_roll_results (rolled_at DESC) INCLUDE (product_id, user_id);
CREATE INDEX IF NOT EXISTS product_wishlists_created_at_idx
  ON public.product_wishlists (created_at DESC) INCLUDE (product_id, user_id);
```

`slot_type`은 **인기 슬롯에만 다른 쿨다운을 적용하기 위해 저장이 필요**하다.
기존 행은 `'random'`이 되며 이는 사실과 일치한다(과거엔 랜덤만 존재).
**API 반환에는 넣지 않는다** — 배지가 없는 지금 클라이언트 계약을 늘릴 이유가 없다.

### 2. 인기 점수

윈도우 14일, KST 일자 기준.

```
activity_date = (ts AT TIME ZONE 'Asia/Seoul')::date
age_days      = greatest(0, p_date - activity_date)        -- 음수 방어
decay         = power(0.5, age_days / p_half_life_days)    -- 반감기 5일

-- 뽑기: 반드시 (product_id, user_id, activity_date) 단위로 중복 제거 후 합산
roll_score = Σ over DISTINCT(product_id, user_id, activity_date) : p_weight_roll * decay
-- 찜: (user_id, product_id)가 이미 유니크
wish_score = Σ : p_weight_wish * decay

score = roll_score + wish_score        -- numeric 으로 계산
```

- **dedup 키에 `product_id`가 반드시 들어가야 한다.** `(user_id, 일자)`만으로 접으면
  한 유저가 같은 날 여러 상품을 뽑았을 때 상품 하나만 남아 집계가 망가진다.
- 윈도우 경계: `activity_date BETWEEN p_date - (p_window_days - 1) AND p_date`
  (= 오늘 포함 14 KST 일자)
- **최소 유저 수**는 `(product_id, user_id)` 쌍을 UNION한 뒤 상품별로 센다.
  찜 유저 수 + 뽑기 유저 수를 단순히 더하면 둘 다 한 유저가 중복 계산된다.
- 가중치 기본 **찜 3.0 / 뽑기 1.0**. 찜은 건수가 적지만 의도가 훨씬 강하다.
- **결정적 tie-breaker 필수**: 동점이 흔하므로
  `ORDER BY score DESC, distinct_users DESC, last_activity_date DESC, product_id ASC`.

### 3. 슬롯 배분

| 슬롯 | 개수     | 후보                        | 재등장 규칙                                                                |
| ---- | -------- | --------------------------- | -------------------------------------------------------------------------- |
| 인기 | 3        | score>0 & 유저≥2 & eligible | 직전 `p_popular_cooldown_days`(2)개 날짜에 **인기 슬롯으로** 나왔으면 제외 |
| 랜덤 | 나머지 7 | 기존과 동일                 | 최근 7일 노출 시 후순위 (기존 로직 유지)                                   |

- 인기 후보도 기존 eligible 조건을 그대로 만족해야 한다
  (`status='active'`, `official_image_url` 있음, 이미지 있는 active 변형 보유).
- 인기 슬롯에 7일 금지를 걸지 않는 이유: 지금 인기인 걸 보여주는 칸인데 일주일 막으면
  목적과 모순된다. 쿨다운 2일 = **`p_date - 1`, `p_date - 2` 두 날짜에 인기로 나온 상품 제외.**
- 인기 후보 부족 시 그 칸은 랜덤으로 채운다.
- 랜덤 풀에서 **그날 인기로 확정된 상품을 명시적으로 제외**한다.

### 4. rank 부여 — 구멍 방지

`ON CONFLICT DO NOTHING`에 중복 제거를 의존하지 않는다. 조용히 누락되면
`v_existing_count > 0` 때문에 다음 호출도 재생성하지 않아 **10칸 미만 상태가 하루 종일 고정된다.**

```
최종 목록 = (인기 확정분) UNION ALL (랜덤 확정분, 인기분 제외)
          → 여기서 product_id 중복이 없음을 보장
          → row_number() OVER (ORDER BY 인기먼저, 그다음 랜덤순) 으로 rank 1..N 연속 부여
          → INSERT
```

`ON CONFLICT`는 동시성 안전망으로만 남기고, 정상 경로에서는 절대 발동하지 않아야 한다.

### 5. 파라미터 방어

RPC는 `anon` 실행 가능하므로 내부 API 상수만 믿으면 안 된다. 함수 진입부에서 clamp한다.

```
v_count         := least(greatest(coalesce(p_count,10), 0), 50)
v_popular_count := least(greatest(coalesce(p_popular_count,3), 0), v_count)
v_window        := least(greatest(coalesce(p_window_days,14), 1), 90)
v_half_life     := least(greatest(coalesce(p_half_life_days,5.0), 0.5), 60.0)
v_w_wish/v_w_roll := greatest(coalesce(...), 0)      -- 음수 금지
v_min_users     := greatest(coalesce(p_min_distinct_users,2), 1)
v_cooldown      := least(greatest(coalesce(p_popular_cooldown_days,2), 0), 30)
```

### 6. 미래 날짜 쓰기 차단

**현행 RPC는 anon이 임의 날짜로 호출해 그 날짜 행을 영구 생성할 수 있다.**
미래 날짜 행이 생기면 그날 실제 추첨이 스킵되고, retention 삭제 범위(`p_date` 기준)도 왜곡된다.

→ **생성(INSERT)은 `p_date = 오늘 KST`일 때만 수행한다.** 다른 날짜는 이미 저장된 행을
읽기만 하고, 없으면 빈 결과를 돌려준다. 기존 호출부는 항상 오늘만 쓰므로 영향 없다.

이 제약 때문에 검증도 미래 날짜를 쓰지 않는다(아래 Verification 참조).

### 7. RPC 교체

```
get_daily_featured_gacha(
  p_date, p_count DEFAULT 10, p_popular_count DEFAULT 3,
  p_window_days DEFAULT 14, p_half_life_days DEFAULT 5.0,
  p_weight_wish DEFAULT 3.0, p_weight_roll DEFAULT 1.0,
  p_min_distinct_users DEFAULT 2, p_popular_cooldown_days DEFAULT 2
)
```

- **반환 컬럼은 현행과 100% 동일하게 유지한다.** `slot_type`/`popularity_score`를 추가하지
  않으므로 shared 타입·API 계약 문서를 건드릴 필요가 없다. 검증은 테이블을 직접 조회한다.
- 파라미터 추가는 **기존 2-인자 함수와 오버로드 충돌(모호성 에러)을 일으키므로
  반드시 기존 함수를 `DROP` 후 재생성**한다.
- `DROP` 후 `GRANT EXECUTE`를 다시 부여해야 한다.
- 말미에 `NOTIFY pgrst, 'reload schema';`
- 유지: `pg_advisory_xact_lock`, 그날 행 있으면 재추첨 안 함, 30일 retention,
  `SECURITY DEFINER` + `SET search_path = public, pg_temp`

**하위호환**: `route.ts`는 `{ p_count }` 명명 인자만 넘기고(`route.ts:189`),
`withDisplayName`이 객체 spread라 안전하다. `useFeaturedGacha.ts:19`의 `isValidFeatured()`는
배열 길이와 `official_image_url`만 보므로 영향 없다. **DB만 배포하면 된다.**

---

## Verification

### dev — 미래 날짜를 쓰지 않는다

생성은 오늘만 가능하도록 막았으므로, 과거 이력은 **`daily_featured_gacha`에 직접 행을
삽입해 시뮬레이션**하고, 오늘 행을 지웠다 다시 뽑는 방식으로 검증한다.
dev에는 실사용자가 없어 오늘 행 재생성이 안전하다.

1. **후보 산출** — 점수 CTE만 단독 실행해 상위 목록·`distinct_users`·`score` 확인.
   14일 윈도우에서 후보가 14개 나오는지 (prod 실측치와 대조).
2. **슬롯 배분** — 오늘 행 삭제 후 RPC 호출 →
   `select rank, slot_type from daily_featured_gacha where featured_date = 오늘 order by rank;`
   → rank가 **1..10 연속, 구멍 없음**. rank 1~3이 `popular`.
3. **rank 구멍 회귀** — 인기 후보 중 하나를 랜덤 풀에도 들어가게 만든 상태에서 재생성 →
   중복 없이 10행, rank 연속인지. (`ON CONFLICT`로 조용히 누락되지 않는지)
4. **폴백** — `p_min_distinct_users => 99` → 10행 전부 `random`, 에러 없음, rank 연속.
5. **유저 중복 제거** ★ — dev에 한 유저가 한 상품에 뽑기 5건(같은 날)을 삽입 →
   점수가 1회분으로만 잡히는지. **검증 후 삽입 행 삭제.**
6. **dedup 키 검증** ★ — 한 유저가 같은 날 **서로 다른 상품 3개**를 뽑은 데이터 삽입 →
   3개 상품 모두 점수를 받는지. (`product_id`가 dedup 키에서 빠지면 1개만 남는다)
7. **시간 감쇠** — `p_half_life_days`를 0.5 / 5 / 60으로 바꿔 순위가 실제로 달라지는지.
8. **가중치** — `p_weight_wish => 0` 시 찜만 있는 상품이 인기에서 빠지는지.
9. **최소 유저 UNION** — 같은 유저가 한 상품에 찜+뽑기를 모두 한 케이스를 만들어
   `distinct_users`가 **2가 아니라 1**로 세어지는지.
10. **인기 쿨다운** — `daily_featured_gacha`에 어제·그제 `popular` 행을 직접 삽입 →
    오늘 재생성 시 그 상품들이 인기 슬롯에서 **모두** 빠지는지 (2일 전 것도 빠져야 함).
11. **파라미터 방어** — `p_count => 0`, `p_popular_count => 999`, `p_half_life_days => 0`,
    `p_weight_roll => -5` 각각 호출 → 에러 없이 안전 동작.
12. **미래 날짜 쓰기 차단** ★ — `get_daily_featured_gacha('2026-12-31')` 호출 후
    `select count(*) from daily_featured_gacha where featured_date='2026-12-31'` → **0이어야 한다.**
13. **멱등성** — 같은 날 2회 호출 → 결과 동일, 행 증가 없음.
14. **회귀** — `get_new_arrival_gacha()`(최신 `20260811` 본)가 오늘의 가챠와 겹치지 않는지.
15. **성능** — `EXPLAIN (ANALYZE, BUFFERS)`. 하루 첫 호출이 사용자 대기이므로 측정. 목표 < 300ms.
16. **보안** — `get_advisors(type='security')` 신규 경고 없음.
    `anon` EXECUTE 권한이 기존과 동일한지 (비로그인도 오늘의 가챠를 보므로 허용이 맞음).
17. **정리** — 5·6·9·10에서 삽입한 테스트 행 전부 삭제 후 카운트 0 확인.

### API

RPC 직접 검증과 **분리한다.** 오늘 행이 이미 있으면 API는 기존 결과만 돌려주므로
새 로직을 보려면 dev에서 오늘 행을 지운 뒤 호출해야 한다.

```
curl 'localhost:3000/api/gacha-products?sort=featured&include_shops=true' \
  | python3 -m json.tool | head -40
```

→ 10건, 전부 `official_image_url` 있음, **반환 필드가 기존과 동일**한지.
(`isValidFeatured()`가 10개 초과·이미지 없음을 거부하므로 이 조건이 깨지면 앱이 캐시를 버린다)

### 모바일

코드 변경 없음. 캐시 때문에 즉시 반영되지 않으므로 확인하려면 AsyncStorage의
`featured_gacha_date_v4`를 지운다. **캐시 키는 올리지 않는다.**

### 빌드

`rtk npm run typecheck`, `rtk npm run lint` (코드 변경이 없어도 회귀 확인용)

---

## Risks / Questions

| 리스크                                                          | 대응                                                                                                                                       |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **표본이 얇다.** 14일 윈도우로 후보 14개 확보했으나 여전히 소수 | 최소 2명 임계치 + 2일 쿨다운으로 회전. 데이터가 쌓이면 자연히 개선                                                                         |
| 한 명이 반복 뽑기로 순위 조작                                   | `(product_id, user_id, KST일자)` dedup. prod에 유니크 제약이 없어 이게 유일한 방어선                                                       |
| **다계정 어뷰징**                                               | 지금 규모(가입 131명)에선 실질 위협이 아니라고 판단. 최소 2명 임계치가 1차 방어. 규모가 커지면 별도 대응 필요 — **미해결 항목으로 남긴다** |
| 인기 상품이 계속 1번 칸 차지                                    | 2일 쿨다운 + 감쇠                                                                                                                          |
| 기본값(반감기 5일, 찜 3.0, 임계 2명, 윈도우 14일)이 추정치      | 전부 RPC 파라미터. dev 실데이터로 튜닝 후 확정. 재배포 불필요                                                                              |
| RPC DROP + CREATE                                               | 파라미터 추가는 오버로드 모호성을 일으켜 DROP이 **필수**. 단일 트랜잭션 + `GRANT` 재부여 + `NOTIFY pgrst`                                  |
| prod 마이그레이션                                               | dev 검증 후 **사용자 승인 받고** 적용. `main` 머지 전 완료 (CLAUDE.md)                                                                     |

**미해결 / 확인 필요**

1. **Notion에 「오늘의 가챠」 전용 기획서가 없다.** 「가챠 돌려보기 기획」에도 캐러셀 선정
   규칙은 없다. UI 변경이 0이라 Spec Rule의 "UI 작업" 에는 해당하지 않지만,
   **노출 알고리즘은 제품 동작 변경**이므로 사용자 승인을 기록으로 남긴다.
2. 다계정 어뷰징 대응은 이번 범위 밖.

## 완료 조건

- [ ] `20260820_daily_featured_popular_slots.sql` 작성 + dev 적용
- [ ] Verification 1~17 통과 (특히 ★ 표시 5·6·12)
- [ ] API 반환 형태가 기존과 동일 (`isValidFeatured()` 조건 유지)
- [ ] 파라미터 기본값을 dev 실데이터로 확정
- [ ] 계획서를 `docs/plans/20260820-daily-featured-popular-slots.md` 로 복사
- [ ] 사용자 승인 후 prod 적용
