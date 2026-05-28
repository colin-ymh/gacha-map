# 데이터베이스

Supabase (PostgreSQL)를 사용합니다. 전체 스키마는 `supabase/schema.sql`을 참고하세요.

## 테이블

### `user_profiles` — 사용자 프로필

| 컬럼         | 타입        | 설명                                             |
| ------------ | ----------- | ------------------------------------------------ |
| `id`         | uuid        | PK, `auth.users(id)` FK (ON DELETE CASCADE)      |
| `role`       | text        | `user` \| `shop_owner` \| `admin` (기본값: user) |
| `email`      | text        | 이메일 (선택)                                    |
| `name`       | text        | 표시 이름 (선택)                                 |
| `created_at` | timestamptz | 생성일                                           |
| `updated_at` | timestamptz | 수정일 (트리거로 자동 갱신)                      |

가입 시 `on_auth_user_created` 트리거가 `auth.users`에 INSERT되면 자동으로 생성된다.
Admin 역할 부여는 Supabase Studio에서 `role` 컬럼을 수동 변경한다.

---

### `shops` — 가챠샵

| 컬럼          | 타입             | 설명                                |
| ------------- | ---------------- | ----------------------------------- |
| `id`          | uuid             | PK                                  |
| `name`        | text             | 샵 이름                             |
| `address`     | text             | 주소                                |
| `lat`         | double precision | 위도                                |
| `lng`         | double precision | 경도                                |
| `description` | text             | 설명 (선택)                         |
| `tags`        | text[]           | 태그 목록                           |
| `image_urls`  | text[]           | 이미지 URL 목록                     |
| `status`      | text             | `active` \| `hidden` \| `archived`  |
| `reported_by` | uuid             | 제보한 유저 (auth.users FK)         |
| `owner_id`    | uuid             | 승인된 사업자 (auth.users FK, 선택) |
| `created_at`  | timestamptz      | 생성일                              |
| `updated_at`  | timestamptz      | 수정일 (트리거로 자동 갱신)         |

**샵 상태 흐름**

```
active (지도에 노출)
  ↓
hidden / archived (관리자에 의해 숨김 또는 보관)
```

---

### `reports` — 제보

| 컬럼               | 타입        | 설명                                            |
| ------------------ | ----------- | ----------------------------------------------- |
| `id`               | uuid        | PK                                              |
| `user_id`          | uuid        | 제보자 (auth.users FK, NOT NULL)                |
| `shop_id`          | uuid        | 관련 샵 (선택, shops FK)                        |
| `report_type`      | text        | `new_shop` \| `fix_info` \| `closed` \| `other` |
| `reporter_name`    | text        | 제보자 이름 (선택)                              |
| `reporter_contact` | text        | 제보자 연락처 (선택)                            |
| `content`          | text        | 제보 내용 (10~1000자)                           |
| `status`           | text        | `pending` \| `reviewed` \| `resolved`           |
| `created_at`       | timestamptz | 생성일                                          |

제보는 비로그인도 가능하다. 로그인 사용자는 `user_id`가 기록되고, 비로그인 제보는 `user_id = null`로 저장된다.

---

### `wishlists` — 찜하기

| 컬럼         | 타입        | 설명                 |
| ------------ | ----------- | -------------------- |
| `id`         | uuid        | PK                   |
| `user_id`    | uuid        | 유저 (auth.users FK) |
| `shop_id`    | uuid        | 샵 (shops FK)        |
| `created_at` | timestamptz | 생성일               |

`(user_id, shop_id)` unique 제약으로 중복 찜 방지.

---

### `gacha_products` — 가챠 상품 마스터

| 컬럼                 | 타입        | 설명                                  |
| -------------------- | ----------- | ------------------------------------- |
| `id`                 | uuid        | PK                                    |
| `manufacturer`       | text        | 제조사 (`bandai`, `takara_tomy_arts`) |
| `name`               | text        | 공식 상품명                           |
| `normalized_name`    | text        | 중복 판정용 정규화 상품명             |
| `name_ja`            | text        | 일본어명                              |
| `name_ko`            | text        | 승인된 대표 한국어명 캐시             |
| `name_en`            | text        | 관리자 보정 영어명                    |
| `jan_code`           | text        | JAN 코드 (있을 때)                    |
| `product_code`       | text        | 제조사 상품 코드 (있을 때)            |
| `price_jpy`          | integer     | 엔화 가격                             |
| `release_month`      | date        | 출시월 (`YYYY-MM-01`)                 |
| `release_week_text`  | text        | 원천 출시 주차/시기 텍스트            |
| `types_count`        | integer     | 종류 수                               |
| `official_image_url` | text        | 공식 이미지 URL                       |
| `source_url`         | text        | 공식 상품 URL                         |
| `source_type`        | text        | `official`                            |
| `status`             | text        | `active` \| `hidden` \| `archived`    |
| `created_at`         | timestamptz | 생성일                                |
| `updated_at`         | timestamptz | 수정일 (트리거로 자동 갱신)           |
| `last_seen_at`       | timestamptz | 마지막 수집 확인 시각                 |

`jan_code`, `(manufacturer, product_code)`, `(manufacturer, normalized_name, release_month)` 순서로 중복 상품을 판정한다.
한국어명은 `gacha_product_name_candidates`에서 승인된 대표 후보만 `name_ko`에 반영한다.

---

### `gacha_product_name_candidates` — 가챠 상품 한국어명 후보

| 컬럼                 | 타입        | 설명                                                                  |
| -------------------- | ----------- | --------------------------------------------------------------------- |
| `id`                 | uuid        | PK                                                                    |
| `product_id`         | uuid        | `gacha_products(id)` FK                                               |
| `locale`             | text        | `ko`                                                                  |
| `name`               | text        | 한국어명 후보                                                         |
| `normalized_name`    | text        | 중복 판정용 정규화명                                                  |
| `source_type`        | text        | `official_ko` \| `domestic_vendor` \| `admin` \| `machine` \| `user_alias` |
| `source_name`        | text        | 출처 이름                                                             |
| `source_url`         | text        | 출처 URL (있을 때)                                                    |
| `source_product_key` | text        | 출처 내 식별자 (있을 때)                                              |
| `confidence`         | numeric     | 자동 매칭/번역 신뢰도 (0~1, 선택)                                     |
| `status`             | text        | `pending` \| `approved` \| `rejected`                                 |
| `is_primary`         | boolean     | 승인된 대표 한국어명 여부                                             |
| `reviewed_by`        | uuid        | 검수한 관리자                                                         |
| `reviewed_at`        | timestamptz | 검수 시각                                                             |
| `created_at`         | timestamptz | 생성일                                                                |
| `updated_at`         | timestamptz | 수정일 (트리거로 자동 갱신)                                           |

자동번역명과 국내 업체명은 바로 공식명으로 취급하지 않고 후보로 저장한다.
`approved + is_primary` 후보만 `gacha_products.name_ko`에 동기화한다.

---

### `gacha_product_sources` — 상품 수집 출처

| 컬럼                 | 타입        | 설명                    |
| -------------------- | ----------- | ----------------------- |
| `id`                 | uuid        | PK                      |
| `product_id`         | uuid        | `gacha_products(id)` FK |
| `source_name`        | text        | 수집기 이름             |
| `source_url`         | text        | 원천 URL                |
| `source_product_key` | text        | 원천 내 상품 식별자     |
| `raw_name`           | text        | 원천 상품명             |
| `raw_price_text`     | text        | 원천 가격 텍스트        |
| `raw_release_text`   | text        | 원천 출시 텍스트        |
| `raw_image_url`      | text        | 원천 이미지 URL         |
| `fetched_at`         | timestamptz | 수집 시각               |
| `content_hash`       | text        | 변경 감지용 해시        |

원문 상세 설명/본문은 저장하지 않고, 식별과 변경 추적에 필요한 최소 필드만 저장한다.

---

### `shop_gacha_products` — 샵별 가챠 상품 보유 정보

| 컬럼                  | 타입        | 설명                                             |
| --------------------- | ----------- | ------------------------------------------------ |
| `id`                  | uuid        | PK                                               |
| `shop_id`             | uuid        | `shops(id)` FK                                   |
| `gacha_product_id`    | uuid        | `gacha_products(id)` FK                          |
| `availability_status` | text        | `seen` \| `available` \| `sold_out` \| `unknown` |
| `source`              | text        | `user_report` \| `shop_owner` \| `admin`         |
| `reported_by`         | uuid        | 제보자                                           |
| `verified_by`         | uuid        | 검증한 관리자                                    |
| `verified_at`         | timestamptz | 검증 시각                                        |
| `created_at`          | timestamptz | 생성일                                           |
| `updated_at`          | timestamptz | 수정일 (트리거로 자동 갱신)                      |

`(shop_id, gacha_product_id)` unique 제약으로 같은 샵의 같은 상품 중복 등록을 방지한다.

---

### `shop_owner_applications` — 사업자 샵 등록/소유권 신청

일반 사용자 제보(`reports`)와 분리된, 사업자 전용 신청 테이블이다.

| 컬럼                           | 타입             | 설명                                        |
| ------------------------------ | ---------------- | ------------------------------------------- |
| `id`                           | uuid             | PK                                          |
| `type`                         | text             | `new_shop` \| `claim_shop`                  |
| `user_id`                      | uuid             | 신청자 (auth.users FK, ON DELETE CASCADE)   |
| `shop_id`                      | uuid             | 소유권 주장 대상 샵 (claim_shop일 때, 선택) |
| `business_registration_number` | text             | 사업자 등록번호                             |
| `representative_name`          | text             | 대표자 이름                                 |
| `phone_number`                 | text             | 전화번호                                    |
| `shop_name`                    | text             | 샵 이름 (new_shop일 때 필수)                |
| `address`                      | text             | 주소 (new_shop일 때 필수)                   |
| `lat`                          | double precision | 위도 (선택)                                 |
| `lng`                          | double precision | 경도 (선택)                                 |
| `message`                      | text             | 추가 메시지 (선택)                          |
| `status`                       | text             | `pending` \| `approved` \| `rejected`       |
| `admin_note`                   | text             | 어드민 메모 (선택)                          |
| `created_at`                   | timestamptz      | 생성일                                      |
| `updated_at`                   | timestamptz      | 수정일 (트리거로 자동 갱신)                 |

승인 처리는 `approve_shop_owner_application(application_id, note)` RPC로 원자적으로 수행된다.

- `claim_shop` 승인: `shops.owner_id = user_id` 업데이트
- `new_shop` 승인: 새 shops row 생성 (`is_authorized = true`) + `user_profiles.role = 'shop_owner'`로 승격

---

## RLS 정책

| 테이블                  | 대상      | 정책                                                        |
| ----------------------- | --------- | ----------------------------------------------------------- |
| `shops`                 | 전체      | `status = 'active'`인 샵만 SELECT 가능                      |
| `reports`               | 인증 유저 | INSERT 시 `auth.uid() IS NOT NULL AND auth.uid() = user_id` |
| `wishlists`             | 인증 유저 | `auth.uid() = user_id`인 행만 모든 작업 가능                |
| `user_profiles`         | 본인      | `auth.uid() = id`인 행만 SELECT/UPDATE 가능                 |
| `user_profiles`         | 어드민    | `app_metadata.role = 'admin'`이면 모든 작업 가능            |
| `gacha_products`        | 전체      | `status = 'active'`인 상품만 SELECT 가능                    |
| `gacha_product_sources` | 어드민    | 수집 원천 데이터는 어드민만 조회/관리 가능                  |
| `gacha_product_name_candidates` | 어드민 | 한국어명 후보는 어드민만 조회/관리 가능                    |
| `shop_gacha_products`   | 전체      | 샵별 상품 보유 정보 SELECT 가능                             |
| `shop_gacha_products`   | 인증 유저 | 본인이 제보한 행만 INSERT/UPDATE 가능                       |

관리자 작업(`approve`, `reject` 등)은 `SUPABASE_SERVICE_ROLE_KEY`를 사용하는 서버 클라이언트로 RLS를 우회합니다.

## 인덱스

| 인덱스                                         | 대상                                                           | 용도                            |
| ---------------------------------------------- | -------------------------------------------------------------- | ------------------------------- |
| `shops_status_idx`                             | `shops(status)`                                                | 상태 필터링                     |
| `shops_tags_idx`                               | `shops(tags)` GIN                                              | 태그 검색                       |
| `reports_status_idx`                           | `reports(status)`                                              | 상태 필터링                     |
| `reports_user_id_idx`                          | `reports(user_id)`                                             | 유저별 제보 조회                |
| `wishlists_user_id_idx`                        | `wishlists(user_id)`                                           | 유저 찜 목록 조회               |
| `user_profiles_role_idx`                       | `user_profiles(role)`                                          | 역할 기반 조회                  |
| `gacha_products_jan_code_key`                  | `gacha_products(jan_code)`                                     | JAN 기준 중복 방지              |
| `gacha_products_manufacturer_product_code_key` | `gacha_products(manufacturer, product_code)`                   | 제조사 상품 코드 기준 중복 방지 |
| `gacha_products_fallback_key`                  | `gacha_products(manufacturer, normalized_name, release_month)` | fallback 중복 방지              |
| `gacha_products_search_idx`                    | `gacha_products` GIN                                           | 상품 검색                       |
| `gacha_product_sources_source_key`             | `gacha_product_sources(source_name, source_product_key)`       | 출처별 중복 방지                |
| `gacha_product_name_candidates_primary_key`    | `gacha_product_name_candidates(product_id, locale)`            | 대표 한국어명 중복 방지         |
| `shop_gacha_products_shop_id_idx`              | `shop_gacha_products(shop_id)`                                 | 샵별 보유 상품 조회             |
