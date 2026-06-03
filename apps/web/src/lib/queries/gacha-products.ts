import { createClient } from "@/lib/supabase/server";
import type { GachaProduct, GachaProductWithShops } from "@/types";

const DEFAULT_LIMIT = 20;

export function toPostgrestSearchTerm(value: string) {
  return value.trim().replace(/[%,()]/g, "");
}

export async function fetchShopStatsForProducts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  productIds: string[],
): Promise<
  Map<string, { available_shop_count: number; min_price_krw: number | null }>
> {
  if (productIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("shop_gacha_products")
    .select("gacha_product_id, price_krw, availability_status, shops(status)")
    .in("gacha_product_id", productIds)
    .eq("availability_status", "available");

  if (error) throw new Error(`Failed to fetch shop stats: ${error.message}`);

  const stats = new Map<
    string,
    { available_shop_count: number; min_price_krw: number | null }
  >();
  for (const id of productIds)
    stats.set(id, { available_shop_count: 0, min_price_krw: null });

  for (const row of data ?? []) {
    const shop = row.shops as unknown as { status: string } | null;
    if (!shop || shop.status !== "active") continue;

    const cur = stats.get(row.gacha_product_id)!;
    cur.available_shop_count += 1;
    if (row.price_krw != null) {
      cur.min_price_krw =
        cur.min_price_krw === null
          ? row.price_krw
          : Math.min(cur.min_price_krw, row.price_krw);
    }
  }

  return stats;
}

export interface SearchGachaProductsOptions {
  q?: string;
  manufacturer?: string;
  offset?: number;
  limit?: number;
  includeShops?: boolean;
}

export async function searchGachaProducts({
  q,
  manufacturer,
  offset = 0,
  limit = DEFAULT_LIMIT,
  includeShops = false,
}: SearchGachaProductsOptions): Promise<{
  products: (GachaProduct | GachaProductWithShops)[];
  total: number;
}> {
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
        "price_jpy",
        "release_month",
        "official_image_url",
        "status",
      ].join(", "),
      { count: "exact" },
    )
    .eq("status", "active")
    .order("release_month", { ascending: false, nullsFirst: false })
    .order("name", { ascending: true });

  if (manufacturer) query = query.eq("manufacturer", manufacturer);

  if (q) {
    const term = toPostgrestSearchTerm(q);
    if (term) {
      query = query.or(
        [
          `name.ilike.%${term}%`,
          `name_ja.ilike.%${term}%`,
          `name_ko.ilike.%${term}%`,
          `name_en.ilike.%${term}%`,
        ].join(","),
      );
    }
  }

  const { data, error, count } = await query.range(offset, offset + limit - 1);

  if (error) throw new Error(error.message);

  const products = (data ?? []) as unknown as GachaProduct[];

  if (!includeShops) {
    return { products, total: count ?? 0 };
  }

  const stats = await fetchShopStatsForProducts(
    supabase,
    products.map((p) => p.id),
  );

  const withShops: GachaProductWithShops[] = products.map((p) => ({
    ...p,
    available_shop_count: stats.get(p.id)?.available_shop_count ?? 0,
    min_price_krw: stats.get(p.id)?.min_price_krw ?? null,
  }));

  return { products: withShops, total: count ?? 0 };
}
