# 가챠 스캔 이미지 — 개인정보처리방침 고지 및 보존 정책

## Request

가챠 스캔 기능이 사용자 촬영 이미지를 `scan-images` 버킷에 영구 보관하고 있으나, 개인정보처리방침에 관련 고지가 전혀 없다. 기획서에는 "이미지를 서버에 저장하지 않는다"고 적혀 있어 문서와 구현이 정반대다.

방침에 수집·이용·보관 사항을 추가하고, 보존 기간 정책을 만들어 적용한다.

## 현황 (2026-08-11 확인)

| 항목                    | dev (`epcsyfirxeqzjfnltcai`) | prod (`llawvidldrjjqwdbgfxh`) |
| ----------------------- | ---------------------------- | ----------------------------- |
| `scan-images` 공개 여부 | public                       | public                        |
| 객체 수 / 용량          | 8개 / 2.5MB                  | 2개 / 855KB                   |
| 최초 업로드             | 2026-07-05                   | 2026-07-19                    |
| 자동 삭제               | 없음                         | 없음                          |

- 업로드 경로: `{userId}/{timestamp}.jpg` — 경로에 사용자 ID가 노출된다.
- 업로드 주체: `apps/web/src/app/api/gacha-scan/route.ts` → `uploadScanImage()`
- URL 보관 위치: `gacha_product_observations.image_url`, `gacha_product_discovery_requests.image_url`

### 방침에서 누락된 항목

1. **스캔 이미지 수집 사실 자체** — 1조(수집 항목)에 없음
2. **국외 제3자 처리 위탁** — 5조에 Supabase만 기재. 실제로는:
   - 이미지 원본 → **Google Cloud Vision API** (`TEXT_DETECTION`)
   - OCR 텍스트 → **Anthropic Claude API** (`claude-haiku-4-5-20251001`)
   - 둘 다 국외 사업자이며, 이미지·텍스트가 국외로 이전된다.
3. **보존 기간** — 3조는 "목적 달성 후 지체 없이 파기"라고만 되어 있고 스캔 이미지에 대한 구체 기준이 없다.

## Scope

- 개인정보처리방침 문구 추가 (ko/en/ja/zh 4개 로케일)
- 스캔 이미지 자동 삭제 cron 구현 및 스케줄 등록
- `scan-images` 버킷 비공개 전환

## Out of Scope

- 다른 버킷(`avatars`, `shop-images`, `shop-photos`)의 보존 정책 — 별도 과제
- 리뷰 이미지 관련 방침 — 별도 확인 필요
- 이미 업로드된 기존 객체의 소급 삭제 여부 — 정책 적용 시 자동 대상이 됨

## 결정 사항 (2026-08-11 확정)

| 항목           | 결정                                        |
| -------------- | ------------------------------------------- |
| 보존 기간      | **조사 완료 시 즉시 삭제 + 90일 하드 상한** |
| 버킷 공개 여부 | **비공개 전환**                             |

"조사 완료"의 정의: 연결된 `gacha_product_discovery_requests.status`가 `imported` / `no_match` / `failed` 중 하나. `pending` / `searching` / `needs_review`는 조사 진행 중으로 보아 보존하되, 업로드 후 90일이 지나면 상태와 무관하게 삭제한다.

## Relevant Files

| 경로                                                     | 역할                                               |
| -------------------------------------------------------- | -------------------------------------------------- |
| `apps/web/src/app/api/gacha-scan/route.ts`               | 이미지 업로드 (`uploadScanImage`)                  |
| `apps/web/src/app/api/cron/send-notifications/route.ts`  | 기존 cron 라우트 패턴·인증 참고                    |
| `apps/web/src/app/api/admin/observations/route.ts`       | `image_url` 반환 (어드민 소비처)                   |
| `apps/web/src/app/api/admin/discovery-requests/route.ts` | `image_url` 반환 (어드민 소비처)                   |
| `apps/mobile/messages/{ko,en,ja,zh}.json`                | `privacy.*` 문구                                   |
| `apps/mobile/app/privacy.tsx`                            | 섹션 배열 (`sections`) — 문단 키 추가 시 함께 수정 |
| `supabase/migrations/20260807_realtime_push_trigger.sql` | `cron.schedule` + `pg_net` 호출 패턴 참고          |

## 🚨 차단 이슈 — collector 의존성

`docs/collector-handoff/20260720-observation-followups.md`에 **public storage URL이 그대로 기재**되어 있다.

```
https://llawvidldrjjqwdbgfxh.supabase.co/storage/v1/object/public/scan-images/{userId}/{ts}.jpg
```

즉 gacha-collector는 공개 URL로 이미지를 직접 받아간다. 버킷을 비공개로 바꾸면 **collector가 즉시 깨진다.**

비공개 전환 전에 collector 측이 아래 중 하나로 전환되어야 한다:

- service_role 키로 Storage API 직접 조회
- 서버가 발급한 signed URL 사용

**이 확인이 끝나기 전까지 3단계(비공개 전환)를 실행하지 않는다.**

## Plan

### 1단계 — 개인정보처리방침 문구 (즉시 가능, 리스크 낮음)

`privacy` 로케일에 아래를 반영한다. 섹션 번호가 밀리지 않도록 기존 조에 문단을 추가하는 방식을 쓴다.

- **1조 (수집 항목)**: `s1p3` 신설 — 가챠 스캔 기능 이용 시 사용자가 촬영·선택한 이미지를 수집한다는 사실
- **2조 (이용 목적)**: `s2p3` 신설 — 이미지에서 상품명·가격을 인식해 제보를 자동 완성하고, 상품 정보를 조사하는 목적
- **3조 (보유 기간)**: `s3p3` 신설 — 스캔 이미지는 상품 조사 완료 시 즉시 삭제하며, 조사가 끝나지 않아도 업로드 후 90일이 지나면 삭제한다
- **5조 (처리 위탁)**: `s5p2` 신설 — Google LLC(Google Cloud Vision, 이미지 문자 인식) / Anthropic PBC(Claude API, 인식 텍스트 구조화)에 위탁하며 국외로 이전됨을 명시
- `effectiveDate` 갱신: 2026년 8월 11일

`apps/mobile/app/privacy.tsx`의 `sections` 배열에 새 문단 키를 추가한다.

### 2단계 — 삭제 cron (DB 스케줄 등록 필요)

`apps/web/src/app/api/cron/purge-scan-images/route.ts` 신설.

동작:

1. `gacha_product_discovery_requests`에서 삭제 대상 조회
   - `image_url is not null` **AND**
   - (`status in ('imported','no_match','failed')` **OR** `created_at < now() - interval '90 days'`)
2. URL에서 storage 경로를 파싱해 `storage.from('scan-images').remove([...])` 호출 (배치, 예: 100건)
3. 성공한 건의 `discovery_requests.image_url`과 대응 `observations.image_url`을 `null`로 갱신
4. 처리 건수를 응답으로 반환

인증: 기존 `send-notifications`와 동일하게 `CRON_SECRET` / `DB_CRON_SECRET` Bearer 검증.

스케줄: `cron.schedule`로 1일 1회 (KST 새벽) `pg_net`을 통해 위 라우트 호출. `20260807_realtime_push_trigger.sql` 패턴 그대로.

적용 순서: **dev 적용 → 동작 확인 → prod 적용.**

### 3단계 — 버킷 비공개 전환 (collector 확인 후)

1. collector가 service_role 또는 signed URL로 전환됐는지 확인
2. 어드민 라우트 2곳(`observations`, `discovery-requests`)이 `image_url` 원본 대신 signed URL을 발급하도록 수정
3. `update storage.buckets set public = false where id = 'scan-images'` (dev → prod)

## Verification

- 1단계: 앱에서 개인정보처리방침 화면 진입 → 추가된 4개 문단이 4개 언어 모두 표시. JSON 파싱 검증.
- 2단계: dev에서 라우트를 수동 호출 → 조사 완료 상태인 행의 이미지가 실제로 삭제되고 `image_url`이 null로 바뀌는지 확인. `pending` 상태이면서 90일 미만인 행은 남아 있어야 한다.
- 3단계: 비공개 전환 후 어드민 화면에서 이미지가 계속 보이는지, collector 파이프라인이 계속 도는지 확인.

## Risks / Questions

| 리스크                            | 대응                                                                             |
| --------------------------------- | -------------------------------------------------------------------------------- |
| collector가 public URL 의존       | 3단계를 분리하고 확인 전까지 보류                                                |
| 방침 문구가 법적 효력을 가짐      | 문구는 사용자 최종 확인 후 반영                                                  |
| 국외 이전 고지 형식               | 개인정보보호법상 국외 이전은 별도 고지·동의 요건이 있을 수 있음 — 법률 검토 권장 |
| 삭제 cron이 조사 중 이미지를 지움 | 상태 조건 + 90일 상한 조합으로 방어. dev에서 먼저 검증                           |
| 기존 객체 소급 삭제               | prod 2건뿐이라 영향 미미. dev 8건도 동일                                         |
| `image_url` null 후 어드민 표시   | 삭제된 이미지는 "만료됨" 처리 필요 — 2단계 구현 시 확인                          |

## 진행 상태

- [x] 현황 조사
- [x] 보존 기간·공개 여부 결정
- [x] 1단계 방침 문구 — ko/en/ja/zh 4개 로케일 반영, `privacy.tsx` 섹션 배열 갱신, 시행일 2026-08-11로 변경
- [x] 2단계 cron 라우트 구현 (`api/cron/purge-scan-images`) + dev 적용 완료 - dev 검증: `no_match` 5건이 삭제 대상, `pending` 3건(90일 미만)은 보존으로 판정됨 - ⚠️ cron이 호출하는 URL은 배포된 라우트를 가리키므로, **web 배포 전까지는 404**가 난다. 배포 후 첫 실행 확인 필요
- [ ] 2단계 prod 적용 — **web 배포 후** 진행
- [ ] 3단계 비공개 전환 — collector 확인 대기
