-- badge_definitions: 어드민이 관리하는 배지 정의
CREATE TABLE badge_definitions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  track text NOT NULL,
  tier smallint NOT NULL CHECK (tier IN (1, 2, 3)),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  icon_url text NOT NULL DEFAULT '',
  threshold integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(track, tier)
);

-- user_badges: 사용자가 획득한 배지
CREATE TABLE user_badges (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_definition_id uuid NOT NULL REFERENCES badge_definitions(id) ON DELETE CASCADE,
  earned_at timestamptz DEFAULT now(),
  UNIQUE(user_id, badge_definition_id)
);

-- badge_count_log: 배지 카운트 주간 dedup
CREATE TABLE badge_count_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  week_start date NOT NULL,
  counted_at timestamptz DEFAULT now(),
  UNIQUE(user_id, shop_id, action_type, week_start)
);

-- abuse_flags: 이상 행동 플래그
CREATE TABLE abuse_flags (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flag_type text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id)
);

-- user_profiles: 대표 배지 컬럼 추가
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS main_badge_id uuid REFERENCES user_badges(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE badge_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE badge_count_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE abuse_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "badge_definitions: read for all" ON badge_definitions FOR SELECT USING (true);
CREATE POLICY "badge_definitions: write for admin only" ON badge_definitions FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "user_badges: read for all" ON user_badges FOR SELECT USING (true);
CREATE POLICY "user_badges: insert by service role" ON user_badges FOR INSERT WITH CHECK (true);

CREATE POLICY "badge_count_log: insert by service role" ON badge_count_log FOR INSERT WITH CHECK (true);
CREATE POLICY "badge_count_log: read own" ON badge_count_log FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "abuse_flags: admin only" ON abuse_flags FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- 배지 정의 초기 데이터 (임계값은 어드민에서 수정 가능)
INSERT INTO badge_definitions (track, tier, name, description, threshold) VALUES
  ('quick_report', 1, '눈팅러', '처음으로 퀵리포트를 제출했어요', 1),
  ('quick_report', 2, '정보통', '꾸준히 현장 상황을 알려주고 있어요', 10),
  ('quick_report', 3, '가차신', '가차 현장의 전설이에요', 30),
  ('shop_review', 1, '수다쟁이', '처음으로 샵 리뷰를 남겼어요', 1),
  ('shop_review', 2, '리뷰어', '유용한 리뷰를 꾸준히 작성하고 있어요', 10),
  ('shop_review', 3, '구루', '리뷰계의 구루예요', 30),
  ('new_shop_report', 1, '발굴러', '새로운 샵을 처음 발굴했어요', 1),
  ('new_shop_report', 2, '탐험가', '지도를 넓혀가고 있어요', 5),
  ('new_shop_report', 3, '지도 제작자', '가차 지도의 개척자예요', 15),
  ('closed_shop_report', 1, '정리왕', '폐업 샵을 처음 신고했어요', 1),
  ('closed_shop_report', 2, '추적자', '현장 정보를 정확하게 유지하고 있어요', 5),
  ('closed_shop_report', 3, '현실주의자', '지도를 항상 최신으로 유지해요', 15),
  ('fix_info_report', 1, '꼼꼼이', '처음으로 정보 수정을 요청했어요', 1),
  ('fix_info_report', 2, '팩트체커', '틀린 정보를 바로잡고 있어요', 5),
  ('fix_info_report', 3, '진실 수호자', '정보 정확성의 수호자예요', 15),
  ('wishlist', 1, '찜 초보', '처음으로 샵을 위시리스트에 추가했어요', 1),
  ('wishlist', 2, '수집가', '마음에 드는 샵을 모으고 있어요', 10),
  ('wishlist', 3, '욕망 큐레이터', '취향의 아카이브를 완성했어요', 30),
  ('operator', 1, '공식 운영자', '관리자가 인증한 샵 운영자예요', 0);
