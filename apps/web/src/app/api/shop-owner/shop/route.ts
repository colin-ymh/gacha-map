import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyShopOwnerAuth } from "@/lib/supabase/shop-owner";
import type { ShopOwnerShop } from "@/types";

const SHOP_SELECT =
  "id, name, address, lat, lng, description, phone, opening_hours, tags, image_urls, image_thumbnails, is_authorized, status, owner_id, created_at, updated_at";

export async function GET(request: NextRequest) {
  const authResult = await verifyShopOwnerAuth(request);
  if (!authResult.ok) return authResult.response;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("shops")
    .select(SHOP_SELECT)
    .eq("owner_id", authResult.user.id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ shop: data as ShopOwnerShop });
}

interface PatchBody {
  name?: string;
  description?: string | null;
  phone?: string | null;
  opening_hours?: string | null;
  image_urls?: string[];
  image_thumbnails?: string[];
}

export async function PATCH(request: NextRequest) {
  const authResult = await verifyShopOwnerAuth(request);
  if (!authResult.ok) return authResult.response;

  let body: PatchBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const updatePayload: Partial<PatchBody> = {};

  if (body.name !== undefined) {
    if (!body.name || body.name.trim().length === 0) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (body.name.length > 100) {
      return NextResponse.json(
        { error: "Name must be 100 characters or less" },
        { status: 400 },
      );
    }
    updatePayload.name = body.name.trim();
  }
  if (body.description !== undefined)
    updatePayload.description = body.description;
  if (body.phone !== undefined) updatePayload.phone = body.phone;
  if (body.opening_hours !== undefined)
    updatePayload.opening_hours = body.opening_hours;
  if (body.image_urls !== undefined) updatePayload.image_urls = body.image_urls;
  if (body.image_thumbnails !== undefined)
    updatePayload.image_thumbnails = body.image_thumbnails;

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("shops")
    .update(updatePayload)
    .eq("owner_id", authResult.user.id)
    .select(SHOP_SELECT)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ shop: data as ShopOwnerShop });
}
