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

| 컬럼          | 타입             | 설명                                  |
| ------------- | ---------------- | ------------------------------------- |
| `id`          | uuid             | PK                                    |
| `name`        | text             | 샵 이름                               |
| `address`     | text             | 주소                                  |
| `lat`         | double precision | 위도                                  |
| `lng`         | double precision | 경도                                  |
| `description` | text             | 설명 (선택)                           |
| `tags`        | text[]           | 태그 목록                             |
| `image_urls`  | text[]           | 이미지 URL 목록                       |
| `status`      | text             | `pending` \| `approved` \| `rejected` |
| `reported_by` | uuid             | 제보한 유저 (auth.users FK)           |
| `created_at`  | timestamptz      | 생성일                                |
| `updated_at`  | timestamptz      | 수정일 (트리거로 자동 갱신)           |

**샵 상태 흐름**

```
제보 접수 → pending → approved (지도에 노출)
                    → rejected
```

---

### `reports` — 제보

| 컬럼               | 타입        | 설명                                            |
| ------------------ | ----------- | ----------------------------------------------- |
| `id`               | uuid        | PK                                              |
| `user_id`          | uuid        | 제보자 (auth.users FK, NOT NULL)                |
| `shop_id`          | uuid        | 관련 샵 (선택, shops FK)                        |
| `report_type`      | text        | `new_shop` \| `fix_info` \| `closed` \| `other` |
| `reporter_name`    | text        | 제보자 이름 (선택, 현재 미사용)                 |
| `reporter_contact` | text        | 제보자 연락처 (선택, 현재 미사용)               |
| `content`          | text        | 제보 내용 (10~1000자)                           |
| `status`           | text        | `pending` \| `approved` \| `rejected`           |
| `created_at`       | timestamptz | 생성일                                          |

제보는 **로그인 필수**. `user_id`는 `auth.uid()`로 자동 기록된다.

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

## RLS 정책

| 테이블          | 대상      | 정책                                                        |
| --------------- | --------- | ----------------------------------------------------------- |
| `shops`         | 전체      | `status = 'active'`인 샵만 SELECT 가능                      |
| `reports`       | 인증 유저 | INSERT 시 `auth.uid() IS NOT NULL AND auth.uid() = user_id` |
| `wishlists`     | 인증 유저 | `auth.uid() = user_id`인 행만 모든 작업 가능                |
| `user_profiles` | 본인      | `auth.uid() = id`인 행만 SELECT/UPDATE 가능                 |
| `user_profiles` | 어드민    | `app_metadata.role = 'admin'`이면 모든 작업 가능            |

관리자 작업(`approve`, `reject` 등)은 `SUPABASE_SERVICE_ROLE_KEY`를 사용하는 서버 클라이언트로 RLS를 우회합니다.

## 인덱스

| 인덱스                   | 대상                  | 용도              |
| ------------------------ | --------------------- | ----------------- |
| `shops_status_idx`       | `shops(status)`       | 상태 필터링       |
| `shops_tags_idx`         | `shops(tags)` GIN     | 태그 검색         |
| `reports_status_idx`     | `reports(status)`     | 상태 필터링       |
| `reports_user_id_idx`    | `reports(user_id)`    | 유저별 제보 조회  |
| `wishlists_user_id_idx`  | `wishlists(user_id)`  | 유저 찜 목록 조회 |
| `user_profiles_role_idx` | `user_profiles(role)` | 역할 기반 조회    |
