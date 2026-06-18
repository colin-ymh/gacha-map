import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdminAuth } from "@/lib/supabase/admin";
import { enqueueWishlistNews } from "@/lib/notifications/sendPush";
import type { AdminShopItem } from "@/types";

interface Props {
  params: Promise<{ id: string }>;
}

interface RequestBody {
  status?: "active" | "hidden";
  is_authorized?: boolean;
  disconnect_owner?: boolean;
  opening_hours?: string | null;
}

export async function PATCH(request: NextRequest, { params }: Props) {
  const authResult = await verifyAdminAuth(request);
  if (!authResult.ok) {
    return authResult.response;
  }

  const { id } = await params;

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.status && !["active", "hidden"].includes(body.status)) {
    return NextResponse.json(
      { error: "Invalid status value" },
      { status: 400 },
    );
  }

  const hasValidField =
    body.status ||
    typeof body.is_authorized === "boolean" ||
    body.disconnect_owner === true ||
    "opening_hours" in body;

  if (!hasValidField) {
    return NextResponse.json(
      { error: "At least one valid field must be provided" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  if (body.disconnect_owner) {
    const { data: shopData, error: shopFetchError } = await supabase
      .from("shops")
      .select("owner_id")
      .eq("id", id)
      .single();

    if (shopFetchError || !shopData) {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }

    const ownerId = shopData.owner_id as string | null;

    const { error: shopUpdateError } = await supabase
      .from("shops")
      .update({ owner_id: null })
      .eq("id", id);

    if (shopUpdateError) {
      return NextResponse.json(
        { error: shopUpdateError.message },
        { status: 500 },
      );
    }

    if (ownerId) {
      await supabase
        .from("shop_owner_applications")
        .update({ status: "rejected" })
        .eq("shop_id", id)
        .eq("status", "approved");

      await supabase
        .from("user_profiles")
        .update({ role: "user" })
        .eq("id", ownerId);
    }

    const { data, error } = await supabase
      .from("shops")
      .select(
        "id, name, address, lat, lng, is_authorized, status, created_at, owner_id, hidden_reason, opening_hours",
      )
      .eq("id", id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ shop: data as AdminShopItem });
  }

  const updatePayload: Partial<{
    status: string;
    is_authorized: boolean;
    hidden_reason: "manual" | null;
    opening_hours: string | null;
  }> = {};
  if (body.status) {
    updatePayload.status = body.status;
    if (body.status === "hidden") updatePayload.hidden_reason = "manual";
    else if (body.status === "active") updatePayload.hidden_reason = null;
  }
  if (typeof body.is_authorized === "boolean")
    updatePayload.is_authorized = body.is_authorized;
  if ("opening_hours" in body)
    updatePayload.opening_hours = body.opening_hours ?? null;

  const { data, error } = await supabase
    .from("shops")
    .update(updatePayload)
    .eq("id", id)
    .select(
      "id, name, address, lat, lng, is_authorized, status, created_at, owner_id, hidden_reason, opening_hours",
    )
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Enqueue wishlist_news notification when status changes
  if (body.status && data.status !== body.status) {
    try {
      const statusLabel = body.status === "active" ? "활성화" : "비활성화";
      await enqueueWishlistNews(
        supabase,
        id,
        `매장 상태 변경`,
        `${data.name} 매장이 ${statusLabel}되었습니다.`,
        {
          type: "wishlist_news",
          shop_id: id,
        },
      );
    } catch {
      // notification failure must not affect shop update response
    }
  }

  return NextResponse.json({ shop: data as AdminShopItem });
}
