import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdminAuth } from "@/lib/supabase/admin";
import type { AdminReportItem, AdminShopItem } from "@/types";

interface Props {
  params: Promise<{ id: string }>;
}

interface ApproveNewRequest {
  mode: "new";
}

interface ApproveLinkRequest {
  mode: "link";
  shopId: string;
}

type RequestBody = ApproveNewRequest | ApproveLinkRequest;

export async function POST(request: NextRequest, { params }: Props) {
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

  // Validate mode
  if (!["new", "link"].includes(body.mode)) {
    return NextResponse.json(
      { error: "Invalid mode. Must be 'new' or 'link'" },
      { status: 400 },
    );
  }

  // Validate mode-specific fields
  if (body.mode === "link") {
    const linkBody = body as ApproveLinkRequest;
    if (!linkBody.shopId) {
      return NextResponse.json(
        { error: "shopId is required when mode is 'link'" },
        { status: 400 },
      );
    }
  }

  const supabase = createAdminClient();

  // Fetch the temporal shop
  const { data: temporalShop, error: fetchError } = await supabase
    .from("temporal_shops")
    .select(
      "id, name, address, lat, lng, description, tags, image_urls, shop_id, submitter_name, submitter_contact, status, admin_note, created_at",
    )
    .eq("id", id)
    .single();

  if (fetchError || !temporalShop) {
    if (fetchError?.code === "PGRST116") {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: fetchError?.message ?? "Unknown error" },
      { status: 500 },
    );
  }

  let shopData: AdminShopItem | null = null;

  if (body.mode === "new") {
    // Create new shop from temporal shop data
    const { data: newShop, error: createError } = await supabase
      .from("shops")
      .insert({
        name: temporalShop.name,
        address: temporalShop.address,
        lat: temporalShop.lat,
        lng: temporalShop.lng,
        description: temporalShop.description,
        tags: temporalShop.tags,
        image_urls: temporalShop.image_urls,
        is_authorized: false,
        status: "active",
      })
      .select(
        "id, name, address, lat, lng, tags, is_authorized, status, created_at",
      )
      .single();

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    shopData = newShop as AdminShopItem;

    // Update temporal shop to approved
    await supabase
      .from("temporal_shops")
      .update({
        status: "approved",
      })
      .eq("id", id);
  } else if (body.mode === "link") {
    // Link to existing shop and authorize it
    const linkBody = body as ApproveLinkRequest;
    const { shopId } = linkBody;

    // Verify the shop exists
    const { data: existingShop, error: shopCheckError } = await supabase
      .from("shops")
      .select(
        "id, name, address, lat, lng, tags, is_authorized, status, created_at",
      )
      .eq("id", shopId)
      .single();

    if (shopCheckError || !existingShop) {
      return NextResponse.json(
        { error: "Target shop not found" },
        { status: 404 },
      );
    }

    // Update the shop to mark as authorized
    const { data: updatedShop, error: updateError } = await supabase
      .from("shops")
      .update({ is_authorized: true })
      .eq("id", shopId)
      .select(
        "id, name, address, lat, lng, tags, is_authorized, status, created_at",
      )
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    shopData = updatedShop as AdminShopItem;

    // Update temporal shop with shop_id and status
    await supabase
      .from("temporal_shops")
      .update({
        shop_id: shopId,
        status: "approved",
      })
      .eq("id", id);
  }

  // Fetch updated temporal shop to return
  const { data: updatedReport } = await supabase
    .from("temporal_shops")
    .select(
      "id, name, address, lat, lng, description, tags, shop_id, submitter_name, submitter_contact, status, admin_note, created_at",
    )
    .eq("id", id)
    .single();

  const report: AdminReportItem = updatedReport as AdminReportItem;

  return NextResponse.json({
    report,
    shop: shopData,
  });
}
