import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyShopOwnerAuth } from "@/lib/supabase/shop-owner";
import type { ShopGachaProductAvailability } from "@gacha-map/shared";

export const dynamic = "force-dynamic";

const GACHA_PRODUCT_SELECT =
  "id, manufacturer, name, name_ja, name_ko, name_en, price_jpy, release_month, official_image_url, status";

const SGP_INTERNAL_SELECT = `id, shop_id, gacha_product_id, price_krw, availability_status, source, verified_at, verified_by, reported_by, created_at, updated_at, gacha_product:gacha_products(${GACHA_PRODUCT_SELECT})`;

interface Props {
  params: Promise<{ id: string }>;
}

interface PutBody {
  price_krw?: number | null;
  availability_status?: ShopGachaProductAvailability;
}

export async function PUT(request: NextRequest, { params }: Props) {
  const { id: recordId } = await params;
  const authResult = await verifyShopOwnerAuth(request);
  if (!authResult.ok) return authResult.response;

  let body: PutBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { price_krw, availability_status } = body;

  if (
    price_krw !== undefined &&
    price_krw !== null &&
    (typeof price_krw !== "number" || price_krw < 0)
  ) {
    return NextResponse.json(
      { error: "price_krw must be a non-negative number" },
      { status: 400 },
    );
  }

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (price_krw !== undefined) updatePayload.price_krw = price_krw;
  if (availability_status !== undefined)
    updatePayload.availability_status = availability_status;

  if (Object.keys(updatePayload).length === 1) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  // Verify shop ownership
  const { data: shop } = await supabase
    .from("shops")
    .select("id")
    .eq("owner_id", authResult.user.id)
    .maybeSingle();

  if (!shop) {
    return NextResponse.json({ error: "Shop not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("shop_gacha_products")
    .update(updatePayload)
    .eq("id", recordId)
    .eq("shop_id", shop.id)
    .eq("source", "shop_owner")
    .select(SGP_INTERNAL_SELECT)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ product: data });
}

export async function DELETE(request: NextRequest, { params }: Props) {
  const { id: recordId } = await params;
  const authResult = await verifyShopOwnerAuth(request);
  if (!authResult.ok) return authResult.response;

  const supabase = createAdminClient();

  // Verify shop ownership
  const { data: shop } = await supabase
    .from("shops")
    .select("id")
    .eq("owner_id", authResult.user.id)
    .maybeSingle();

  if (!shop) {
    return NextResponse.json({ error: "Shop not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("shop_gacha_products")
    .delete()
    .eq("id", recordId)
    .eq("shop_id", shop.id)
    .eq("source", "shop_owner")
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
