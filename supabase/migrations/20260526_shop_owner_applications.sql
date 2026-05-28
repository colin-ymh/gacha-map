-- shop_owner_applications 테이블: 사업자 샵 등록/소유권 신청
CREATE TABLE shop_owner_applications (
  id                            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  type                          text NOT NULL CHECK (type IN ('new_shop', 'claim_shop')),
  user_id                       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id                       uuid REFERENCES shops(id) ON DELETE SET NULL,
  business_registration_number  text NOT NULL,
  representative_name           text NOT NULL,
  phone_number                  text NOT NULL,
  shop_name                     text,
  address                       text,
  lat                           double precision,
  lng                           double precision,
  message                       text,
  status                        text NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note                    text,
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now()
);

-- 같은 유저가 같은 샵에 pending 신청 중복 방지
CREATE UNIQUE INDEX shop_owner_applications_no_dup_pending
  ON shop_owner_applications (user_id, shop_id)
  WHERE status = 'pending' AND shop_id IS NOT NULL;

CREATE INDEX shop_owner_applications_user_id_idx ON shop_owner_applications(user_id);
CREATE INDEX shop_owner_applications_status_idx ON shop_owner_applications(status);

CREATE TRIGGER shop_owner_applications_updated_at
  BEFORE UPDATE ON shop_owner_applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE shop_owner_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can view own applications"
  ON shop_owner_applications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "authenticated users can insert own applications"
  ON shop_owner_applications FOR INSERT
  WITH CHECK (auth.uid() = user_id AND auth.uid() IS NOT NULL);

-- shops 테이블에 owner_id 추가
ALTER TABLE shops ADD COLUMN owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX shops_owner_id_idx ON shops(owner_id);

-- 승인 처리 RPC: claim_shop 또는 new_shop 승인을 원자적으로 처리
CREATE OR REPLACE FUNCTION approve_shop_owner_application(
  application_id uuid,
  note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  app shop_owner_applications%ROWTYPE;
BEGIN
  SELECT * INTO app FROM shop_owner_applications WHERE id = application_id;

  IF app IS NULL OR app.id IS NULL THEN
    RAISE EXCEPTION 'Application not found: %', application_id;
  END IF;

  IF app.status != 'pending' THEN
    RAISE EXCEPTION 'Application is not in pending status: %', app.status;
  END IF;

  IF app.type = 'claim_shop' THEN
    IF app.shop_id IS NULL THEN
      RAISE EXCEPTION 'claim_shop application must have a shop_id';
    END IF;
    UPDATE shops SET owner_id = app.user_id, is_authorized = true WHERE id = app.shop_id;

  ELSIF app.type = 'new_shop' THEN
    IF app.shop_name IS NULL OR app.address IS NULL THEN
      RAISE EXCEPTION 'new_shop application must have shop_name and address';
    END IF;
    INSERT INTO shops (name, address, lat, lng, owner_id, is_authorized, reported_by)
    VALUES (
      app.shop_name,
      app.address,
      COALESCE(app.lat, 0),
      COALESCE(app.lng, 0),
      app.user_id,
      true,
      app.user_id
    );
  END IF;

  UPDATE user_profiles SET role = 'shop_owner' WHERE id = app.user_id;

  UPDATE shop_owner_applications
    SET status = 'approved', admin_note = note, updated_at = now()
  WHERE id = application_id;
END;
$$;
