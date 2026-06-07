import { NextRequest, NextResponse } from "next/server";
import {
  createAdminClient,
  createAuthenticatedClient,
} from "@/lib/supabase/server";
import type { ShopSummary } from "@/types";

export async function GET(request: NextRequest) {
  const { supabase, user } = await createAuthenticatedClient(request);
  const adminClient = createAdminClient();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("wishlists")
    .select("shop_id, shops(id, name, address, lat, lng, is_authorized)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const shops = (data ?? []).flatMap((w) => {
    if (!w.shops) return [];
    return Array.isArray(w.shops) ? w.shops : [w.shops];
  }) as ShopSummary[];
  const shopIds = shops.map((shop) => shop.id);
  const { data: wishlistRows, error: countError } =
    shopIds.length > 0
      ? await adminClient
          .from("wishlists")
          .select("shop_id")
          .in("shop_id", shopIds)
      : { data: [], error: null };

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  const countByShopId = new Map<string, number>();
  (wishlistRows ?? []).forEach((row) => {
    countByShopId.set(row.shop_id, (countByShopId.get(row.shop_id) ?? 0) + 1);
  });

  return NextResponse.json({
    shops: shops.map((shop) => ({
      ...shop,
      wishlist_count: countByShopId.get(shop.id) ?? 0,
    })),
  });
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await createAuthenticatedClient(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { shopId } = body as { shopId?: string };

  if (!shopId) {
    return NextResponse.json({ error: "shopId is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("wishlists")
    .insert({ user_id: user.id, shop_id: shopId });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Already wishlisted" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
