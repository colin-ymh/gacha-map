# 사업자 등록(shop_owner_applications) 플로우 하드닝

## Context

실사업자 대상 홍보 직전이라 사업자 등록 플로우를 마감해야 한다. 현재 코드를 점검한 결과, **데이터를 파손하거나 소유권을 탈취당할 수 있는 결함 3건**과 실운영에 필요한 기능 공백 5건이 확인됐다.

가장 심각한 건 `new_shop` 신청이 승인되면 샵이 **위도 0, 경도 0(기니만 해상)** 에 생성된다는 점이다. 폼이 좌표를 보내지 않는데 승인 RPC가 `COALESCE(app.lat, 0)`으로 기본값을 넣고, `shops.lat/lng`는 NOT NULL이라 그대로 들어간다. 지도에 안 뜨고 주변 검색에서도 빠진다. 실사업자가 등록하는 순간 100% 재현된다.

두 번째는 `claim_shop`이 이미 주인이 있는 샵도 신청·승인 가능하다는 점이다. API는 `shops.status === 'active'`만 보고 `owner_id`는 보지 않으며, 승인 RPC는 `UPDATE shops SET owner_id = app.user_id`로 기존 사장을 조용히 덮어쓴다. 중복 방지 인덱스가 `(user_id, shop_id)`라 서로 다른 두 유저가 동시에 pending 클레임을 들고 있을 수도 있다.

세 번째는 사업자등록번호를 전혀 검증하지 않는다는 점이다. `formatBizReg`는 하이픈만 넣고, API는 non-empty만 확인한다. 아무 숫자나 통과하며 중복 탐지도 없다.

목표: 위 세 건을 막고, admin이 실제로 검증할 수 있도록 증빙 서류·좌표·동의를 갖춘 상태로 마감한다.

---

## 현재 구조 (확인 완료)

```
apps/mobile/app/shop-application.tsx          신청 폼 (모바일)
apps/mobile/app/shop-applications.tsx         내 신청 목록 (읽기 전용, 취소 불가)
apps/web/.../organisms/shop-application/      신청 폼 (웹, MVVM: .tsx + .view.tsx)
apps/web/src/app/api/shop-applications/       POST 신청 / GET 내 신청
apps/web/src/app/api/admin/shop-applications/[id]/  승인·반려
supabase/migrations/20260526_shop_owner_applications.sql   테이블 + approve RPC
```

**스키마 사실**

- `shops.lat` / `shops.lng` = NOT NULL (`supabase/schema.sql:50-51`), name/address unique 제약 없음
- `shop_owner_applications` 유니크 부분 인덱스: `(user_id, shop_id) WHERE status='pending' AND shop_id IS NOT NULL` — claim 전용, 유저별
- RLS: SELECT own / INSERT own 만. UPDATE·DELETE 정책 없음 → 사용자가 본인 신청 취소 불가
- 승인 RPC `approve_shop_owner_application`은 `SECURITY DEFINER`인데 `SET search_path` 없음

**결함 목록**

| #   | 심각도 | 내용                                                                                                                         |
| --- | ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| 1   | 🔴     | new_shop 승인 시 좌표 0,0 삽입                                                                                               |
| 2   | 🔴     | 주인 있는 샵 claim 가능 → 소유권 탈취                                                                                        |
| 3   | 🔴     | 사업자등록번호 검증·중복탐지 전무                                                                                            |
| 4   | 🟠     | 증빙 서류 없음 — admin이 검증할 근거 0                                                                                       |
| 5   | 🟠     | new_shop 중복 신청 무제한, 중복 샵 생성 방지 없음                                                                            |
| 6   | 🟡     | 개인정보 수집·이용 동의 UI 없음 (대표자명·전화·사업자번호 수집 중)                                                           |
| 7   | 🟡     | 신청 취소 불가 (UPDATE RLS 없음)                                                                                             |
| 8   | 🟡     | 에러 메시지 뭉개짐 — 409 외 전부 generic alert                                                                               |
| 9   | 🟡     | 화면 제목 없음. `titleNew`/`titleClaim`/`sectionLabel`/`submitNew`/`submitClaim` i18n 키가 존재하는데 어느 화면에서도 미사용 |

**웹 폼 추가 결함**: `formatBizReg`조차 안 씀 (`formatKoreanPhone`만 적용), 좌표 미전송.

---

## 재사용할 기존 자산

| 용도                        | 위치                                                                                                                                                                                                        |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 주소→좌표 (Kakao, 최대 5건) | `GET /api/geocode/forward?query=`                                                                                                                                                                           |
| 주소→좌표 (단건 헬퍼)       | `apps/web/src/lib/kakao/geocodeKeyword.ts`                                                                                                                                                                  |
| 좌표→주소                   | `GET /api/geocode/reverse?lat=&lng=`                                                                                                                                                                        |
| 모바일 지도 피커            | `apps/mobile/app/report-location-picker.tsx` + 싱글턴 `apps/mobile/lib/locationPickerResult.ts` (`setLocationPickerResult` → `router.back()` → 호출측 `useFocusEffect`에서 `consumeLocationPickerResult()`) |
| 웹 주소 입력 선례           | `apps/web/.../admin/shop-add-form.tsx` (Daum Postcode → geocode/forward)                                                                                                                                    |
| 서버사이드 이미지 업로드    | `apps/web/src/app/api/shops/[id]/reviews/route.ts:227-276` (FormData → Sharp 리사이즈 → `adminClient.storage.from(BUCKET).upload()`)                                                                        |
| 모바일 이미지 선택          | `apps/mobile/app/review-form.tsx:185-228` (expo-image-picker + image-manipulator → FormData)                                                                                                                |
| 검증 헬퍼 형태 선례         | `packages/shared/src/utils/validateNickname.ts` — boolean 아닌 타입 유니온 에러 반환                                                                                                                        |
| admin 인증                  | `verifyAdminAuth(request)` — `apps/web/src/lib/supabase/admin.ts`                                                                                                                                           |
| 알림                        | `enqueueNotification(supabase, userId, "shop_owner_update", title, body, data)`                                                                                                                             |
| 테스트 패턴                 | `apps/web/src/app/api/shop-applications/__tests__/route.test.ts` (vitest + `createAdminSupabaseMock()` from `@/test/mocks/supabase`)                                                                        |

---

## Plan

각 Phase는 독립적으로 배포·검증 가능하다. Phase 1이 데이터 파손을 막으므로 최우선.

### Phase 1 — 데이터 파손 차단 (DB)

**신규 마이그레이션** `supabase/migrations/20260824_shop_application_hardening.sql`

1. **컬럼 추가** (`shop_owner_applications`)
   - `document_paths text[]` — 증빙 서류의 **스토리지 경로** (public URL 아님)
   - `consent_privacy_at timestamptz` — 개인정보 수집·이용 동의 시각
   - `biz_reg_digits text GENERATED ALWAYS AS (regexp_replace(business_registration_number, '\D', '', 'g')) STORED` — 하이픈 무관 중복 탐지용

2. **status에 `'cancelled'` 추가** — 기존 CHECK 제약 DROP 후 재생성

3. **인덱스**

   ```sql
   -- new_shop 중복 pending 방지 (같은 유저 + 같은 사업자번호)
   CREATE UNIQUE INDEX shop_owner_applications_no_dup_pending_new
     ON shop_owner_applications (user_id, biz_reg_digits)
     WHERE status = 'pending' AND shop_id IS NULL;

   -- 사업자번호 조회용 (admin 중복 탐지)
   CREATE INDEX shop_owner_applications_biz_reg_idx
     ON shop_owner_applications (biz_reg_digits);
   ```

   claim의 전역 중복은 **인덱스로 막지 않는다.** 전역 유니크로 막으면 먼저 신청한 허위 클레임이 진짜 사장을 봉쇄한다. 대신 아래 RPC 가드가 실질적 방어선이다.

4. **RLS UPDATE 정책 (취소용)**

   ```sql
   CREATE POLICY "users can cancel own pending applications"
     ON shop_owner_applications FOR UPDATE
     USING (auth.uid() = user_id AND status = 'pending')
     WITH CHECK (auth.uid() = user_id AND status = 'cancelled');
   ```

5. **`approve_shop_owner_application` 재작성** — 시그니처에 `force boolean DEFAULT false` 추가
   - `SET search_path = public` 추가 (SECURITY DEFINER 하드닝)
   - 신청 행 `SELECT ... FOR UPDATE`로 잠금 → 이중 승인 레이스 차단
   - **claim_shop**: 대상 샵 `FOR UPDATE` 잠금 후
     - `status <> 'active'` → `RAISE EXCEPTION 'shop_not_active'`
     - `owner_id IS NOT NULL` → `RAISE EXCEPTION 'shop_already_owned'` ← **결함 2 차단**
   - **new_shop**:
     - `app.lat IS NULL OR app.lng IS NULL` → `RAISE EXCEPTION 'missing_coordinates'` ← **결함 1 차단. `COALESCE(...,0)` 완전 제거**
     - `force = false`일 때 반경 100m 내 동일/유사 이름 active 샵 존재 시 `RAISE EXCEPTION 'possible_duplicate_shop'` ← **결함 5**. admin이 `force=true`로 오버라이드 가능
   - 예외 메시지는 **안정적인 식별자 문자열**로 고정 (API가 문자열 매칭 → HTTP 코드 매핑에 의존하므로)

6. **기존 데이터 점검 (읽기 전용, 자동 수정 금지)**

   ```sql
   -- 0,0 에 박힌 샵
   SELECT id, name, address, created_at FROM shops WHERE lat = 0 AND lng = 0;
   -- 좌표 없는 pending new_shop (새 RPC로는 승인 불가해짐)
   SELECT id, shop_name, address FROM shop_owner_applications
    WHERE status='pending' AND type='new_shop' AND (lat IS NULL OR lng IS NULL);
   ```

   결과를 사용자에게 보고하고 처리 방침(좌표 보정 vs 반려 후 재신청)을 확인받은 뒤 진행한다.

7. **적용 순서**: dev `apply_migration` → 위 점검 쿼리 확인 → prod. `main` 머지 전 prod까지 완료.

**검증**: dev에서 좌표 없는 new_shop 승인 시도 → `missing_coordinates` 발생 확인. 이미 owner 있는 샵 claim 승인 시도 → `shop_already_owned` 확인.

---

### Phase 2 — 사업자등록번호 검증

**신규** `packages/shared/src/utils/validateBizReg.ts` (+ `index.ts` export, + vitest 유닛 테스트)

국세청 체크섬 알고리즘:

```
digits = 입력에서 숫자만 추출 (10자리여야 함)
weights = [1, 3, 7, 1, 3, 7, 1, 3, 5]
sum = Σ (digits[i] * weights[i])  for i = 0..8
sum += floor((digits[8] * 5) / 10)
check = (10 - (sum % 10)) % 10
유효 ⟺ check === digits[9]
```

`validateNickname` 형태를 따라 유니온 반환:

```ts
export type BizRegError = "invalid_length" | "invalid_checksum";
export function validateBizReg(value: string): BizRegError | null;
```

**적용 지점** (서버가 최종 권위):

- `apps/web/src/app/api/shop-applications/route.ts` — 실패 시 400 + `code: "invalid_biz_reg"`
- `apps/mobile/app/shop-application.tsx` — 제출 전 인라인 에러
- `apps/web/.../shop-application-form.tsx` — 동일. **`formatBizReg`도 여기서 처음 연결** (현재 미사용)

**중복 탐지** (차단 아님, admin 경고):

- API가 insert 전 같은 `biz_reg_digits`의 **다른 유저** approved/pending 신청을 조회 → 있으면 신청은 받되 admin 목록에 "사업자번호 중복" 플래그 노출. 정당한 다점포 사업자를 막지 않기 위해 하드 블록하지 않는다.

> ⚠️ **체크섬 통과 ≠ 실존 사업자.** 실제 검증은 국세청 사업자등록상태 조회 API(공공데이터포털 `api.odcloud.kr/api/nts-businessman/v1/status`)가 필요하다. 이번 범위 밖이며, 증빙 서류(Phase 4)로 대체한다. 후속 과제로 문서화.

---

### Phase 3 — 좌표 확보 (자동 지오코딩 + 지도 보정)

**서버** (`api/shop-applications/route.ts`)

- body에서 `lat`/`lng` 수용 (이미 검증 코드 있음)
- `type='new_shop'`인데 좌표 없으면 서버가 `geocodeKeyword(address)`로 1회 보강 시도
- 그래도 실패 → **400 + `code: "geocode_failed"`** (0,0 삽입 절대 금지)

**모바일** (`shop-application.tsx`)

- 주소 입력 후 debounce(500ms) → `GET /api/geocode/forward?query=` 호출 → 첫 결과를 `coords` state에 저장
- 좌표 확보 시 확인 카드 표시: 도로명주소 + "지도에서 위치 확인·수정" 버튼
- 버튼 → `router.push("/report-location-picker")`, 복귀 시 `useFocusEffect` + `consumeLocationPickerResult()`
- 지오코딩 실패 시 카드가 경고로 바뀌고 지도 피커 사용을 유도 (필수는 아니지만 좌표 없으면 제출 불가)
- ⚠️ **`locationPickerResult` 싱글턴은 `report.tsx`와 공유된다.** 소비되지 않은 잔여 결과가 이 화면으로 새어들 수 있으므로, `LocationPickerResult`에 `source: "report" | "shop-application"` 필드를 추가하고 호출측이 자기 source만 소비하도록 한다. (`report-location-picker.tsx` 진입 시 source를 라우트 파라미터로 받아 그대로 되돌려줌)

**웹** (`shop-application-form.tsx` + `.view.tsx`)

- `admin/shop-add-form.tsx`와 동일하게 Daum Postcode → `/api/geocode/forward` → lat/lng
- 좌표 미확보 시 제출 버튼 비활성 + 안내

**admin** (`admin/shop-applications/page.tsx` + `shop-application-table.view.tsx` + `api/admin/shop-applications/[id]/route.ts`)

- 신청 행에 lat/lng 표시 + 소형 지도 미리보기 링크
- **승인 전 좌표 수정 가능하도록 PATCH에 `lat`/`lng` 수정 액션 추가** — Phase 1 이후 좌표 없는 기존 pending 행을 구제하는 유일한 경로
- 승인 요청에 `force` 전달 옵션 (중복 샵 경고 오버라이드)

---

### Phase 4 — 증빙 서류 업로드 (사업자등록증)

**신규 비공개 버킷** `business-docs` (같은 마이그레이션 또는 후속 마이그레이션)

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('business-docs', 'business-docs', false, 10485760,
        ARRAY['image/jpeg','image/png','image/webp','application/pdf'])
ON CONFLICT (id) DO NOTHING;
```

- **Storage RLS 정책을 만들지 않는다.** anon/authenticated 접근 전면 차단, `service_role`(서버)만 접근. 기존 `shop-images`는 `public: true`라 PII 성격 문서에 부적합 — 재사용 금지.

**업로드 경로**: `POST /api/shop-applications`를 **multipart/form-data 수용**으로 확장

- JSON body는 `payload` 필드에 문자열로, 파일은 `documents` 필드(최대 3장)
- 서버: 검증 통과 → 이미지면 Sharp로 리사이즈(장변 2000px) + EXIF strip → `business-docs/{user_id}/{crypto.randomUUID()}.{ext}` 업로드 → 경로 배열을 `document_paths`에 저장. PDF는 리사이즈 없이 통과
- 실패 시 업로드된 객체 정리(best-effort)
- 기존 JSON 요청도 계속 받도록 `Content-Type` 분기 (웹/모바일 동시 배포가 아닐 수 있음)

**admin 열람**: 신규 `GET /api/admin/shop-applications/[id]/documents`

- `verifyAdminAuth` → `adminClient.storage.from("business-docs").createSignedUrl(path, 300)` → 5분짜리 서명 URL 배열 반환
- 테이블 뷰에 "증빙 보기" 버튼 → 모달/새 탭

**클라이언트**

- 모바일: `review-form.tsx:185-228` 패턴 그대로 (expo-image-picker → image-manipulator → FormData)
- 웹: `<input type="file" accept="image/*,application/pdf" multiple>` + 미리보기

**개인정보 관점**: 사업자등록증에는 대표자 성명·주소가 담긴다. 비공개 버킷 + 서명 URL 단기 만료는 필수. 보관기간(예: 승인/반려 후 90일 뒤 삭제)은 개인정보처리방침에 명시하고, 실제 삭제 배치는 **후속 과제**로 분리한다.

---

### Phase 5 — 동의 · 취소 · 에러 · 화면 정리

1. **개인정보 수집·이용 동의 (필수)**
   - 폼 하단 체크박스. 수집 항목 / 목적 / 보관기간을 펼쳐볼 수 있게 노출
   - 미체크 시 제출 버튼 비활성
   - 클라이언트가 `consent_privacy: true` 전송 → 서버가 `consent_privacy_at = now()` 저장. 없으면 400
   - 별도 테이블 불필요 — 신청 행의 컬럼으로 충분

2. **신청 취소**
   - 신규 `DELETE /api/shop-applications/[id]` — 본인 + `status='pending'`일 때만 `status='cancelled'`로 전환 (하드 삭제 아님, 감사 추적 유지)
   - `apps/mobile/app/shop-applications.tsx` pending 카드에 "신청 취소" 버튼 + 확인 다이얼로그. 옵티미스틱 반영 후 실패 시 롤백
   - 목록/뱃지에 `cancelled` 상태 렌더링 추가

3. **에러 메시지 세분화**
   - API 응답을 `{ error: string, code: string }` 형태로 통일. code 예: `invalid_biz_reg`, `geocode_failed`, `shop_already_owned`, `duplicate_pending`, `consent_required`, `profanity`, `shop_not_found`
   - mobile/web이 code → i18n 키로 매핑. 미지의 code는 기존 generic 문구로 폴백

4. **화면 제목 연결**
   - `titleNew` / `titleClaim` / `sectionLabel` / `submitNew` / `submitClaim` 키가 이미 ko/en 양쪽에 있는데 미사용 → 모바일·웹 폼에 실제로 표시. 사업자용 화면에 제목이 없는 상태로 홍보 불가

5. **i18n**: 신규 키(체크섬 에러, 좌표 안내, 서류 업로드, 동의문, 취소, code별 에러)를 `apps/mobile/messages/{ko,en}.json`과 웹 next-intl 메시지 **양쪽 모두**에 추가

---

## Verification

**단위 / API**

- `packages/shared` — `validateBizReg` 유닛 테스트: 실제 유효 번호, 체크섬 1자리 틀린 번호, 9자리, 12자리, 하이픈 포함/미포함
- `apps/web/src/app/api/shop-applications/__tests__/route.test.ts` 확장 — 기존 `createAdminSupabaseMock()` 패턴 유지:
  - 체크섬 불일치 → 400 `invalid_biz_reg`
  - 동의 없음 → 400 `consent_required`
  - new_shop 좌표 없음 + 지오코딩 실패 → 400 `geocode_failed`
  - claim 대상 샵에 owner 존재 → 400 `shop_already_owned`
  - multipart 요청 정상 처리 + `document_paths` 저장
  - DELETE 취소: 본인 pending만 성공, 타인/처리완료 건 거부
- admin `[id]/route.ts` 테스트: `force` 전달, RPC 예외 문자열 → HTTP 코드 매핑
- `rtk vitest run`, `rtk tsc`, `rtk lint`

**DB (Supabase MCP, dev 먼저)**

- 마이그레이션 적용 후 Phase 1의 점검 쿼리 2건 실행 → 결과 보고
- 좌표 있는 new_shop 승인 → `SELECT lat, lng FROM shops WHERE id = ...`가 실제 좌표인지 확인 (0,0 아님)
- owner 있는 샵 claim 승인 시도 → 예외 발생 및 `shops.owner_id` 불변 확인

**E2E (모바일 dev 클라이언트)**

- new_shop: 주소 입력 → 좌표 자동 표시 → 지도 피커로 보정 → 서류 첨부 → 동의 → 제출 → 목록에 pending → admin 승인 → 지도에 실제 위치로 샵 표시
- claim_shop: 주인 있는 샵에서 클레임 버튼 → 거부 메시지 확인
- 취소: pending 신청 취소 → 목록 상태 변경 확인
- report 화면 → 지도 피커 → 복귀 후, 이어서 사업자 등록 화면 진입 시 **잔여 좌표가 새어들지 않는지** 확인 (source 태그 회귀 테스트)

**Penpot**: Phase 3~5에서 폼 레이아웃이 바뀌므로(좌표 카드, 파일 첨부, 동의 체크박스, 제목) 작업 완료 후 Penpot 동기화 필수. 메인 세션에서 수행.

---

## Risks / 확인 필요

1. **기존 pending new_shop 행이 승인 불가 상태가 된다.** Phase 1 RPC가 좌표 없으면 하드 실패하므로, admin 좌표 편집(Phase 3)이 함께 나가거나 해당 행들을 사전 처리해야 한다. → **Phase 1 적용 직후 점검 쿼리로 건수 확인 후 방침 결정.**
2. **이미 0,0에 생성된 샵.** 자동 수정하지 않는다. 목록을 뽑아 보고하고 사용자가 주소 재지오코딩 / 숨김 / 삭제 중 선택.
3. **`'cancelled'` status 추가는 타입 파급이 있다.** `apps/web/src/types/index.ts`의 `ShopOwnerApplication` status 유니온, admin 필터 UI, 모바일 뱃지 렌더링을 모두 갱신해야 한다.
4. **multipart 전환 호환성.** 모바일 앱 스토어 배포는 즉시 반영되지 않으므로 API는 JSON 요청도 계속 받아야 한다. 구버전 앱은 서류 없이 신청 → admin이 서류 없는 신청을 구분할 수 있어야 함.
5. **동의 필수화 시점.** `consent_privacy_at`을 NOT NULL로 걸면 구버전 앱 신청이 전부 실패한다. → **컬럼은 nullable로 두고 API 레벨에서만 필수화**, 구버전 호환 기간 후 조인다.
6. **RPC 예외 문자열 매칭 의존.** 현재 admin 라우트가 `error.message.includes("not found")` 식으로 판별한다. 새 식별자(`shop_already_owned` 등)를 도입하므로 매칭 로직을 함께 갱신하지 않으면 전부 500으로 떨어진다.
7. **비공개 버킷 서명 URL은 기존 public URL 흐름과 다르다.** admin UI 작업이 별도로 필요하고, 기존 이미지 렌더링 컴포넌트를 그대로 못 쓸 수 있다.
8. **개인정보처리방침 문구 갱신 필요.** 사업자등록증 수집 항목과 보관기간을 추가해야 한다. 이건 코드 밖 작업이며 홍보 전 완료 대상.
9. **마이그레이션은 dev → 확인 → prod 순서.** `main` 머지 전 prod 적용 완료. Supabase MCP로만 수행(메인 세션).
10. **국세청 실사업자 조회 미구현.** 체크섬은 형식 검증일 뿐이다. 증빙 서류 + admin 육안 확인이 이번 마감의 실질적 검증 수단이며, 홍보 규모가 커지면 공공데이터포털 API 연동이 후속으로 필요하다.

---

## 작업 분담 제안

| Phase                         | 담당                                       | 비고                        |
| ----------------------------- | ------------------------------------------ | --------------------------- |
| 1 (마이그레이션·RPC)          | 메인 세션                                  | Supabase MCP 필요           |
| 2 (validateBizReg + API 적용) | backend-agent                              | 순수 로직 + 테스트          |
| 3 (좌표)                      | backend-agent → frontend-agent + map-agent | 서버 먼저, 그다음 모바일/웹 |
| 4 (서류 업로드)               | backend-agent → frontend-agent             | 버킷 생성은 메인 세션       |
| 5 (동의·취소·에러·i18n)       | frontend-agent                             |                             |
| 최종 검증                     | codex 적대적 리뷰 + qa-agent               |                             |

Phase 1 완료 후 계획을 `docs/plans/20260824-shop-application-hardening.md`로 옮기고 `codex:adversarial-review`를 태운다 (프로젝트 워크플로우 규칙).

---

## 진행 상황 (2026-08-25)

### 완료

**Phase 1 — 데이터 파손 차단 (DB)** ✅ dev 적용·검증 완료 (prod 미적용)
- `supabase/migrations/20260824_shop_application_hardening.sql`
- 적용 전 점검 결과: dev/prod 모두 0,0 샵 0건, 좌표 없는 pending 0건, 중복 pending 0건 → **백필 불필요**
- dev 동작 검증 7/7 통과 (롤백 방식):
  `shop_already_owned` / `missing_coordinates` / 유니크 인덱스 차단 /
  `possible_duplicate_shop` / `force=true` 오버라이드 / 정상 클레임 / `application_not_pending`

**Phase 2 — 사업자등록번호 검증** ✅
- `packages/shared/src/utils/validateBizReg.ts` + 테스트 12건
- 실존 법인 3건(삼성전자·네이버·카카오)으로 체크섬 알고리즘 고정
- `apps/web/vitest.config.ts`에 `packages/shared` 테스트 수집 추가

**Phase 3 서버측 / Phase 5 서버측** ✅
- `api/shop-applications/route.ts` 재작성: 체크섬, `owner_id` 가드, 서버 지오코딩 폴백,
  동의 필수(시각은 서버 `now()`), `{error, code}` 구조화, 23505 → 409 변환
- `api/admin/shop-applications/[id]/route.ts`: `APPROVE_ERROR_MAP`으로 RPC 예외 → HTTP 매핑, `force` 전달

**타입 파급** ✅ `cancelled` 상태 추가에 따른 타입/뱃지/i18n(ko·en·ja·zh) 갱신

전체 385 테스트 통과, typecheck 클린.

### 계획 대비 변경된 결정

- **마이그레이션 중 발견**: `force` 인자 추가 시 `CREATE OR REPLACE`가 교체가 아닌
  **오버로드**를 만들어 취약한 구버전 `(uuid, text)`가 살아남고 2인자 호출이
  `function is not unique`로 실패한다. → `DROP FUNCTION IF EXISTS` 선행 추가.
- **추가 발견**: `UPDATE user_profiles SET role='shop_owner'`가 무조건 실행되어
  admin이 본인 샵을 클레임하면 admin 권한을 잃었다. → `role IS DISTINCT FROM 'admin'` 가드 추가.
- **기각**: 동의 시각을 클라이언트가 ISO로 보내고 서버가 60초 내인지 검증하는 안(Plan 에이전트 제안).
  위조 가능하므로 서버 `now()` 기록 유지.
- **prod 적용 보류**: 사용자 결정으로 dev만 유지.

### 남은 작업

- Phase 3 클라이언트: 모바일 폼(지오코딩+지도 피커), 웹 폼, admin 좌표 표시·수정
- Phase 4: `business-docs` 비공개 버킷 + multipart 업로드 + admin 서명 URL 뷰어
- Phase 5 클라이언트: 동의 체크박스, 취소 기능(`DELETE /api/shop-applications/[id]`),
  code별 에러 매핑, 미사용 제목 i18n 키 연결
- Penpot 동기화

### ⚠️ 배포 시 주의

현재 API는 `consent_privacy: true`와 유효 체크섬을 **요구**하지만, 배포된 모바일·웹 폼은
둘 다 보내지 않는다. **API를 prod에 올리면 기존 앱의 사업자 신청이 전부 실패한다.**
prod 신청이 2건(전부 rejected)뿐이라 실사용자는 없으나, 클라이언트 작업 완료 전
prod 배포 금지.

---

## Codex 적대적 검토 결과 반영 (2026-08-25)

### 🔴 검토 중 발견된 프로덕션 보안 취약점 (이번 작업과 무관한 기존 결함)

`approve_shop_owner_application`은 `SECURITY DEFINER`인데 Postgres 기본값
`PUBLIC EXECUTE`가 그대로 남아 있었다. Supabase가 public 스키마 함수를 PostgREST
RPC로 노출하므로, 클라이언트에 배포된 anon 키만으로 누구나 호출 가능했다:

```
POST /rest/v1/rpc/approve_shop_owner_application
{ "application_id": "<본인이 만든 신청 id>", "note": null }
```

→ 관리자 승인 없이 자기 신청을 승인하고 `shops.owner_id` / `is_authorized` /
`user_profiles.role='shop_owner'` 를 획득할 수 있었다. dev·prod 모두
`anon_exec = true`, `authenticated_exec = true` 로 실측 확인됨.

**조치**: `supabase/migrations/20260825_revoke_approve_rpc_public_execute.sql`
(기능 마이그레이션과 분리) → **dev·prod 모두 적용 완료**.
적용 후 `anon=false / authenticated=false / service_role=true` 확인.

**남은 과제 (별도 작업 필요)**: prod에 anon 실행 가능한 `SECURITY DEFINER` 함수가
총 27개 있다. 이 중 서버 전용으로 보이는 것들:
`enqueue_notification`, `enqueue_wishlist_news`, `enqueue_product_wishlist_fanout`,
`approve_gacha_product_name_candidate`, `claim_pending_notifications`,
`update_notification_receipt`, `update_notification_delivery_results`,
`mark_notification_failed_no_tokens`, `reschedule_notification_with_backoff`,
`trigger_dispatch_pending_notifications`, `cleanup_rate_limits`, `check_rate_limit`,
`auto_hide_shop_if_absent`, `delete_unregistered_token`.
`get_shops_by_*` / `search_*` 는 의도된 공개 조회 API로 보인다.

저장소 전체의 `.rpc()` 호출 18건이 **전부** `apps/web/src/app/api/**` 와
`apps/web/src/lib/**` (서버, service_role)에 있고 모바일/웹 클라이언트에는 0건이므로,
서버 전용 함수의 anon/authenticated 권한 회수는 앱을 깨뜨리지 않는다.

### 수정 반영

| 지적 | 조치 |
|---|---|
| SECURITY DEFINER PUBLIC EXECUTE (BLOCKER) | REVOKE/GRANT 추가, dev·prod 적용 |
| 취소용 UPDATE RLS가 다른 컬럼 오염 허용 | 정책 **제거**. 취소는 service_role API로만 |
| 중복 샵 검사 레이스 | 정규화 이름 기반 `pg_advisory_xact_lock` |
| 사업자번호가 API에만 있어 직접 insert로 우회 | `is_valid_biz_reg()` SQL 구현 + 승인 RPC에서 재검증 |
| 좌표 범위 미검증 | API 검증 + DB CHECK(`NOT VALID`) |
| PostgREST 스키마 캐시 | `NOTIFY pgrst, 'reload schema'` |
| 에러 코드 substring 충돌 | 길이 내림차순 매칭 |
| admin이 `force`를 못 보내 승인 데드엔드 | 확인 다이얼로그 후 `force: true` 재시도 |
| admin 소유자가 shop-owner API에서 403 | `verifyShopOwnerAuth`가 `admin`도 허용 |
| `cancelled` 부분 반영 | admin 필터 API·UI, 모바일 뱃지, i18n 6개 로케일 |

**기각**: antimeridian 경도 wrap-around — 한국 전용 서비스라 불필요.

### 검증

- dev RPC 동작 7/7 통과 (롤백 방식), 권한 회수 실측 확인
- SQL `is_valid_biz_reg`가 TS `validateBizReg`와 5개 케이스 일치
- 웹 385 테스트 통과, 웹 typecheck 클린
- 모바일 typecheck: 변경 파일 에러 0건 (기존 무관 에러만 잔존)

---

## 진행 상황 (2026-08-26)

### prod SECURITY DEFINER 권한 정리 완료

anon 실행 가능 함수 **27개 → 13개**. prod·dev 모두 적용.

- 회수(14): `approve_shop_owner_application`, `approve_gacha_product_name_candidate`,
  `auto_hide_shop_if_absent`, `check_rate_limit`, `cleanup_rate_limits`,
  `delete_unregistered_token`, `enqueue_notification`,
  `enqueue_product_wishlist_fanout`, `enqueue_wishlist_news`,
  `claim_pending_notifications`, `mark_notification_failed_no_tokens`,
  `reschedule_notification_with_backoff`, `update_notification_delivery_results`,
  `update_notification_receipt`
- 의도적 유지(13):
  - `get_current_user_role` — `user_profiles` RLS 정책 2곳이 호출. 회수 시 프로필 조회 전면 중단
  - 읽기 전용 조회 9개(`get_shops_by_*`, `search_*`, `get_daily_featured_gacha`,
    `get_new_arrival_gacha`) — 공개 데이터. 회수 이득 대비 지도·검색 중단 리스크가 큼
  - 트리거 함수 3개 — PostgREST 미노출이라 RPC 공격면 아님

파일: `supabase/migrations/20260825_revoke_approve_rpc_public_execute.sql`,
`supabase/migrations/20260825_revoke_server_only_rpc_public_execute.sql`

### Phase 3 / Phase 5 모바일 완료

- `lib/locationPickerResult.ts` — `source` 태그 도입. report 화면의 미소비 좌표가
  사업자 등록 폼으로 새어드는 문제 차단. `clearLocationPickerResult()` 추가
- `app/report-location-picker.tsx` — `source` / `initialLat` / `initialLng` 파라미터 수용.
  초기 좌표를 갖고 들어오면 GPS 자동 이동을 건너뛴다(지오코딩 결과를 덮어쓰지 않도록)
- `app/report.tsx` — `consumeLocationPickerResult("report")`
- `app/shop-application.tsx` — 화면 제목(미사용 i18n 키 연결), 사업자번호 체크섬
  인라인 검증, 주소 디바운스 지오코딩 + 위치 확인 카드 + 지도 보정 진입,
  개인정보 동의 체크박스, 서버 `code` → i18n 매핑
- `app/shop-applications.tsx` — `cancelled` 뱃지, pending 신청 취소 버튼(옵티미스틱 + 롤백)
- `DELETE /api/shop-applications/[id]` 신규 + 테스트 3건

### 남은 작업

- 웹 신청 폼(`shop-application-form.tsx` + `.view.tsx`) — 동의·좌표·체크섬·에러 코드
- Phase 4: `business-docs` 비공개 버킷 + multipart 업로드 + admin 서명 URL 뷰어
- Penpot 동기화 (모바일 폼 레이아웃이 바뀜: 제목, 위치 카드, 동의 체크박스)

---

## Phase 4 완료 (증빙 서류) — 2026-08-26

### 결정

- 증빙 필수 범위: **`new_shop`만 필수**, `claim_shop`은 선택.
  claim은 기존 샵 정보로 교차 확인이 가능하지만, 새 샵은 관리자가 대조할 근거가 전혀 없다.
- 웹 소비자용 신청 폼: **유지 + parity 작업** (다음 단계)

### 구현

**스토리지** `supabase/migrations/20260826_business_docs_bucket.sql` (dev 적용)
- `business-docs` 버킷: `public: false`, 10MB, jpeg/png/webp/pdf
- **Storage RLS 정책을 만들지 않는다** → service_role만 접근 가능.
  기존 `shop-images`는 `public: true`라 재사용 불가(사업자등록증에 대표자 성명·주소 포함)
- DB에는 public URL이 아니라 **경로만** 저장 (`document_paths`)

**업로드** `POST /api/shop-applications`
- `multipart/form-data`(payload + documents) / `application/json` 양쪽 수용
- 최대 3장, 각 10MB, jpeg/png/webp/pdf만
- 이미지는 sharp로 장변 2000px 축소 + JPEG 재인코딩 → **EXIF 제거**(촬영 위치 유출 방지).
  PDF는 그대로 통과
- 경로: `business-docs/{user_id}/{uuid}.{ext}`
- insert 실패 시 업로드된 객체 삭제 (고아 개인정보 방지)

**열람** `GET /api/admin/shop-applications/[id]/documents`
- `verifyAdminAuth` → `createSignedUrls(paths, 300)` → 5분 만료 서명 URL
- admin 테이블에 "증빙 보기 (n)" 버튼, 없으면 "증빙 없음" 표시

**모바일** `app/shop-application.tsx`
- expo-image-picker(`quality: 1`) → expo-image-manipulator(1800px, 0.85) → FormData
  (네이티브 압축 exporter가 일부 삼성 기기에서 피커를 멈추는 기존 이슈 회피)
- 썸네일 미리보기 + 개별 삭제, `new_shop`은 제출 게이팅

### 구현 중 발견

- **`instanceof File`이 realm 경계에서 깨진다.** `request.formData()`는 undici의 File을
  돌려주는데 vitest jsdom 환경의 전역 `File`은 jsdom 것이라 `instanceof`가 false가 된다.
  테스트만의 문제가 아니라 런타임 경계 일반의 취약점이므로, `arrayBuffer`/`size` 유무를
  확인하는 duck typing으로 교체했다.

### 검증

웹 397 테스트 통과(신규 12건: 서류 필수·경로 저장·insert 실패 시 정리·개수 초과·형식 위반·서명 URL 발급),
웹 typecheck 클린, 모바일 typecheck 기존 4건 외 신규 0건.

### 남은 작업

- 웹 신청 폼 parity (동의·좌표·체크섬·서류·에러 코드)
- Penpot 동기화
- prod 적용: `20260824_shop_application_hardening.sql`, `20260826_business_docs_bucket.sql`
  (웹 폼 완료 후)

---

## 웹 폼 parity 완료 — 2026-08-26

### 결정 반영

- 웹 소비자용 신청 폼(`shop-application-form.tsx`)은 **유지 + parity 작업**으로 확정.
  CLAUDE.md의 "어드민 전환 예정 화면엔 투자 안 함" 규칙과 상충하지만, 사용자가
  명시적으로 parity를 선택함.

### 구현

**컨테이너** `shop-application-form.tsx`
- `formatBizReg`를 처음으로 실제 연결 (기존엔 미사용 — 하이픈 없는 사업자번호를 그대로 받고 있었음)
- `validateBizReg` 인라인 검증(모바일과 동일 로직)
- 주소 디바운스 지오코딩(600ms) — 모바일과 동일하게 `/api/geocode/forward` 사용.
  단, 모바일과 달리 **지도 피커가 없다.** 지오코딩 실패 시 사용자는 주소 텍스트를
  고치는 것 외에 다른 방법이 없다 (서버가 좌표 없으면 어차피 400으로 막으므로
  UX 결함은 아니지만, 위치 보정 수단은 모바일보다 약함)
- 서류 업로드: `<input type=file multiple>` + `URL.createObjectURL` 미리보기,
  최대 3장·10MB·jpeg/png/webp/pdf 클라이언트 사전 검증
- 동의 체크박스, 서버 `code` → i18n 매핑 (모바일과 동일 키 집합)
- `documents.length > 0`이면 multipart, 아니면 JSON — 모바일과 동일 분기

**뷰** `shop-application-form.view.tsx`
- 위치 확인 카드, 서류 첨부 UI(썸네일+삭제), 동의 체크박스 추가
- 기존 styled-components 관례 그대로 따름(theme 토큰만 사용, 하드코딩 없음)

### 구현 중 발견한 버그 2건 (자체 발견, 커밋 전 수정)

1. **object URL 누수.** 정리 이펙트가 `[]` 의존성이라 마운트 시점의 빈
   `documentPreviews` 배열을 클로저로 캡처 — 언마운트 시 실제로는 아무것도
   revoke되지 않았다. `documentPreviewsRef`로 최신 값을 별도 이펙트에서
   갱신하도록 수정.
2. **`react-hooks/set-state-in-effect` 위반.** 지오코딩 이펙트가 effect 본문에서
   `setState`를 동기 호출했다. 이 저장소의 기존 관례
   (`shop-owner/gacha/page.tsx`의 디바운스 검색)를 따라 모든 `setState`를
   타이머 콜백 안으로 옮겨 해결.

### 검증

웹 397 테스트 통과(변경 없음 — 폼 자체 단위 테스트는 기존에 없었음),
`tsc --noEmit` 클린, 두 파일 대상 `eslint` 클린.

**브라우저 수동 테스트는 하지 않았다.** 인증 세션·Kakao 지오코딩 키·실제 파일
업로드가 필요해 이 세션에서 재현하지 않음 — 명시적으로 보고함.

### 남은 것

- Penpot 동기화 (모바일 + 웹 폼 레이아웃 변경분)
- prod 마이그레이션 적용: `20260824_shop_application_hardening.sql`,
  `20260826_business_docs_bucket.sql`
- 개인정보처리방침 문구 갱신 (서류 수집·보관기간)
- 증빙 서류 보관기간 정책 및 삭제 배치 (후속 과제)
