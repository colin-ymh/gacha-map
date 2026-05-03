import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdminAuth } from "@/lib/supabase/admin";
import type { AdminShopItem } from "@/types";

interface Props {
  params: Promise<{ id: string }>;
}

interface RequestBody {
  status?: "active" | "hidden";
  is_authorized?: boolean;
}

export async function PATCH(request: NextRequest, { params }: Props) {
  // Verify admin authentication
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

  // Validate request body
  if (body.status && !["active", "hidden"].includes(body.status)) {
    return NextResponse.json(
      { error: "Invalid status value" },
      { status: 400 },
    );
  }

  if (typeof body.is_authorized === "boolean" || body.status) {
    // At least one field should be provided
  } else {
    return NextResponse.json(
      { error: "At least one of status or is_authorized must be provided" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  // Build update payload
  const updatePayload: Partial<RequestBody> = {};
  if (body.status) {
    updatePayload.status = body.status;
  }
  if (typeof body.is_authorized === "boolean") {
    updatePayload.is_authorized = body.is_authorized;
  }

  // Update the shop
  const { data, error } = await supabase
    .from("shops")
    .update(updatePayload)
    .eq("id", id)
    .select(
      "id, name, address, lat, lng, tags, is_authorized, status, created_at",
    )
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const shop: AdminShopItem = data as AdminShopItem;

  return NextResponse.json({ shop });
}
