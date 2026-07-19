-- 뽑기 행동 기반 배지 트랙: gacha_roll_variety(뽑은 상품 종류), gacha_roll_days(뽑기 시도한 날짜 수)
-- 어워드는 기존 app-layer 엔진(apps/web/src/lib/badges/earn.ts::checkAndAwardBadge) 재사용.
-- DB 트리거 없음 — roll API 라우트에서 롤 성공 직후 checkAndAwardBadge를 직접 호출한다.

INSERT INTO badge_definitions (track, tier, name, description, threshold) VALUES
  ('gacha_roll_variety', 1, '뽑기 입문자', '처음으로 가챠를 뽑아봤어요', 1),
  ('gacha_roll_variety', 2, '가챠 탐식가', '다양한 상품을 뽑아보고 있어요', 20),
  ('gacha_roll_variety', 3, '가챠 컬렉터', '온갖 가챠를 섭렵했어요', 50),
  ('gacha_roll_days', 1, '첫 방문', '처음 뽑기를 시도했어요', 1),
  ('gacha_roll_days', 2, '단골 뽑기러', '꾸준히 가챠를 뽑고 있어요', 10),
  ('gacha_roll_days', 3, '가챠 중독자', '가챠 뽑기가 일상이 됐어요', 30)
ON CONFLICT (track, tier) DO NOTHING;

-- gacha_roll_results 카운트 쿼리(user_id 필터 + product_id/rolled_at 조회) 지원용 인덱스.
-- 20260706_remove_gacha_roll_unique_constraint.sql / ..._day_unique_index.sql 에서
-- 기존 unique index가 제거된 이후로 user_id 계열 인덱스가 없는 상태였음.
CREATE INDEX IF NOT EXISTS gacha_roll_results_user_id_rolled_at_idx
  ON gacha_roll_results (user_id, rolled_at)
  INCLUDE (product_id);

-- 마이그레이션 적용 이전에 이미 뽑기 기록이 있는 유저 대상 1회성 소급 부여.
-- checkAndAwardBadge는 롤 1회당 트랙별로 최고 미획득 티어 1개만 주므로
-- (다음 롤을 하지 않으면 영영 못 받음), 기존 데이터는 여기서 한 번에 모든 자격 티어를 채워준다.
INSERT INTO user_badges (user_id, badge_definition_id)
SELECT grr.user_id, bd.id
FROM (
  SELECT
    user_id,
    count(DISTINCT product_id) AS variety_count,
    count(DISTINCT date(rolled_at AT TIME ZONE 'Asia/Seoul')) AS days_count
  FROM gacha_roll_results
  GROUP BY user_id
) grr
JOIN badge_definitions bd
  ON (bd.track = 'gacha_roll_variety' AND bd.threshold <= grr.variety_count)
  OR (bd.track = 'gacha_roll_days' AND bd.threshold <= grr.days_count)
ON CONFLICT DO NOTHING;
