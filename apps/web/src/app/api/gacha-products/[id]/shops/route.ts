import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { GachaShopEntry } from "@/types";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function parsePagination(searchParams: URLSearchParams) {
  const rawOffset = parseInt(searchParams.get("offset") ?? "0", 10);
  const rawLimit = parseInt(
    searchParams.get("limit") ?? String(DEFAULT_LIMIT),
    10,
  );

  const offset = isNaN(rawOffset) || rawOffset < 0 ? 0 : rawOffset;
  const limit = isNaN(rawLimit) ? DEFAULT_LIMIT : Math.min(rawLimit, MAX_LIMIT);

  return { offset, limit };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: productId } = await params;
  const { searchParams } = request.nextUrl;
  const { offset, limit } = parsePagination(searchParams);

  const supabase = await createClient();

  const {
    data: shopGachaProducts,
    error: queryError,
    count,
  } = await supabase
    .from("shop_gacha_products")
    .select(
      `
      shop_id,
      price_krw,
      availability_status,
      shops!inner(id, name, address)
      `,
      { count: "exact" },
    )
    .eq("gacha_product_id", productId)
    .in("availability_status", ["available", "seen"])
    .eq("shops.status", "active")
    .order("price_krw", { ascending: true, nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (queryError) {
    return NextResponse.json({ error: queryError.message }, { status: 500 });
  }

  const shops: GachaShopEntry[] = (shopGachaProducts || []).map((row) => {
    const shop = row.shops as unknown as {
      id: string;
      name: string;
      address: string | null;
    } | null;

    return {
      shop_id: row.shop_id,
      shop_name: shop?.name ?? "",
      address: shop?.address ?? null,
      image_url: null,
      price_krw: row.price_krw,
      availability_status: row.availability_status as GachaShopEntry["availability_status"],
    };
  });

  return NextResponse.json({
    shops,
    total: count ?? 0,
    offset,
    limit,
  });
}
