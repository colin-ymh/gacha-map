import { NextRequest, NextResponse } from "next/server";
import {
  createAdminClient,
  createAuthenticatedClient,
} from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { supabase, user } = await createAuthenticatedClient(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("product_wishlists")
    .select(
      "product_id, gacha_product:gacha_products(id, name, name_ko, official_image_url, manufacturer, price_jpy, release_month, status)",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const productIds = (data ?? []).map((w) => w.product_id);

  const adminClient = createAdminClient();
  const { data: shopRows, error: shopError } =
    productIds.length > 0
      ? await adminClient
          .from("shop_gacha_products")
          .select("gacha_product_id")
          .in("gacha_product_id", productIds)
          .eq("availability_status", "available")
      : { data: [], error: null };

  if (shopError) {
    return NextResponse.json({ error: shopError.message }, { status: 500 });
  }

  const availableCountByProductId = new Map<string, number>();
  (shopRows ?? []).forEach((row) => {
    availableCountByProductId.set(
      row.gacha_product_id,
      (availableCountByProductId.get(row.gacha_product_id) ?? 0) + 1,
    );
  });

  const products = (data ?? []).flatMap((w) => {
    if (!w.gacha_product) return [];
    const gp = Array.isArray(w.gacha_product)
      ? w.gacha_product[0]
      : w.gacha_product;
    if (!gp) return [];
    return [
      {
        ...gp,
        available_shop_count: availableCountByProductId.get(w.product_id) ?? 0,
      },
    ];
  });

  return NextResponse.json({ products });
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await createAuthenticatedClient(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { productId } = body as { productId?: string };

  if (!productId) {
    return NextResponse.json(
      { error: "productId is required" },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("product_wishlists")
    .insert({ user_id: user.id, product_id: productId });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Already wishlisted" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ wished: true }, { status: 201 });
}
