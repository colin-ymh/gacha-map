# 빠른 제보 (Quick Report) 설계

## 배경

현재 제보는 줄글 텍스트 입력 중심이라 사용자 진입 장벽이 높다.
긁어온 샵 데이터의 퀄리티를 높이기 위해, 방문자가 한 탭으로 "가챠 있었어요 / 없었어요"를 제보할 수 있는 UX가 필요하다.

---

## 범위

**포함:**

- 가챠 탭 빈 상태에 빠른 제보 버튼 추가 (모바일 + 웹)
- `shop_quick_reports` 신규 테이블
- `user_profiles.contribution_count` 컬럼 추가
- 뱃지 마일스톤 (프로필 표시)
- 위치 검증 (반경 500m 하드 게이트)
- 지도 메인 화면에서 제보 버튼 제거

**제외:**

- 기존 줄글 제보 변경 (샵 상세에서 그대로 유지)
- 포인트/쿠폰 리워드
- 리뷰 탭 빈 상태 변경 (이번 범위 아님)
- "없었어요" 자동 처리 (어드민 수동 검토)

---

## 데이터 모델

### 신규 테이블: `shop_quick_reports`

```sql
CREATE TABLE shop_quick_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('gacha_present', 'gacha_absent')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(shop_id, user_id)
);

CREATE INDEX shop_quick_reports_shop_idx ON shop_quick_reports(shop_id);
CREATE INDEX shop_quick_reports_user_idx ON shop_quick_reports(user_id);
```

### 기존 테이블 수정: `user_profiles`

```sql
ALTER TABLE user_profiles
  ADD COLUMN contribution_count int NOT NULL DEFAULT 0;
```

---

## API

### POST `/api/shops/[id]/quick-report`

**요청:**

```json
{ "kind": "gacha_present" | "gacha_absent" }
```

**헤더:** Authorization 필수 (로그인 필수)

**처리 순서:**

1. 로그인 확인 (미로그인 → 401)
2. 위치 검증: 클라이언트가 위도/경도 전송, 샵과의 거리 계산 (> 500m → 403)
3. `shop_quick_reports` INSERT (중복 시 → 409)
4. `user_profiles.contribution_count` +1
5. 마일스톤 확인 → 달성 뱃지 반환

**응답:**

```json
{
  "success": true,
  "contribution_count": 7,
  "new_badge": { "id": "gacha_hunter", "name": "가챠 헌터", "emoji": "🔍" } | null
}
```

**요청 body (위치 포함):**

```json
{
  "kind": "gacha_present",
  "user_lat": 37.5563,
  "user_lng": 126.9236
}
```

---

## UI/UX

### 가챠 탭 빈 상태 (가챠 상품 0개)

```
[ 🎰 아직 가챠 정보가 없어요 ]
[ 방문하셨다면 알려주세요! ]

[ 🎰 가챠 있었어요 ]  [ 😅 없었어요 ]

[ 제보하면 뱃지를 드려요 ✨ ]
```

**상태 흐름:**

- 기본: 버튼 2개 활성
- 위치 권한 없음 / 500m 초과: 버튼 비활성 + "근처에서만 제보 가능해요" 표시
- 미로그인 탭: 로그인 유도 모달
- 탭 성공: 버튼 → "✓ 제보 완료" (비활성화)
- 재방문 (이미 제보): "이미 제보하셨어요" 표시

**토스트:**

- 성공: "감사해요! 🎉"
- 마일스톤 달성: "🏆 '가챠 헌터' 뱃지를 획득했어요!"

### 지도 메인 화면

- 기존 제보 버튼/아이콘 제거

---

## 뱃지 마일스톤

| contribution_count | 뱃지 ID          | 이름        | 이모지 |
| ------------------ | ---------------- | ----------- | ------ |
| 1                  | `first_explorer` | 첫 탐험가   | 🗺️     |
| 5                  | `info_collector` | 정보 수집가 | 📡     |
| 15                 | `gacha_hunter`   | 가챠 헌터   | 🔍     |
| 30                 | `gacha_doctor`   | 가챠 박사   | 🏆     |

- 마이페이지 프로필에 획득한 뱃지 표시
- 뱃지 정보는 코드 상수로 관리 (별도 DB 테이블 불필요)
- 달성 여부 = `contribution_count >= milestone.threshold`

---

## 어드민

- `shop_quick_reports` 집계를 샵 상세 어드민 뷰에 추가
  - "있었어요 N명 / 없었어요 N명"
- "없었어요" 임계값(예: 3명 이상) 초과 시 어드민 큐에 플래그 표시
- 어드민이 확인 후 샵 상태 수동 변경

---

## 위치 검증

- 클라이언트: 버튼 노출 전 `navigator.geolocation.getCurrentPosition()` 호출
- 거리 계산: Haversine formula, 샵 `lat/lng` 기준 500m
- 서버도 위치 재검증 (클라이언트 신뢰 불가)
- 모바일: 지도용 위치 권한 이미 있으므로 마찰 없음
- 웹: 위치 권한 팝업 발생 → 거부 시 버튼 비활성 유지

---

## 검증 방법

1. 로그인 후 가챠 없는 샵 상세 → 가챠 탭 → 버튼 표시 확인
2. 500m 초과 위치에서 버튼 비활성 확인
3. 500m 이내에서 "있었어요" 탭 → `shop_quick_reports` INSERT 확인
4. 동일 샵 재탭 → 409 중복 처리 확인
5. contribution_count 증가 + 마일스톤 달성 시 토스트 확인
6. 지도 화면에서 제보 버튼 없는지 확인

---

## 리스크 / 확인 필요

- 웹에서 위치 권한 거부율 높을 수 있음 → 웹은 소프트 경고로 완화할지 재검토 가능
- Haversine 계산 서버 구현 필요 (Supabase RPC 또는 API route)
- 뱃지 UI (마이페이지) 신규 컴포넌트 필요
