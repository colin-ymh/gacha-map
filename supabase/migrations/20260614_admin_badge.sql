-- Admin badge definition
INSERT INTO badge_definitions (track, tier, name, description, threshold)
VALUES ('admin', 1, '가챠맵 운영진', '가챠맵 서비스 운영팀이에요', 0);

-- Auto-grant admin badge when user role becomes 'admin'
CREATE OR REPLACE FUNCTION grant_admin_badge()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  def_id uuid;
BEGIN
  IF NEW.role = 'admin' AND (OLD.role IS NULL OR OLD.role <> 'admin') THEN
    SELECT id INTO def_id FROM badge_definitions WHERE track = 'admin' LIMIT 1;
    IF def_id IS NOT NULL THEN
      INSERT INTO user_badges (user_id, badge_definition_id)
      VALUES (NEW.id, def_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_grant_admin_badge
AFTER INSERT OR UPDATE OF role ON user_profiles
FOR EACH ROW EXECUTE FUNCTION grant_admin_badge();
