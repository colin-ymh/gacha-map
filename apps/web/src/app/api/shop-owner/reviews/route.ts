import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyShopOwnerAuth } from "@/lib/supabase/shop-owner";

const PAGE_SIZE = 20;

export async function GET(request: NextRequest) {
  const authResult = await verifyShopOwnerAuth(request);
  if (!authResult.ok) return authResult.response;

  const { searchParams } = new URL(request.url);
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10));
  const limit = Math.min(
    50,
    Math.max(1, parseInt(searchParams.get("limit") ?? String(PAGE_SIZE), 10)),
  );

  const supabase = createAdminClient();

  const { data: shop, error: shopError } = await supabase
    .from("shops")
    .select("id")
    .eq("owner_id", authResult.user.id)
    .single();

  if (shopError) {
    if (shopError.code === "PGRST116") {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }
    return NextResponse.json({ error: shopError.message }, { status: 500 });
  }

  const { data, error, count } = await supabase
    .from("reviews")
    .select(
      "id, shop_id, user_id, content, image_urls, created_at, updated_at, user_profiles!reviews_user_id_fkey(nickname, avatar_url)",
      { count: "exact" },
    )
    .eq("shop_id", shop.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    reviews: data,
    total: count ?? 0,
    offset,
    limit,
  });
}
