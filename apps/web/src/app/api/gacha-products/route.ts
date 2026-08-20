import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { GachaProduct, GachaProductWithShops } from "@/types";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 20;

// search_gacha_products 의 trigram 유사도 임계값.
// 낮출수록 오타를 더 관대하게 잡지만 무관한 결과가 섞인다.
// RPC 파라미터라 여기서만 바꾸면 되고 DB 재배포는 필요 없다.
const SEARCH_MIN_SIMILARITY = 0.4;

/** 검색어가 어떤 별칭으로 확장됐는지. 예: 먼작귀 → 치이카와 / ちいかわ */
type AppliedAlias = {
  alias: string;
  canonical_terms: string[];
};

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
  const sortNewArrivals = searchParams.get("sort") === "new_arrivals";
  const { offset, limit } = parsePagination(searchParams);

  const supabase = await createClient();

  if (sortNewArrivals) {
    // "신상 가챠": products whose collector-normalized featured_week_start
    // (see 20260721_add_gacha_product_release_schedule.sql) matches this
    // KST week. See get_new_arrival_gacha() migration — it already excludes
    // image-less products, products without an active variant, and
    // anything already picked by today's 오늘의 가챠. Per-product release
    // label text is derived client-side from release_precision +
    // release_start_date (kept as raw fields here, not pre-rendered, so the
    // mobile app can localize it).
    const NEW_ARRIVAL_COUNT = 15;
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "get_new_arrival_gacha",
      { p_count: NEW_ARRIVAL_COUNT },
    );
    if (rpcError) {
      return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }
    const products = (
      (rpcData ?? []) as unknown as Array<Omit<GachaProduct, "display_name">>
    ).map(withDisplayName);

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
      total: responseProducts.length,
      offset: 0,
      limit: NEW_ARRIVAL_COUNT,
    });
  }

  if (sortFeatured) {
    // "오늘의 가챠": server-persisted daily pick, identical for every
    // caller on the same day. See get_daily_featured_gacha() migration —
    // it already excludes image-less products and deprioritizes items
    // featured within the last 7 days.
    const FEATURED_COUNT = 10;
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "get_daily_featured_gacha",
      { p_count: FEATURED_COUNT },
    );
    if (rpcError) {
      return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }
    const products = (
      (rpcData ?? []) as unknown as Array<Omit<GachaProduct, "display_name">>
    ).map(withDisplayName);

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
      total: responseProducts.length,
      offset: 0,
      limit: FEATURED_COUNT,
    });
  }

  // 검색어가 있으면 search_gacha_products RPC 를 쓴다.
  // (별칭 확장 + 토큰 AND + trigram 유사도 + 변형(상세) 상품명까지 RPC 안에서 처리)
  //
  // 이 분기는 아래 PostgREST 쿼리 구성보다 먼저 와야 한다. 예전에는 뒤에 있었고
  // hasVariants 필터가 PostgREST 쪽에만 적용돼서, has_variants=true 와 q 를 함께
  // 보내면(모바일 홈의 가챠 핀 검색) 변형 필터가 통째로 무시됐다.
  if (q?.trim()) {
    // 정규화와 LIKE 이스케이프는 전부 SQL 함수(gacha_normalize_search_text)가 한다.
    // 여기서 문자를 지우면 오히려 정규화 규칙이 이중으로 적용된다.
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "search_gacha_products",
      {
        q,
        p_manufacturer: manufacturer ?? null,
        p_limit: limit,
        p_offset: offset,
        p_fuzzy: true,
        p_min_similarity: SEARCH_MIN_SIMILARITY,
        p_has_variants: hasVariants,
      },
    );
    if (rpcError) {
      return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }

    const rpcRows = (rpcData ?? []) as unknown as Array<
      Omit<GachaProduct, "display_name"> & {
        total_count?: number;
        matched_aliases?: AppliedAlias[];
      }
    >;

    // has_variants 는 "변형 보유 + 대표 이미지 있음" 을 뜻한다(핀 검색용).
    // RPC 는 변형 보유 여부만 판정하므로 이미지 조건은 여기서 맞춘다.
    const filteredRows = hasVariants
      ? rpcRows.filter((row) => row.official_image_url != null)
      : rpcRows;

    const products = filteredRows.map(withDisplayName);
    const rpcTotal = rpcRows[0]?.total_count ?? 0;
    const total = hasVariants
      ? rpcTotal - (rpcRows.length - filteredRows.length)
      : rpcTotal;
    const appliedAliases = rpcRows[0]?.matched_aliases ?? [];

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
      // 어떤 별칭이 적용됐는지. 모든 행에 같은 값이 실려 오므로 최상위로 끌어올린다.
      applied_aliases: appliedAliases,
    });
  }

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

  const { data, error, count } = await query.range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const products = (
    (data ?? []) as unknown as Array<Omit<GachaProduct, "display_name">>
  ).map(withDisplayName);

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
