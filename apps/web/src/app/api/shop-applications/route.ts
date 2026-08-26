import { NextRequest, NextResponse } from "next/server";
import {
  createAdminClient,
  createAuthenticatedClient,
} from "@/lib/supabase/server";
import type { ShopOwnerApplicationType, ShopOwnerApplication } from "@/types";
import { containsProfanity, validateBizReg } from "@gacha-map/shared";
import { geocodeKeyword } from "@/lib/kakao/geocodeKeyword";
import sharp from "sharp";
import { randomUUID } from "crypto";

// sharp를 쓰므로 Node 런타임이어야 한다.
export const runtime = "nodejs";

/** 증빙 서류(사업자등록증) 전용 비공개 버킷. public URL이 없고 서명 URL로만 연다. */
const DOC_BUCKET = "business-docs";
const MAX_DOCS = 3;
const MAX_DOC_BYTES = 10 * 1024 * 1024;
const ALLOWED_DOC_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * 클라이언트가 code로 분기해 번역 문구를 고를 수 있도록 에러를 구조화한다.
 * 모바일/웹은 code -> i18n 키로 매핑하고, 모르는 code는 generic 문구로 폴백한다.
 * code 문자열을 바꾸면 클라이언트 매핑도 함께 바꿔야 한다.
 */
function fail(code: string, message: string, status: number) {
  return NextResponse.json({ error: message, code }, { status });
}

/**
 * 증빙 서류를 비공개 버킷에 올리고 경로 배열을 돌려준다.
 *
 * - 이미지는 sharp로 장변 2000px까지 축소하고 JPEG로 재인코딩한다.
 *   재인코딩 과정에서 EXIF가 떨어지므로 촬영 위치 같은 메타데이터가 남지 않는다.
 *   (.rotate()를 먼저 불러 EXIF 방향은 픽셀에 반영한다)
 * - PDF는 손대지 않고 그대로 올린다.
 * - 경로는 {user_id}/{uuid}.{ext}. public URL은 만들지 않는다.
 *
 * 하나라도 실패하면 이미 올린 것들을 지우고 throw 한다.
 */
async function uploadDocuments(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  documents: File[],
): Promise<string[]> {
  const uploaded: string[] = [];

  try {
    for (const doc of documents) {
      const input = Buffer.from(await doc.arrayBuffer());
      const isPdf = doc.type === "application/pdf";

      const output = isPdf
        ? input
        : await sharp(input)
            .rotate()
            .resize(2000, 2000, { fit: "inside", withoutEnlargement: true })
            .jpeg({ quality: 85 })
            .toBuffer();

      const path = `${userId}/${randomUUID()}.${isPdf ? "pdf" : "jpg"}`;
      const { error } = await supabase.storage
        .from(DOC_BUCKET)
        .upload(path, output, {
          contentType: isPdf ? "application/pdf" : "image/jpeg",
          upsert: false,
        });

      if (error) throw new Error(error.message);
      uploaded.push(path);
    }
  } catch (e) {
    if (uploaded.length > 0) {
      await supabase.storage
        .from(DOC_BUCKET)
        .remove(uploaded)
        .catch(() => {});
    }
    throw e;
  }

  return uploaded;
}

export async function GET(request: NextRequest) {
  const { user } = await createAuthenticatedClient(request);

  if (!user) {
    return fail("unauthorized", "Unauthorized", 401);
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("shop_owner_applications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return fail("server_error", error.message, 500);
  }

  return NextResponse.json({
    applications: (data ?? []) as ShopOwnerApplication[],
    total: data?.length ?? 0,
  });
}

export async function POST(request: NextRequest) {
  const { user } = await createAuthenticatedClient(request);

  if (!user) {
    return fail("unauthorized", "Unauthorized", 401);
  }

  // 요청은 두 가지 형태로 들어온다.
  //   1. multipart/form-data : payload(JSON 문자열) + documents(파일 최대 3개)
  //   2. application/json     : 서류 없이 본문만. claim_shop 등 서류가 선택인 경우.
  let body: unknown;
  let documents: File[] = [];

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return fail("invalid_body", "Invalid multipart body", 400);
    }

    const payload = form.get("payload");
    if (typeof payload !== "string") {
      return fail("invalid_body", "payload field is required", 400);
    }
    try {
      body = JSON.parse(payload);
    } catch {
      return fail("invalid_body", "payload is not valid JSON", 400);
    }

    // instanceof File 로 거르지 않는다. formData()가 돌려주는 File은 undici의
    // 클래스라 realm이 다르면(테스트의 jsdom 환경 등) instanceof가 false가 된다.
    // 실제로 필요한 건 arrayBuffer()/size/type 뿐이므로 그것만 확인한다.
    documents = form.getAll("documents").filter((f): f is File => {
      if (typeof f !== "object" || f === null) return false;
      const candidate = f as File;
      return (
        typeof candidate.arrayBuffer === "function" &&
        typeof candidate.size === "number" &&
        candidate.size > 0
      );
    });
  } else {
    try {
      body = await request.json();
    } catch {
      return fail("invalid_body", "Invalid JSON body", 400);
    }
  }

  if (!body || typeof body !== "object") {
    return fail("invalid_body", "Invalid request body", 400);
  }

  if (documents.length > MAX_DOCS) {
    return fail(
      "too_many_documents",
      `At most ${MAX_DOCS} documents are allowed`,
      400,
    );
  }
  for (const doc of documents) {
    if (doc.size > MAX_DOC_BYTES) {
      return fail(
        "document_too_large",
        "Each document must be 10MB or less",
        400,
      );
    }
    if (!ALLOWED_DOC_MIMES.includes(doc.type)) {
      return fail(
        "document_invalid_type",
        "Documents must be JPEG, PNG, WebP, or PDF",
        400,
      );
    }
  }

  const {
    type,
    shop_id,
    business_registration_number,
    representative_name,
    phone_number,
    shop_name,
    address,
    lat,
    lng,
    message,
    consent_privacy,
  } = body as Record<string, unknown>;

  const VALID_TYPES: ShopOwnerApplicationType[] = ["new_shop", "claim_shop"];
  if (!VALID_TYPES.includes(type as ShopOwnerApplicationType)) {
    return fail(
      "invalid_type",
      "type must be one of: new_shop, claim_shop",
      400,
    );
  }

  if (
    typeof business_registration_number !== "string" ||
    !business_registration_number.trim()
  ) {
    return fail(
      "biz_reg_required",
      "business_registration_number is required",
      400,
    );
  }

  // 형식 검증(국세청 체크섬). 실존 사업자 검증이 아니라 오타/허위 입력 차단용.
  const bizRegError = validateBizReg(business_registration_number);
  if (bizRegError) {
    return fail(
      bizRegError === "invalid_length"
        ? "biz_reg_invalid_length"
        : "biz_reg_invalid_checksum",
      `business_registration_number is invalid: ${bizRegError}`,
      400,
    );
  }

  if (typeof representative_name !== "string" || !representative_name.trim()) {
    return fail("rep_name_required", "representative_name is required", 400);
  }

  if (typeof phone_number !== "string" || !phone_number.trim()) {
    return fail("phone_required", "phone_number is required", 400);
  }

  // 개인정보 수집·이용 동의는 필수다. 동의 '시각'은 클라이언트 값을 믿지 않고
  // 서버가 now()로 기록한다(위조 방지). DB 컬럼은 구버전 앱 호환을 위해 nullable.
  if (consent_privacy !== true) {
    return fail("consent_required", "consent_privacy must be true", 400);
  }

  // 타입이 double precision이라 1e9 같은 값도 DB에 들어간다. 승인되면 그대로
  // shops로 넘어가므로 여기서 범위까지 본다. DB에도 같은 CHECK 제약이 있다.
  if (lat !== undefined && lat !== null) {
    if (typeof lat !== "number" || !Number.isFinite(lat)) {
      return fail("invalid_lat", "lat must be a number", 400);
    }
    if (lat < -90 || lat > 90) {
      return fail("invalid_lat", "lat must be between -90 and 90", 400);
    }
  }
  if (lng !== undefined && lng !== null) {
    if (typeof lng !== "number" || !Number.isFinite(lng)) {
      return fail("invalid_lng", "lng must be a number", 400);
    }
    if (lng < -180 || lng > 180) {
      return fail("invalid_lng", "lng must be between -180 and 180", 400);
    }
  }

  const supabase = createAdminClient();

  let resolvedLat: number | null = typeof lat === "number" ? lat : null;
  let resolvedLng: number | null = typeof lng === "number" ? lng : null;

  if (type === "claim_shop") {
    if (typeof shop_id !== "string" || !UUID_PATTERN.test(shop_id)) {
      return fail(
        "invalid_shop_id",
        "shop_id is required and must be a valid UUID for claim_shop",
        400,
      );
    }

    const { data: targetShop } = await supabase
      .from("shops")
      .select("id, status, owner_id")
      .eq("id", shop_id)
      .maybeSingle();

    if (!targetShop) {
      return fail("shop_not_found", "Shop not found", 404);
    }

    if (targetShop.status !== "active") {
      return fail("shop_not_active", "Cannot claim a non-active shop", 400);
    }

    // 소유권 탈취 차단의 1차 방어선. 최종 방어선은 승인 RPC의 owner_id 가드다.
    if (targetShop.owner_id) {
      return fail("shop_already_owned", "This shop already has an owner", 400);
    }

    // 중복 pending 신청 검사
    const { data: existing } = await supabase
      .from("shop_owner_applications")
      .select("id")
      .eq("user_id", user.id)
      .eq("shop_id", shop_id)
      .eq("status", "pending")
      .maybeSingle();

    if (existing) {
      return fail(
        "duplicate_pending",
        "A pending application already exists for this shop",
        409,
      );
    }

    // claim은 기존 샵의 좌표를 쓰므로 신청서에 좌표를 담지 않는다.
    resolvedLat = null;
    resolvedLng = null;
  }

  if (type === "new_shop") {
    if (typeof shop_name !== "string" || !shop_name.trim()) {
      return fail(
        "shop_name_required",
        "shop_name is required for new_shop",
        400,
      );
    }
    if (typeof address !== "string" || !address.trim()) {
      return fail("address_required", "address is required for new_shop", 400);
    }

    // 새 샵을 만드는 신청은 관리자가 대조할 근거가 아무것도 없다.
    // 사업자등록증 첨부를 필수로 둔다. claim_shop은 기존 샵 정보로 교차 확인이
    // 가능하므로 선택으로 남긴다.
    if (documents.length === 0) {
      return fail(
        "document_required",
        "A business registration certificate is required for new_shop",
        400,
      );
    }

    // 좌표가 없으면 서버가 한 번 더 지오코딩을 시도한다.
    // 그래도 못 구하면 신청 자체를 거부한다. 예전처럼 0,0으로 채우면
    // 승인 시 기니만 해상에 샵이 생성되기 때문이다.
    if (resolvedLat === null || resolvedLng === null) {
      const geocoded = await geocodeKeyword(address.trim());
      if (!geocoded) {
        return fail(
          "geocode_failed",
          "Could not resolve coordinates from the address. Pick the location on the map.",
          400,
        );
      }
      resolvedLat = geocoded.lat;
      resolvedLng = geocoded.lng;
    }

    // 같은 유저가 같은 사업자번호로 이미 pending 중인 new_shop 신청이 있는지.
    // DB의 부분 유니크 인덱스가 최종 방어선이고, 여기서는 친절한 메시지를 준다.
    const { data: existingNew } = await supabase
      .from("shop_owner_applications")
      .select("id")
      .eq("user_id", user.id)
      .eq("biz_reg_digits", business_registration_number.replace(/\D/g, ""))
      .is("shop_id", null)
      .eq("status", "pending")
      .maybeSingle();

    if (existingNew) {
      return fail(
        "duplicate_pending",
        "A pending application already exists for this business registration number",
        409,
      );
    }
  }

  const trimmedMessage =
    typeof message === "string" ? message.trim() || null : null;
  if (trimmedMessage && containsProfanity(trimmedMessage)) {
    return fail("profanity", "profanity", 400);
  }

  // 서류를 먼저 올리고 경로를 확보한 뒤 신청 행을 만든다.
  // insert가 실패하면 아래에서 올린 객체를 정리한다(고아 파일 방지).
  let documentPaths: string[] = [];
  if (documents.length > 0) {
    try {
      documentPaths = await uploadDocuments(supabase, user.id, documents);
    } catch {
      return fail("document_upload_failed", "Failed to store documents", 500);
    }
  }

  const { data, error } = await supabase
    .from("shop_owner_applications")
    .insert({
      type: type as ShopOwnerApplicationType,
      user_id: user.id,
      shop_id: type === "claim_shop" ? (shop_id as string) : null,
      business_registration_number: (
        business_registration_number as string
      ).trim(),
      representative_name: (representative_name as string).trim(),
      phone_number: (phone_number as string).trim(),
      shop_name: typeof shop_name === "string" ? shop_name.trim() : null,
      address: typeof address === "string" ? address.trim() : null,
      lat: resolvedLat,
      lng: resolvedLng,
      message: trimmedMessage,
      document_paths: documentPaths.length > 0 ? documentPaths : null,
      consent_privacy_at: new Date().toISOString(),
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    // 신청 행이 안 생겼으면 방금 올린 서류는 참조되지 않는 개인정보 덩어리다.
    if (documentPaths.length > 0) {
      await supabase.storage
        .from(DOC_BUCKET)
        .remove(documentPaths)
        .catch(() => {});
    }

    // 부분 유니크 인덱스 위반 = 동시 요청으로 중복 신청이 들어온 경우
    if (error.code === "23505") {
      return fail(
        "duplicate_pending",
        "A pending application already exists",
        409,
      );
    }
    return fail("server_error", error.message, 500);
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
