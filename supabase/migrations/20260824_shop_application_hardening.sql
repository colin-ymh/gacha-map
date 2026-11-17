-- 사업자 등록(shop_owner_applications) 플로우 하드닝
--
-- 목적 (실사업자 온보딩 전 데이터 파손 차단):
--   1. new_shop 승인 시 좌표가 없으면 COALESCE(...,0)으로 0,0(기니만 해상)에 샵이
--      생성되던 문제 차단. 좌표 없으면 승인 자체를 실패시킨다.
--   2. 이미 owner_id가 있는 샵을 claim_shop으로 덮어쓰던 소유권 탈취 차단.
--   3. 사업자등록번호 중복 탐지용 정규화 컬럼 + new_shop 중복 pending 방지.
--   4. 증빙 서류 경로 / 개인정보 동의 시각 컬럼 추가.
--   5. 사용자가 본인 pending 신청을 취소할 수 있도록 'cancelled' 상태 + UPDATE RLS.
--
-- 주의: PostGIS는 이 프로젝트에서 비활성(supabase/schema.sql:2)이므로
--       중복 샵 근접 판정은 위/경도 바운딩 박스로 근사한다.

-- ---------------------------------------------------------------------------
-- 1. 컬럼 추가
-- ---------------------------------------------------------------------------

ALTER TABLE shop_owner_applications
  -- 증빙 서류(사업자등록증)의 스토리지 '경로'. public URL이 아니다.
  -- 비공개 버킷 business-docs 기준이며 열람은 서버가 발급한 서명 URL로만 한다.
  ADD COLUMN IF NOT EXISTS document_paths text[],
  -- 개인정보 수집·이용 동의 시각. 서버가 now()로 기록한다(클라이언트 값 신뢰 금지).
  -- NOT NULL로 걸지 않는다: 구버전 앱 신청이 전부 실패하기 때문.
  -- 필수화는 API 레벨에서만 수행한다.
  ADD COLUMN IF NOT EXISTS consent_privacy_at timestamptz,
  -- 하이픈 유무와 무관하게 중복을 탐지하기 위한 정규화 컬럼.
  ADD COLUMN IF NOT EXISTS biz_reg_digits text
    GENERATED ALWAYS AS (
      regexp_replace(business_registration_number, '\D', '', 'g')
    ) STORED;

COMMENT ON COLUMN shop_owner_applications.document_paths IS
  '비공개 버킷 business-docs 내 증빙 서류 경로 배열. public URL 아님.';
COMMENT ON COLUMN shop_owner_applications.consent_privacy_at IS
  '개인정보 수집·이용 동의 시각. 서버가 now()로 기록. API 레벨에서만 필수.';
COMMENT ON COLUMN shop_owner_applications.biz_reg_digits IS
  '사업자등록번호에서 숫자만 추출한 정규화 값. 중복 탐지·인덱스용.';

-- ---------------------------------------------------------------------------
-- 2. status에 'cancelled' 추가
-- ---------------------------------------------------------------------------

ALTER TABLE shop_owner_applications
  DROP CONSTRAINT IF EXISTS shop_owner_applications_status_check;

ALTER TABLE shop_owner_applications
  ADD CONSTRAINT shop_owner_applications_status_check
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled'));

-- ---------------------------------------------------------------------------
-- 3. 인덱스
-- ---------------------------------------------------------------------------

-- new_shop 중복 pending 방지: 같은 유저가 같은 사업자번호로 여러 건 신청 불가.
-- (claim_shop은 기존 shop_owner_applications_no_dup_pending 인덱스가 담당)
CREATE UNIQUE INDEX IF NOT EXISTS shop_owner_applications_no_dup_pending_new
  ON shop_owner_applications (user_id, biz_reg_digits)
  WHERE status = 'pending' AND shop_id IS NULL;

-- admin이 "같은 사업자번호로 다른 유저가 신청했는가"를 조회하기 위한 인덱스.
-- 정당한 다점포 사업자를 막지 않기 위해 유니크가 아니다. 차단이 아니라 경고용.
CREATE INDEX IF NOT EXISTS shop_owner_applications_biz_reg_idx
  ON shop_owner_applications (biz_reg_digits);

-- 주의: claim_shop의 '전역' 중복(서로 다른 유저의 동시 pending)은 인덱스로 막지
-- 않는다. 전역 유니크를 걸면 먼저 들어온 허위 클레임이 진짜 사업자를 영구 봉쇄한다.
-- 실질적 방어선은 아래 approve RPC의 owner_id 가드다.

-- ---------------------------------------------------------------------------
-- 4. 신청 취소는 클라이언트 직접 UPDATE로 열지 않는다
-- ---------------------------------------------------------------------------
--
-- 한때 아래 정책을 넣었다가 제거했다:
--
--   CREATE POLICY ... FOR UPDATE
--     USING (auth.uid() = user_id AND status = 'pending')
--     WITH CHECK (auth.uid() = user_id AND status = 'cancelled');
--
-- WITH CHECK가 '새 행의 user_id와 status'만 본다는 게 함정이다. 사용자가 취소하는
-- 김에 business_registration_number, representative_name, lat/lng, document_paths,
-- admin_note 까지 같이 바꿔 넣어도 정책을 통과한다. 감사 기록과 개인정보가 오염된다.
--
-- 취소는 service_role로 도는 API(DELETE /api/shop-applications/[id])만 수행하며,
-- 거기서 user_id와 status='pending'을 확인하고 status만 갱신한다.
-- 따라서 UPDATE 정책을 두지 않는 것이 맞다.
DROP POLICY IF EXISTS "users can cancel own pending applications"
  ON shop_owner_applications;

-- ---------------------------------------------------------------------------
-- 4-1. 좌표 범위 제약
-- ---------------------------------------------------------------------------

-- 타입이 double precision이라 1e9 같은 값도 들어간다. 승인되면 그대로 shops로 간다.
-- 기존 행을 막지 않도록 NOT VALID로 붙인다(신규/변경 행에만 적용).
ALTER TABLE shop_owner_applications
  DROP CONSTRAINT IF EXISTS shop_owner_applications_latlng_range_check;

ALTER TABLE shop_owner_applications
  ADD CONSTRAINT shop_owner_applications_latlng_range_check
    CHECK (
      (lat IS NULL OR (lat >= -90  AND lat <= 90)) AND
      (lng IS NULL OR (lng >= -180 AND lng <= 180))
    ) NOT VALID;

-- ---------------------------------------------------------------------------
-- 4-2. 사업자등록번호 체크섬을 DB에서도 검증
-- ---------------------------------------------------------------------------
--
-- API(packages/shared/src/utils/validateBizReg.ts)에만 두면, RLS INSERT 정책이
-- 열려 있는 한 클라이언트가 Supabase에 직접 insert해서 우회할 수 있다.
-- 승인 시점에 DB가 한 번 더 본다. 두 구현은 반드시 같은 알고리즘이어야 한다.
CREATE OR REPLACE FUNCTION is_valid_biz_reg(value text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  d       text;
  weights int[] := ARRAY[1,3,7,1,3,7,1,3,5];
  total   int   := 0;
  i       int;
BEGIN
  IF value IS NULL THEN RETURN false; END IF;
  d := regexp_replace(value, '\D', '', 'g');
  IF length(d) <> 10 THEN RETURN false; END IF;

  FOR i IN 1..9 LOOP
    total := total + (substr(d, i, 1))::int * weights[i];
  END LOOP;
  total := total + ((substr(d, 9, 1))::int * 5) / 10;

  RETURN ((10 - (total % 10)) % 10) = (substr(d, 10, 1))::int;
END;
$$;

COMMENT ON FUNCTION is_valid_biz_reg(text) IS
  '국세청 사업자등록번호 체크섬. 형식 검증일 뿐 실존 사업자 보장이 아니다.';

-- ---------------------------------------------------------------------------
-- 5. 승인 RPC 재작성
-- ---------------------------------------------------------------------------
--
-- 변경점:
--   - SET search_path = public 추가 (SECURITY DEFINER 하드닝)
--   - 신청 행 FOR UPDATE 잠금 → 이중 승인 레이스 차단
--   - claim_shop: 대상 샵 FOR UPDATE 잠금 + owner_id IS NULL 검사
--     + 조건부 UPDATE의 ROW_COUNT 재확인(이중 방어)
--   - new_shop: lat/lng NULL이면 하드 실패. COALESCE(...,0) 완전 제거
--   - new_shop: 100m 내 동일 이름 active 샵이 있으면 실패, force=true로 오버라이드
--
--   - admin이 자기 샵을 클레임했을 때 role이 shop_owner로 강등되던 문제 차단
--
-- 예외 메시지는 API가 문자열 매칭으로 HTTP 코드에 매핑하므로
-- 안정적인 식별자(snake_case)로 고정한다. 임의로 바꾸지 말 것.
-- (apps/web/src/app/api/admin/shop-applications/[id]/route.ts 의 매핑과 함께 관리)

-- force 인자가 늘어나므로 CREATE OR REPLACE로는 교체되지 않고 '오버로드'가 된다.
-- 그러면 취약한 구버전 (uuid, text) 함수가 살아남고, 2인자 호출은
-- "function ... is not unique" 로 실패한다. 반드시 기존 시그니처를 먼저 지운다.
DROP FUNCTION IF EXISTS approve_shop_owner_application(uuid, text);

CREATE OR REPLACE FUNCTION approve_shop_owner_application(
  application_id uuid,
  note text DEFAULT NULL,
  force boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  app        shop_owner_applications%ROWTYPE;
  shop_row   shops%ROWTYPE;
  updated    integer;
  dup_exists boolean;
BEGIN
  -- 신청 행 잠금: 두 admin이 동시에 승인을 눌러도 한쪽만 통과한다.
  SELECT * INTO app
    FROM shop_owner_applications
   WHERE id = application_id
     FOR UPDATE;

  IF app.id IS NULL THEN
    RAISE EXCEPTION 'application_not_found';
  END IF;

  IF app.status <> 'pending' THEN
    RAISE EXCEPTION 'application_not_pending';
  END IF;

  -- API를 우회해 Supabase에 직접 insert된 신청도 여기서 걸린다.
  IF NOT is_valid_biz_reg(app.business_registration_number) THEN
    RAISE EXCEPTION 'invalid_biz_reg';
  END IF;

  IF app.type = 'claim_shop' THEN
    IF app.shop_id IS NULL THEN
      RAISE EXCEPTION 'claim_missing_shop_id';
    END IF;

    SELECT * INTO shop_row FROM shops WHERE id = app.shop_id FOR UPDATE;

    IF shop_row.id IS NULL THEN
      RAISE EXCEPTION 'shop_not_found';
    END IF;

    IF shop_row.status <> 'active' THEN
      RAISE EXCEPTION 'shop_not_active';
    END IF;

    -- 소유권 탈취 차단: 이미 주인이 있으면 절대 덮어쓰지 않는다.
    IF shop_row.owner_id IS NOT NULL THEN
      RAISE EXCEPTION 'shop_already_owned';
    END IF;

    UPDATE shops
       SET owner_id = app.user_id,
           is_authorized = true
     WHERE id = app.shop_id
       AND owner_id IS NULL;

    GET DIAGNOSTICS updated = ROW_COUNT;
    IF updated = 0 THEN
      -- FOR UPDATE 잠금이 있으므로 도달 불가에 가깝지만, 조건부 UPDATE가
      -- 실제로 적용됐는지 확인하는 최종 방어선이다.
      RAISE EXCEPTION 'shop_already_owned';
    END IF;

  ELSIF app.type = 'new_shop' THEN
    IF app.shop_name IS NULL OR app.address IS NULL THEN
      RAISE EXCEPTION 'new_shop_missing_fields';
    END IF;

    -- 좌표 없으면 승인 불가. 예전처럼 0,0으로 채우지 않는다.
    IF app.lat IS NULL OR app.lng IS NULL THEN
      RAISE EXCEPTION 'missing_coordinates';
    END IF;

    IF app.lat < -90 OR app.lat > 90 OR app.lng < -180 OR app.lng > 180 THEN
      RAISE EXCEPTION 'coordinates_out_of_range';
    END IF;

    IF NOT force THEN
      -- 같은 이름으로 동시에 들어온 두 신청을 두 admin이 동시에 승인하면
      -- 아래 EXISTS 검사가 양쪽 모두 '중복 없음'으로 통과해 샵이 두 개 생긴다.
      -- 신청 row 잠금은 서로 다른 row라 도움이 안 되므로, 정규화된 이름으로
      -- 트랜잭션 advisory lock을 잡아 같은 이름끼리 직렬화한다.
      PERFORM pg_advisory_xact_lock(
        hashtext('new_shop:' || lower(regexp_replace(app.shop_name, '\s', '', 'g')))::bigint
      );

      -- 약 100m 바운딩 박스 + 공백/대소문자 무시한 이름 일치.
      -- 위도 1도 ~= 111km 이므로 0.0009도 ~= 100m.
      -- 경도는 고위도로 갈수록 좁아지므로 cos(lat)으로 보정한다.
      SELECT EXISTS (
        SELECT 1
          FROM shops s
         WHERE s.status = 'active'
           AND abs(s.lat - app.lat) < 0.0009
           AND abs(s.lng - app.lng)
               < 0.0009 / GREATEST(cos(radians(app.lat)), 0.01)
           AND lower(regexp_replace(s.name, '\s', '', 'g'))
               = lower(regexp_replace(app.shop_name, '\s', '', 'g'))
      ) INTO dup_exists;

      IF dup_exists THEN
        -- admin이 확인 후 force := true로 재호출하면 통과한다.
        RAISE EXCEPTION 'possible_duplicate_shop';
      END IF;
    END IF;

    INSERT INTO shops (name, address, lat, lng, owner_id, is_authorized, reported_by)
    VALUES (
      app.shop_name,
      app.address,
      app.lat,
      app.lng,
      app.user_id,
      true,
      app.user_id
    );

  ELSE
    RAISE EXCEPTION 'unknown_application_type';
  END IF;

  -- admin이 본인 샵을 등록/클레임하는 경우 role이 shop_owner로 강등되면 안 된다.
  UPDATE user_profiles
     SET role = 'shop_owner'
   WHERE id = app.user_id
     AND role IS DISTINCT FROM 'admin';

  UPDATE shop_owner_applications
     SET status = 'approved',
         admin_note = note,
         updated_at = now()
   WHERE id = application_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. 실행 권한 회수 (중요)
-- ---------------------------------------------------------------------------
--
-- Postgres 함수는 생성 시 기본으로 PUBLIC EXECUTE가 붙는다. Supabase는 public
-- 스키마 함수를 PostgREST RPC로 노출하므로, 그대로 두면 **anon 키만 가진 아무나**
-- 아래를 호출할 수 있다:
--
--   POST /rest/v1/rpc/approve_shop_owner_application
--   { "application_id": "<본인 신청 id>", "force": true }
--
-- 즉 관리자 없이 자기 신청을 승인해 샵 소유권과 shop_owner 권한을 가져갈 수 있다.
-- 이 함수는 서버(admin API 라우트)가 service_role로만 호출한다.
REVOKE ALL ON FUNCTION approve_shop_owner_application(uuid, text, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION approve_shop_owner_application(uuid, text, boolean)
  TO service_role;

-- is_valid_biz_reg는 순수 함수라 노출돼도 무해하지만 굳이 열 이유도 없다.
REVOKE ALL ON FUNCTION is_valid_biz_reg(text) FROM PUBLIC, anon;

-- ---------------------------------------------------------------------------
-- 7. PostgREST 스키마 캐시 갱신
-- ---------------------------------------------------------------------------
-- RPC 시그니처와 컬럼이 바뀌었다. 캐시가 낡으면 force 인자 호출,
-- biz_reg_digits 필터, consent_privacy_at insert가 배포 직후 실패한다.
NOTIFY pgrst, 'reload schema';
