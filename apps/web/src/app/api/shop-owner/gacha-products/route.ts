import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyShopOwnerAuth } from "@/lib/supabase/shop-owner";
import type { ShopGachaProductAvailability } from "@gacha-map/shared";

export const dynamic = "force-dynamic";

const GACHA_PRODUCT_SELECT =
  "id, manufacturer, name, name_ja, name_ko, name_en, price_jpy, release_month, official_image_url, status";

const SGP_INTERNAL_SELECT = `id, shop_id, gacha_product_id, price_krw, availability_status, source, verified_at, verified_by, reported_by, created_at, updated_at, gacha_product:gacha_products(${GACHA_PRODUCT_SELECT})`;

async function getOwnerShopId(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("shops")
    .select("id")
    .eq("owner_id", userId)
    .maybeSingle();
  return data?.id ?? null;
}

export async function GET(request: NextRequest) {
  const authResult = await verifyShopOwnerAuth(request);
  if (!authResult.ok) return authResult.response;

  const supabase = createAdminClient();
  const shopId = await getOwnerShopId(supabase, authResult.user.id);

  if (!shopId) {
    return NextResponse.json({ error: "Shop not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("shop_gacha_products")
    .select(SGP_INTERNAL_SELECT)
    .eq("shop_id", shopId)
    .eq("source", "shop_owner")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ products: data ?? [] });
}

interface PostBody {
  gacha_product_id: string;
  price_krw?: number;
  availability_status?: ShopGachaProductAvailability;
}

export async function POST(request: NextRequest) {
  const authResult = await verifyShopOwnerAuth(request);
  if (!authResult.ok) return authResult.response;

  let body: PostBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { gacha_product_id, price_krw, availability_status } = body;

  if (!gacha_product_id || typeof gacha_product_id !== "string") {
    return NextResponse.json(
      { error: "gacha_product_id is required" },
      { status: 400 },
    );
  }

  if (
    price_krw !== undefined &&
    (typeof price_krw !== "number" || price_krw < 0)
  ) {
    return NextResponse.json(
      { error: "price_krw must be a non-negative number" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const shopId = await getOwnerShopId(supabase, authResult.user.id);

  if (!shopId) {
    return NextResponse.json({ error: "Shop not found" }, { status: 404 });
  }

  // Verify gacha_product exists and is active
  const { data: product } = await supabase
    .from("gacha_products")
    .select("id")
    .eq("id", gacha_product_id)
    .eq("status", "active")
    .maybeSingle();

  if (!product) {
    return NextResponse.json(
      { error: "Gacha product not found or inactive" },
      { status: 404 },
    );
  }

  // Explicit upsert: SELECT → UPDATE or INSERT
  const { data: existing } = await supabase
    .from("shop_gacha_products")
    .select("id")
    .eq("shop_id", shopId)
    .eq("gacha_product_id", gacha_product_id)
    .eq("source", "shop_owner")
    .maybeSingle();

  let record;

  if (existing) {
    const { data, error } = await supabase
      .from("shop_gacha_products")
      .update({
        price_krw: price_krw ?? null,
        availability_status: availability_status ?? "available",
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select(SGP_INTERNAL_SELECT)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    record = data;
  } else {
    const { data, error } = await supabase
      .from("shop_gacha_products")
      .insert({
        shop_id: shopId,
        gacha_product_id,
        price_krw: price_krw ?? null,
        availability_status: availability_status ?? "available",
        source: "shop_owner",
        reported_by: authResult.user.id,
      })
      .select(SGP_INTERNAL_SELECT)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    record = data;
  }

  return NextResponse.json(
    { product: record },
    { status: existing ? 200 : 201 },
  );
}
