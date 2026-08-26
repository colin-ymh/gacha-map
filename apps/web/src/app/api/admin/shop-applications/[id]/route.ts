import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdminAuth } from "@/lib/supabase/admin";
import { enqueueNotification } from "@/lib/notifications/sendPush";

interface Props {
  params: Promise<{ id: string }>;
}

/**
 * approve_shop_owner_application RPC가 RAISE EXCEPTION으로 던지는 안정적 식별자를
 * HTTP 상태/코드로 옮긴다.
 *
 * 이 식별자들은 supabase/migrations/20260824_shop_application_hardening.sql 의
 * 함수 본문과 1:1로 묶여 있다. 한쪽만 바꾸면 전부 500으로 떨어지므로
 * 반드시 같이 수정할 것.
 */
const APPROVE_ERROR_MAP: Record<string, { status: number; message: string }> = {
  application_not_found: { status: 404, message: "Application not found" },
  application_not_pending: {
    status: 409,
    message: "Application is already processed",
  },
  claim_missing_shop_id: {
    status: 400,
    message: "claim_shop application has no shop_id",
  },
  shop_not_found: { status: 404, message: "Target shop not found" },
  shop_not_active: { status: 400, message: "Target shop is not active" },
  shop_already_owned: {
    status: 409,
    message: "Target shop already has an owner",
  },
  new_shop_missing_fields: {
    status: 400,
    message: "new_shop application is missing shop_name or address",
  },
  missing_coordinates: {
    status: 400,
    message:
      "Application has no coordinates. Set lat/lng before approving so the shop is not created at 0,0.",
  },
  coordinates_out_of_range: {
    status: 400,
    message: "Application coordinates are out of valid range",
  },
  invalid_biz_reg: {
    status: 400,
    message:
      "Business registration number fails the checksum. The application may have bypassed the API.",
  },
  possible_duplicate_shop: {
    status: 409,
    message:
      "A shop with the same name already exists nearby. Re-send with force=true to override.",
  },
  unknown_application_type: {
    status: 400,
    message: "Unknown application type",
  },
};

// 긴 코드부터 검사한다. 한 코드가 다른 코드의 부분문자열이 되더라도
// (예: 'shop_not_found' vs 가상의 'shop_not_found_x') 더 구체적인 쪽이 이긴다.
const APPROVE_ERROR_CODES = Object.keys(APPROVE_ERROR_MAP).sort(
  (a, b) => b.length - a.length,
);

function mapApproveError(
  rpcMessage: string,
): { code: string; status: number; message: string } | null {
  for (const code of APPROVE_ERROR_CODES) {
    if (rpcMessage.includes(code)) {
      return { code, ...APPROVE_ERROR_MAP[code] };
    }
  }
  return null;
}

export async function PATCH(request: NextRequest, { params }: Props) {
  const authResult = await verifyAdminAuth(request);
  if (!authResult.ok) {
    return authResult.response;
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const { action, admin_note, force } = body as Record<string, unknown>;

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json(
      { error: "action must be approve or reject" },
      { status: 400 },
    );
  }

  const note =
    typeof admin_note === "string" ? admin_note.trim() || null : null;

  const supabase = createAdminClient();

  if (action === "approve") {
    // Fetch application user_id before approval for notification
    const { data: appData } = await supabase
      .from("shop_owner_applications")
      .select("id, user_id")
      .eq("id", id)
      .single();

    const { error } = await supabase.rpc("approve_shop_owner_application", {
      application_id: id,
      note,
      force: force === true,
    });

    if (error) {
      const mapped = mapApproveError(error.message);
      if (mapped) {
        return NextResponse.json(
          { error: mapped.message, code: mapped.code },
          { status: mapped.status },
        );
      }
      return NextResponse.json(
        { error: error.message, code: "server_error" },
        { status: 500 },
      );
    }

    // Enqueue shop_owner_update notification on approval
    if (appData?.user_id) {
      try {
        await enqueueNotification(
          supabase,
          appData.user_id,
          "shop_owner_update",
          "매장 소유자 신청 승인",
          `당신의 매장 소유자 신청이 승인되었습니다.`,
          {
            type: "shop_owner_update",
            application_id: id,
          },
        );
      } catch {
        // notification failure must not affect approval response
      }
    }

    return NextResponse.json({ id, status: "approved" });
  }

  // reject
  // Fetch application user_id before rejection for notification
  const { data: appData } = await supabase
    .from("shop_owner_applications")
    .select("id, user_id")
    .eq("id", id)
    .single();

  const { data, error } = await supabase
    .from("shop_owner_applications")
    .update({ status: "rejected", admin_note: note })
    .eq("id", id)
    .eq("status", "pending")
    .select("id, status")
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json(
        { error: "Application not found or already processed" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Enqueue shop_owner_update notification on rejection
  if (appData?.user_id) {
    try {
      await enqueueNotification(
        supabase,
        appData.user_id,
        "shop_owner_update",
        "매장 소유자 신청 반려",
        `당신의 매장 소유자 신청이 반려되었습니다.`,
        {
          type: "shop_owner_update",
          application_id: id,
        },
      );
    } catch {
      // notification failure must not affect rejection response
    }
  }

  return NextResponse.json({ id: data.id, status: data.status });
}
