import { NextRequest, NextResponse } from "next/server";
import {
  createAdminClient,
  createAuthenticatedClient,
} from "@/lib/supabase/server";
import {
  tryLogBadgeCount,
  checkAndAwardBadge,
  checkAnomalies,
} from "@/lib/badges";
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

  let newBadge: { id: string; name: string; icon_url: string } | null = null;
  try {
    const counted = await tryLogBadgeCount(
      supabase,
      user.id,
      shopId,
      "wishlist",
    );
    if (counted) {
      const badge = await checkAndAwardBadge(supabase, user.id, "wishlist");
      if (badge)
        newBadge = {
          id: badge.userBadgeId,
          name: badge.name,
          icon_url: badge.icon_url,
        };
      await checkAnomalies(supabase, user.id, "wishlist");
    }
  } catch {
    // badge failure must not affect wishlist response
  }

  return NextResponse.json(
    { wished: true, new_badge: newBadge },
    { status: 201 },
  );
}
