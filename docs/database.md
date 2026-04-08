# 데이터베이스

Supabase (PostgreSQL)를 사용합니다. 전체 스키마는 `supabase/schema.sql`을 참고하세요.

## 테이블

### `shops` — 가챠샵

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | uuid | PK |
| `name` | text | 샵 이름 |
| `address` | text | 주소 |
| `lat` | double precision | 위도 |
| `lng` | double precision | 경도 |
| `description` | text | 설명 (선택) |
| `tags` | text[] | 태그 목록 |
| `image_urls` | text[] | 이미지 URL 목록 |
| `status` | text | `pending` \| `approved` \| `rejected` |
| `reported_by` | uuid | 제보한 유저 (auth.users FK) |
| `created_at` | timestamptz | 생성일 |
| `updated_at` | timestamptz | 수정일 (트리거로 자동 갱신) |

**샵 상태 흐름**

```
제보 접수 → pending → approved (지도에 노출)
                    → rejected
```

---

### `reports` — 제보

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | uuid | PK |
| `shop_id` | uuid | 관련 샵 (선택, shops FK) |
| `reporter_name` | text | 제보자 이름 (선택) |
| `reporter_contact` | text | 제보자 연락처 (선택) |
| `content` | text | 제보 내용 |
| `status` | text | `pending` \| `reviewed` \| `resolved` |
| `created_at` | timestamptz | 생성일 |

---

### `wishlists` — 찜하기

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | uuid | PK |
| `user_id` | uuid | 유저 (auth.users FK) |
| `shop_id` | uuid | 샵 (shops FK) |
| `created_at` | timestamptz | 생성일 |

`(user_id, shop_id)` unique 제약으로 중복 찜 방지.

---

### `duplicate_candidates` — 중복 후보

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | uuid | PK |
| `shop_a_id` | uuid | 샵 A (shops FK) |
| `shop_b_id` | uuid | 샵 B (shops FK) |
| `reviewed` | boolean | 검토 완료 여부 |
| `created_at` | timestamptz | 생성일 |

---

## RLS 정책

| 테이블 | 대상 | 정책 |
|--------|------|------|
| `shops` | 전체 | `status = 'approved'`인 샵만 SELECT 가능 |
| `reports` | 전체 | INSERT 가능 (누구나 제보 가능) |
| `wishlists` | 인증 유저 | `auth.uid() = user_id`인 행만 모든 작업 가능 |
| `duplicate_candidates` | — | 별도 정책 없음 (관리자만 service role로 접근) |

관리자 작업(`approve`, `reject` 등)은 `SUPABASE_SERVICE_ROLE_KEY`를 사용하는 서버 클라이언트로 RLS를 우회합니다.

## 인덱스

| 인덱스 | 대상 | 용도 |
|--------|------|------|
| `shops_status_idx` | `shops(status)` | 상태 필터링 |
| `shops_tags_idx` | `shops(tags)` GIN | 태그 검색 |
| `reports_status_idx` | `reports(status)` | 상태 필터링 |
| `wishlists_user_id_idx` | `wishlists(user_id)` | 유저 찜 목록 조회 |
