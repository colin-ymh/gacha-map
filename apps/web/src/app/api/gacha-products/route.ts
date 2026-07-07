import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { GachaProduct, GachaProductWithShops } from "@/types";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 20;

function parsePagination(searchParams: URLSearchParams) {
  const rawOffset = parseInt(searchParams.get("offset") ?? "0", 10);
  const rawLimit = parseInt(
    searchParams.get("limit") ?? String(DEFAULT_LIMIT),
    10,
  );

  const offset = isNaN(rawOffset) || rawOffset < 0 ? 0 : rawOffset;
  const limit = isNaN(rawLimit) ? DEFAULT_LIMIT : Math.min(rawLimit, 100);

  return { offset, limit };
}

function toPostgrestSearchTerm(value: string) {
  return value.trim().replace(/[%,()]/g, "");
}

function withDisplayName(product: Omit<GachaProduct, "display_name">) {
  return {
    ...product,
    display_name: product.name_ko ?? product.name_ja ?? product.name,
  };
}

async function fetchShopStatsForProducts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  productIds: string[],
): Promise<
  Map<string, { available_shop_count: number; min_price_krw: number | null }>
> {
  if (productIds.length === 0) {
    return new Map();
  }

  // Fetch all shop_gacha_products for these products
  const { data: shopGachaProducts, error } = await supabase
    .from("shop_gacha_products")
    .select(
      `
      gacha_product_id,
      price_krw,
      availability_status,
      shops(status)
      `,
    )
    .in("gacha_product_id", productIds)
    .eq("availability_status", "available");

  if (error) {
    throw new Error(`Failed to fetch shop stats: ${error.message}`);
  }

  // Aggregate by product_id
  const stats = new Map<
    string,
    { available_shop_count: number; min_price_krw: number | null }
  >();

  for (const productId of productIds) {
    stats.set(productId, { available_shop_count: 0, min_price_krw: null });
  }

  for (const row of shopGachaProducts || []) {
    const shopData = row.shops as unknown as { status: string } | null;
    if (!shopData || shopData.status !== "active") {
      continue; // Skip if shop is not active
    }

    const productId = row.gacha_product_id;
    const current = stats.get(productId) || {
      available_shop_count: 0,
      min_price_krw: null,
    };

    // Increment shop count
    current.available_shop_count = (current.available_shop_count || 0) + 1;

    // Update min price
    if (row.price_krw !== null && row.price_krw !== undefined) {
      if (current.min_price_krw === null) {
        current.min_price_krw = row.price_krw;
      } else {
        current.min_price_krw = Math.min(current.min_price_krw, row.price_krw);
      }
    }

    stats.set(productId, current);
  }

  return stats;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q");
  const manufacturer = searchParams.get("manufacturer");
  const includeShops = searchParams.get("include_shops") === "true";
  const hasVariants = searchParams.get("has_variants") === "true";
  const sortFeatured = searchParams.get("sort") === "featured";
  const { offset, limit } = parsePagination(searchParams);

  const supabase = await createClient();

  let query = supabase
    .from("gacha_products")
    .select(
      [
        "id",
        "manufacturer",
        "name",
        "name_ja",
        "name_ko",
        "name_en",
        "jan_code",
        "product_code",
        "price_jpy",
        "release_month",
        "release_week_text",
        "types_count",
        "official_image_url",
        "source_url",
        "source_type",
        "status",
        "created_at",
        "updated_at",
        "last_seen_at",
        "name_parts",
      ].join(", "),
      { count: "exact" },
    )
    .eq("status", "active")
    .order("release_month", { ascending: false, nullsFirst: false })
    .order("name", { ascending: true });

  if (manufacturer) {
    query = query.eq("manufacturer", manufacturer);
  }

  if (hasVariants) {
    const { data: variantRows } = await supabase
      .from("gacha_product_variants")
      .select("product_id")
      .eq("status", "active");
    const productIdsWithVariants = [
      ...new Set((variantRows ?? []).map((r) => r.product_id as string)),
    ];
    if (productIdsWithVariants.length === 0) {
      return NextResponse.json({ products: [], total: 0, offset, limit });
    }
    query = query
      .in("id", productIdsWithVariants)
      .not("official_image_url", "is", null);
  }

  if (sortFeatured) {
    query = query.order("types_count", { ascending: false });
  }

  // When q is present, use the search_gacha_products RPC (includes tag search).
  if (q) {
    const term = toPostgrestSearchTerm(q);
    if (term) {
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "search_gacha_products",
        {
          q: term,
          p_manufacturer: manufacturer ?? null,
          p_limit: limit,
          p_offset: offset,
        },
      );
      if (rpcError) {
        return NextResponse.json({ error: rpcError.message }, { status: 500 });
      }
      const products = (
        (rpcData ?? []) as unknown as Array<Omit<GachaProduct, "display_name">>
      ).map(withDisplayName);
      const total = (rpcData as { total_count?: number }[])?.[0]?.total_count ?? 0;

      let shopStats: Map<
        string,
        { available_shop_count: number; min_price_krw: number | null }
      > = new Map();
      if (includeShops) {
        try {
          shopStats = await fetchShopStatsForProducts(
            supabase,
            products.map((p) => p.id),
          );
        } catch (err) {
          return NextResponse.json(
            {
              error: `Failed to fetch shop statistics: ${err instanceof Error ? err.message : String(err)}`,
            },
            { status: 500 },
          );
        }
      }

      const responseProducts = includeShops
        ? products.map((p) => {
            const stats = shopStats.get(p.id) || {
              available_shop_count: 0,
              min_price_krw: null,
            };
            return {
              ...p,
              available_shop_count: stats.available_shop_count,
              min_price_krw: stats.min_price_krw,
            } as GachaProductWithShops;
          })
        : products;

      return NextResponse.json({
        products: responseProducts,
        total,
        offset,
        limit,
      });
    }
  }

  const fetchRange = sortFeatured ? 50 : limit;
  const { data, error, count } = await query.range(sortFeatured ? 0 : offset, (sortFeatured ? 0 : offset) + fetchRange - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let products = (
    (data ?? []) as unknown as Array<Omit<GachaProduct, "display_name">>
  ).map(withDisplayName);

  if (sortFeatured) {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    let seed = parseInt(today, 10);
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) & 0xffffffff;
      return (seed >>> 0) / 0x100000000;
    };
    for (let i = products.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [products[i], products[j]] = [products[j], products[i]];
    }
    products = products.slice(0, limit);
  }

  // If include_shops is requested, fetch shop stats for each product
  let shopStats: Map<
    string,
    { available_shop_count: number; min_price_krw: number | null }
  > = new Map();
  if (includeShops) {
    try {
      shopStats = await fetchShopStatsForProducts(
        supabase,
        products.map((p) => p.id),
      );
    } catch (err) {
      return NextResponse.json(
        {
          error: `Failed to fetch shop statistics: ${err instanceof Error ? err.message : String(err)}`,
        },
        { status: 500 },
      );
    }
  }

  const responseProducts = includeShops
    ? products.map((p) => {
        const stats = shopStats.get(p.id) || {
          available_shop_count: 0,
          min_price_krw: null,
        };
        return {
          ...p,
          available_shop_count: stats.available_shop_count,
          min_price_krw: stats.min_price_krw,
        } as GachaProductWithShops;
      })
    : products;

  return NextResponse.json({
    products: responseProducts,
    total: count ?? 0,
    offset,
    limit,
  });
}
