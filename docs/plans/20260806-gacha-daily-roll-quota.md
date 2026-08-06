# 가챠 뽑기 일일 횟수 제한 + 친구 초대 보상

## Context

가챠 뽑기에 총량 제한이 사실상 없다. `apps/web/src/app/api/gacha-products/[id]/roll/_utils.ts:1`의 `DAILY_LIMIT = 9999`로 상한이 비활성화돼 있다. 상품이 늘어날수록 하루 뽑기 횟수가 무한정 늘어나 뽑기의 희소성이 사라진다.

목표는 두 가지다.

1. **총량 통제** — 하루 총 5회. 매일 KST 0시 리셋, 미사용분 이월 없음.
2. **공유 성장 루프** — 결과 공유 링크를 친구가 클릭하면 초대자에게 +1회. 한 친구당 하루 1회, 하루 최대 +20회.

### 코드베이스 실제 상태 (초기 가정에서 수정됨)

조사 결과 상황이 처음 생각과 달랐다. 아래가 검증된 사실이다.

- **DB의 "상품당 하루 1회" 제약은 이미 제거됨.** `20260706_remove_gacha_roll_day_unique_index.sql`, `20260706_remove_gacha_roll_unique_constraint.sql` 두 개가 인덱스와 제약을 모두 드롭한다. → 계획에 DROP 마이그레이션 불필요. 단 **dev/prod에 실제 적용됐는지 확인은 필요**.
- **그러나 "상품당 하루 1회"는 API 레이어에서 여전히 강제된다.** `roll-status/route.ts`가 오늘 이 상품을 뽑았으면 `{ canRoll: false, reason: "already_rolled" }`를 반환하고, 모바일 `app/gacha/[id].tsx:228-260, 683`이 이걸로 FAB을 잠근다. **여기가 진짜 제거 지점이다.**
- **총량 제한 골격은 이미 있다.** `roll/route.ts`가 전 상품 합산 카운트로 409 `daily_limit`을 반환하고, `GachaRollPermission.remainingToday`도 타입에 존재한다. 상수와 보너스만 얹으면 된다.
- **`roll/route.ts:117-140`의 23505 ephemeral 폴백은 죽은 코드다.** 유니크 제약이 사라져 도달 불가.
- **모바일은 409를 조용히 삼킨다.** `hooks/useGachaRoll.ts:84` — `// Limit removed — treat as idle`. 지금 상태로 서버 제한만 켜면 유저는 2.5초 애니메이션 후 아무 일도 안 일어나는 화면을 본다. **릴리스 게이팅 필수.**

---

## 확정된 정책

| 항목             | 값                                                   |
| ---------------- | ---------------------------------------------------- |
| 기본 일일 횟수   | 5회                                                  |
| 리셋             | 매일 KST 0시, 이월 없음                              |
| 친구 dedup       | (초대자, 방문자, KST날짜) — 한 친구당 **하루** 1회   |
| 초대 보너스 상한 | 하루 +20회 (일 최대 25회)                            |
| 클릭 인정 기준   | 웹 랜딩 방문 + httpOnly 쿠키 dedup (앱 설치 불필요)  |
| 링크 형태        | 기존 결과 링크 + `?ref={code}`                       |
| 상품당 하루 1회  | **제거** (`roll-status`의 `already_rolled` 삭제)     |
| 소진 시 UX       | FAB에 잔여 배지, 0이면 비활성 + 탭 시 공유 유도 모달 |

---

## 선행 블로커

### B1. ~~공유 링크 슬러그 파싱이 웹에 없음~~ (조사 중 정정)

처음에는 `parse-stats.ts`가 고아 파일이라 판단했으나, 이는 브랜치를 잘못 본 결과였다.
`fix/web-share-messages`에는 `parseSlug()`가 `page.tsx`/`opengraph-image.tsx` 양쪽에 정상 연결돼 있다.

다만 **작업 베이스인 `develop`에는 `parse-stats.ts`가 없다.** 통계 접미사가 붙은 링크는
develop 기준으로는 익명 폴백으로 떨어진다. 이는 `fix/web-share-messages`가 develop으로
들어올 때 해결되는 사안이라 이 작업의 범위에서 제외한다.

대신 리퍼럴 핑이 슬러그 파싱에 의존하지 않도록 만들었다 — 앞 36자를 UUID로 검증해서
쓰므로 두 슬러그 형식 모두에서 동작한다.

### B2. 모바일 브랜치 미머지

모바일 공유 코드는 `feat/mobile-link-share`에만 있고 `main` 미머지. Phase 4는 그 이후.

### B3. 기획서 / 계획 파일 위치

- 프로젝트 규칙상 최종 계획은 `docs/plans/20260806-gacha-daily-roll-quota.md`로 옮긴다.
- 모바일 UI(FAB 배지, 소진 모달) 착수 전 노션 기획서 확인 필요.
- prod 마이그레이션 적용 전 사용자 확인 게이트를 둔다.

---

## 릴리스 게이팅 (중요)

서버 제한을 먼저 켜면 구버전 모바일 앱이 깨진다. 2단계로 나눈다.

**Step A — DB + 웹 (지금 가능)**

- 쿼터 RPC, 리퍼럴 테이블, `roll-status` 재작성, `/api/referral/click`, 랜딩 핑 배포
- `DAILY_BASE_ROLLS`는 **9999로 유지** → 실질 동작 변화 없음
- 이 단계에서 `already_rolled`가 사라져 FAB 잠금이 풀린다. 구버전 앱도 FAB이 열리기만 하므로 안전하다
- 리퍼럴 클릭은 이때부터 적립되기 시작한다 (보너스는 아직 무의미하지만 데이터는 쌓임)

**Step B — 모바일 릴리스 후**

- 쿼터 표시 + 409 처리 + 소진 모달이 들어간 앱이 스토어에 나간 뒤 `DAILY_BASE_ROLLS`를 **5로 플립**
- 미업데이트 구버전 사용자는 409를 조용히 무시해 "뽑기가 안 되는" 경험을 한다. 강제 업데이트 또는 채택률을 보고 플립 시점을 정한다 — **사용자 판단 필요**

---

## 아키텍처 결정

### 쿼터의 단일 소스

쿼터 산출은 **RPC 하나**(`get_daily_roll_quota`)로 고정한다. `roll`, `roll-status`, `/api/gacha/quota` 세 엔드포인트는 그 결과를 **그대로 반환만** 한다. 어느 라우트에서도 `base + bonus - used`를 재계산하지 않는다.

### 왜 쿠키 + 클라이언트 핑인가

Next.js 서버 컴포넌트는 쿠키를 설정할 수 없다 (Route Handler / Server Action / `proxy.ts`만 가능). 서버 컴포넌트 렌더 중 DB 쓰기는 프리페치·캐시와 얽혀 중복/유실이 생긴다.

→ 랜딩에 Redux 무관한 초경량 클라이언트 컴포넌트를 얹고, 마운트 시 `POST /api/referral/click`을 1회 호출한다. Route Handler가 쿠키 발급과 DB 기록을 담당한다.

부수 효과: **카카오톡/슬랙/트위터 OG 크롤러는 JS를 실행하지 않으므로 자동으로 집계에서 빠진다.** 반대로 JS 미실행 환경(광고 차단, 일부 인앱 브라우저)에서는 보상이 유실된다 — 이는 감수한다.

### 왜 `referral_code`인가

URL에 raw user UUID를 노출하면 열거·프라이버시 문제가 생긴다. 짧은 랜덤 코드는 비열거성이 있고 추후 초대 코드 화면에 재사용된다.

**단, `user_profiles`에는 이미 본인 row UPDATE RLS가 열려 있다** (`20260417_user_profiles_edit.sql:15`). 컬럼만 추가하면 클라이언트가 자기 `referral_code`를 임의 값으로 바꿔 남의 코드를 선점하거나 추적을 회피할 수 있다. → **BEFORE UPDATE 트리거로 `referral_code` 변경을 service_role 외에는 거부**한다.

### 상수의 단일 소스

SQL 함수에 5/20을 하드코딩하면 TS 상수와 이중 관리가 된다. → 쿼터 함수는 base·상한을 **파라미터로 받고**, 값은 TS 상수 파일에만 둔다.

---

## 작업 계획

### Phase 0 — 선행 (B1)

**`apps/web/src/app/[locale]/r/[variantId]/parse-stats.ts`를 정식 파일로 커밋**하고 `page.tsx`, `opengraph-image.tsx`가 사용하도록 연결한다.

```ts
export function parseSharedVariantSlug(
  slug: string,
): { variantId: string; tries: number | null; owned: number | null } | null;
```

- `{uuid}` 및 `{uuid}-{tries}-{owned}` 모두 지원
- UUID 부분만 DB 조회에 사용

### Phase 1 — DB (메인 세션, Supabase MCP `apply_migration`)

**사전 확인**: dev/prod에서 `gacha_roll_results_user_product_day_free_idx`가 실제로 없는지 조회. 있으면 `20260706` 마이그레이션이 미적용된 drift다.

**적용 결과**: dev(`gacha-map-dev`)·prod(`gacha-map`) 모두 상품당 유니크 인덱스·제약이
이미 없음을 확인했다 (`20260706` 마이그레이션 적용 완료, drift 없음). DROP 마이그레이션 불필요.
`(user_id, rolled_at) INCLUDE (product_id)` 인덱스가 이미 있어 쿼터 카운트에 충분하다.

**`supabase/migrations/20260806_gacha_referral_rewards.sql`**

1. **`user_profiles.referral_code text UNIQUE`**
   - `gen_referral_code()` — base32 10자리 랜덤
   - 백필: **unique violation을 catch하는 재시도 루프**로 행마다 채운다 (단순 UPDATE는 충돌 시 전체 실패)
   - 신규 가입: `handle_new_user()` 트리거를 확장하되, 충돌 시 재시도 가능한 루프 구조로 작성
   - **BEFORE UPDATE 트리거**: `OLD.referral_code IS DISTINCT FROM NEW.referral_code`이고 호출자가 service_role이 아니면 예외
2. **`gacha_referral_clicks`**
   ```sql
   CREATE TABLE gacha_referral_clicks (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     inviter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
     visitor_id uuid NOT NULL,
     variant_id uuid,
     clicked_at timestamptz NOT NULL DEFAULT now()
   );
   CREATE UNIQUE INDEX gacha_referral_clicks_daily_uniq
     ON gacha_referral_clicks
        (inviter_id, visitor_id, (date(clicked_at AT TIME ZONE 'Asia/Seoul')));
   ```
   - `date(timestamptz AT TIME ZONE '<상수>')`는 IMMUTABLE이라 인덱스 식으로 유효하다. `20260627_gacha_roll_results.sql:11-13`이 동일 패턴을 쓴다
   - RLS: `service_role`만 INSERT, 초대자는 자기 행 SELECT (`20260627` 정책 스타일)
3. **`get_daily_roll_quota(p_user_id uuid, p_base int, p_bonus_max int)`**
   → `TABLE(base int, bonus int, used int, remaining int)`
   - `bonus = least(p_bonus_max, 오늘 KST 클릭 수)`, `used = 오늘 KST free_daily 롤 수`, `remaining = greatest(0, base + bonus - used)`
   - `LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public`
4. **`consume_daily_roll(p_user_id, p_product_id, p_variant_id, p_base, p_bonus_max)`**
   → `TABLE(roll_id uuid, base int, bonus int, used_after int, remaining_after int)`
   - **`VOLATILE SECURITY DEFINER`** (쓰기 함수. PostgREST가 POST로 호출해야 트랜잭션이 성립)
   - 첫 문장에서 `pg_advisory_xact_lock(hashtext(p_user_id::text))` — PostgREST는 요청당 단일 트랜잭션이므로 요청 끝까지 락이 유지된다
   - 락 안에서 쿼터 재확인 → 초과면 `remaining_after = 0`, `roll_id = NULL` 반환 (예외 대신 값으로)
   - INSERT 후 **insert를 포함한 `used_after` / `remaining_after`를 직접 계산해 반환**한다. off-by-one 방지를 위해 호출자는 절대 재계산하지 않는다

**적용 순서: dev → 확인 → 사용자 승인 → prod.** `main` 머지 전 prod까지 완료.

### Phase 2 — 웹 백엔드

**신규 `apps/web/src/constants/gacha-roll.ts`**

```ts
// Step A에서는 9999. 모바일 릴리스 이후 5로 플립한다.
export const DAILY_BASE_ROLLS = 9999;
export const REFERRAL_BONUS_MAX = 20;
```

**`.../roll/_utils.ts`** — `DAILY_LIMIT` 제거(상수 파일로 이관). `todayKSTMidnight`/`tomorrowKSTString`은 재사용.

**`.../roll/route.ts`**

- 사전 카운트 체크 삭제 → `consume_daily_roll` 한 번으로 통합
- `roll_id`가 NULL이면 409 `daily_limit` + 쿼터 동봉
- **23505 ephemeral 폴백(117-140행) 삭제** — 도달 불가 죽은 코드
- anti-repeat "soft shuffle"은 **유지**. 같은 상품 반복이 열리므로 오히려 중요해진다
- `permission`에 `base` / `bonus` / `used` 추가. 값은 RPC 반환 그대로

**`.../roll-status/route.ts` — 재작성 (Critical)**

- **`already_rolled` 분기 전체 삭제.** 상품당 하루 1회의 실제 강제 지점이다
- `get_daily_roll_quota` 결과로 `canRoll` 판정. `reason`은 `no_variants` | `daily_limit`만 남긴다
- 응답에 쿼터(`base`/`bonus`/`used`/`remaining`) 포함

**신규 `apps/web/src/app/api/referral/click/route.ts`** (POST)

- body `{ code, variantId? }` — `variantId`는 순수 UUID여야 하며 아니면 무시
- **봇 UA 필터**: `facebookexternalhit`, `Twitterbot`, `Slackbot`, `kakaotalk-scrap`, `Discordbot` 등은 즉시 204
- `gm_vid` 쿠키 조회, 없으면 uuid 생성 후 `Set-Cookie` (httpOnly, secure, sameSite=lax, maxAge 1년)
- `code` → `user_profiles.id` 해석. 없으면 204
- **자기 클릭 차단**: 세션이 있고 `user.id === inviter_id`면 무기록
- INSERT, 23505는 정상 흐름으로 무시
- IP 기준 rate limit은 기존 `check_rate_limit` RPC(`20260604_rate_limiting.sql`) 재사용. key/window/max를 마이그레이션 주석에 명시
- 항상 204 (초대자 정보 미노출)

**신규 `apps/web/src/app/api/gacha/quota/route.ts`** (GET) — 인증 필수. RPC 결과 + `nextAvailableAt` 반환.

**`packages/shared/src/types/index.ts` (317행 근처)**

- `GachaRollPermission`에 `base`/`bonus`/`used` 추가 (기존 필드 유지)
- `GachaDailyQuota`, `parseSharedVariantSlug` 반환 타입 신규

### Phase 3 — 웹 랜딩

**`[locale]/r/[variantId]/page.tsx`** — `searchParams`에서 `ref`를 읽고, 있을 때만 `<ReferralPing code={ref} variantId={parsed.variantId} />` 렌더. `searchParams` 사용은 이 라우트를 동적 렌더로 만든다 (OG 메타데이터 생성에는 영향 없음).

**신규 `[locale]/r/[variantId]/referral-ping.tsx`** (`"use client"`)

- 마운트 시 `POST /api/referral/click` 1회, `credentials: "include"`
- StrictMode 이중 마운트 방지 `useRef` 가드 + `sessionStorage` 키로 새로고침 연타 억제
- `null` 반환. Redux·i18n 의존 없음 → `r/layout.tsx`의 share-only Provider와 무관

### Phase 4 — 모바일 (`feat/mobile-link-share` 머지 후)

- **`store/slices/auth.slice.ts`** + **`app/_layout.tsx`**: `referral_code`를 `AuthProfile`에 추가
- **`GachaRollModal.view.tsx:623`**: 공유 URL에 `?ref=${referralCode}` 부착. 인스타 스토리 경로는 이미지만 보내므로 영향 없음
- **신규 `hooks/useDailyQuota.ts`**: `GET /api/gacha/quota`. 화면 포커스 시 + 뽑기 직후 refetch. `hooks/useGachaRollStats.ts` 패턴을 따른다
- **`app/gacha/[id].tsx`**
  - `rollStatus.reason`의 `already_rolled` 케이스 제거 (228-230, 683-690행)
  - `RollFAB`에 잔여 배지(`3/5`). 0이면 비활성 스타일
  - **804행 부근 하드코딩 색상을 `constants/colors.ts`로 이관** (CLAUDE.md 색상 규칙)
- **신규 소진 모달**: FAB 탭 시 "친구에게 공유하고 더 뽑기" → 기존 공유 플로우 재사용. Atomic Design상 organism
- **`hooks/useGachaRoll.ts:84`**: 409를 `idle`이 아니라 소진 상태로 전환해 모달 유도
- **i18n**: `messages/{ko,en,ja,zh}.json` 4개 언어 전부

### Phase 5 — Penpot 동기화

FAB 배지·소진 모달은 신규 컴포넌트/레이아웃 변경 → Penpot 동기화 필수. 메인 세션에서 수행.

---

## Verification

### DB (dev)

1. 사전: `SELECT indexname FROM pg_indexes WHERE tablename='gacha_roll_results'` → 상품당 유니크 인덱스 부재 확인
2. `get_daily_roll_quota(<user>, 5, 20)` → `base=5, bonus=0, used=0, remaining=5`
3. 같은 `(inviter, visitor)` 오늘 날짜로 2행 INSERT → 두 번째 23505
4. 서로 다른 visitor 3행 → `bonus=3, remaining=8`. 25행 → `bonus=20`에서 캡
5. **동시성**: `consume_daily_roll`을 10개 병렬 세션에서 호출 (`xargs -P10` + psql) → 총 삽입이 정확히 쿼터만큼인지, `remaining_after`가 음수가 안 되는지
6. **RLS abuse**: anon/authenticated 키로 `gacha_referral_clicks` INSERT 시도 → 거부. 본인 `referral_code` UPDATE 시도 → 트리거 거부

### 웹 API (로컬)

```bash
# 상수를 5로 두고 6회 연속 → 6번째 409 daily_limit
for i in $(seq 1 6); do curl -s -X POST localhost:3000/api/gacha-products/<id>/roll -H "Authorization: Bearer <jwt>" | head -c 200; echo; done

# roll-status가 already_rolled를 더 이상 반환하지 않는지
curl -s "localhost:3000/api/gacha-products/<id>/roll-status" -H "Authorization: Bearer <jwt>"

# 같은 쿠키 자로 2회 클릭 → 1행만
curl -s -c jar -b jar -X POST localhost:3000/api/referral/click -H 'content-type: application/json' -d '{"code":"<code>"}' -i | head -5
curl -s -c jar -b jar -X POST localhost:3000/api/referral/click -H 'content-type: application/json' -d '{"code":"<code>"}' -i | head -5

# 봇 UA는 무집계
curl -s -X POST localhost:3000/api/referral/click -H 'User-Agent: facebookexternalhit/1.1' -H 'content-type: application/json' -d '{"code":"<code>"}'

curl -s localhost:3000/api/gacha/quota -H "Authorization: Bearer <jwt>"
```

### 라우트 테스트

`apps/web/src/app/api/gacha-products/[id]/__tests__/route.test.ts` 패턴을 따라 `roll`, `roll-status`, `referral/click` 테스트 추가. 최소 케이스: 쿼터 소진 409, `already_rolled` 미반환, 중복 클릭 무집계, 자기 클릭 무집계.

### 웹 랜딩

`/ko/r/<uuid>-3-2?ref=<code>` 접속 → 통계 붙은 슬러그가 **정상 렌더**되는지(B1 회귀) + `referral/click` 1회 + `Set-Cookie: gm_vid`. 새로고침해도 DB 1행 유지.

### 모바일

5회 뽑기 → FAB 배지 감소 → 6번째 탭 시 공유 유도 모달 → 링크에 `?ref=` 포함 → 다른 기기로 열기 → 앱 복귀 후 배지 증가. **같은 상품 연속 뽑기가 가능한지**(already_rolled 제거 회귀) 확인.

### 정적 검사

`rtk tsc`, `rtk lint`, `pnpm --filter mobile typecheck`, shared 패키지 typecheck.

### 회귀 확인

- 배지 `gacha_roll_variety` / `gacha_roll_days` 적립 정상 동작
- `apps/mobile/hooks/useTodayRolls.ts`가 상품당 1회를 전제하는지 확인 후 필요 시 수정

---

## Risks / 확인 필요

| 리스크                                                         | 대응                                                                                                                                                |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **구버전 앱은 409를 조용히 무시해 "뽑기 먹통"으로 보임**       | Step A/B 게이팅. 5로 플립하는 시점은 앱 채택률 보고 결정 — **사용자 판단 필요**                                                                     |
| 9999 → 5는 체감상 급격한 하향                                  | 단계적 인하(10 → 5) 검토 — **사용자 판단 필요**                                                                                                     |
| 쿠키 dedup은 시크릿모드·기기 변경·비로그인 자기 클릭을 못 막음 | "친구"가 아니라 "브라우저 프로필" 단위임을 정책으로 명시. 하루 +20 상한이 손해 한도. 봇 UA 필터 + IP rate limit + 로그인 시 자기 클릭 차단으로 보완 |
| 20260706 마이그레이션이 prod 미적용일 가능성                   | Phase 1 사전 확인 단계에서 조회                                                                                                                     |
| B1(슬러그 파싱)이 미해결이면 리퍼럴 링크 자체가 동작 안 함     | Phase 0로 선행 분리                                                                                                                                 |
| 노션 기획서 부재                                               | Phase 4 착수 전 확인                                                                                                                                |

---

## Suggested commit messages

- `fix(web): parse share slug stats on the landing page`
- `feat(db): add referral clicks and daily roll quota functions`
- `feat(web): serve roll quota from a single RPC`
- `refactor(web): drop per-product daily roll restriction`
- `feat(web): record referral clicks on the share landing`
- `feat(mobile): show remaining rolls and prompt sharing when exhausted`
