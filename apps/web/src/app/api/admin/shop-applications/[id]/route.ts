import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdminAuth } from "@/lib/supabase/admin";
import { enqueueNotification } from "@/lib/notifications/sendPush";

interface Props {
  params: Promise<{ id: string }>;
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

  const { action, admin_note } = body as Record<string, unknown>;

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
    });

    if (error) {
      if (error.message.includes("not found")) {
        return NextResponse.json(
          { error: "Application not found" },
          { status: 404 },
        );
      }
      if (error.message.includes("not in pending")) {
        return NextResponse.json(
          { error: "Application is already processed" },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
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
