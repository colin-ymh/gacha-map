import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { geocodeKeyword } from "@/lib/kakao/geocodeKeyword";
import type { ShopSummary } from "@/types";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

type ShopWithCount = ShopSummary & {
  candidate_group_id?: number;
};

function filterShops(
  shops: ShopWithCount[],
  q: string | null,
): ShopWithCount[] {
  let filtered = shops;
  if (q) {
    filtered = filtered.filter(
      (shop) =>
        shop.name.toLowerCase().includes(q.toLowerCase()) ||
        (shop.address ?? "").toLowerCase().includes(q.toLowerCase()),
    );
  }
  return filtered;
}

function escapePostgrestPattern(value: string): string {
  return value.replace(/[%_]/g, (match) => `\\${match}`);
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q");
  const swLat = searchParams.get("swLat");
  const swLng = searchParams.get("swLng");
  const neLat = searchParams.get("neLat");
  const neLng = searchParams.get("neLng");
  const sort = searchParams.get("sort") ?? "recommended";
  const userLat = parseFloat(searchParams.get("lat") ?? "");
  const userLng = parseFloat(searchParams.get("lng") ?? "");
  const rawOffset = parseInt(searchParams.get("offset") ?? "0", 10);
  const rawLimit = parseInt(
    searchParams.get("limit") ?? String(DEFAULT_LIMIT),
    10,
  );
  const offset = isNaN(rawOffset) || rawOffset < 0 ? 0 : rawOffset;
  const limit =
    isNaN(rawLimit) || rawLimit < 1
      ? DEFAULT_LIMIT
      : Math.min(rawLimit, MAX_LIMIT);

  if (swLat !== null || swLng !== null || neLat !== null || neLng !== null) {
    const coords = [swLat, swLng, neLat, neLng].map((v) => parseFloat(v ?? ""));
    if (coords.some((v) => isNaN(v))) {
      return NextResponse.json(
        {
          error:
            "Invalid bbox parameters. swLat, swLng, neLat, neLng must all be valid numbers.",
        },
        { status: 400 },
      );
    }
  }

  const supabase = await createClient();
  const getTotal = async (bounds?: {
    swLat: number;
    swLng: number;
    neLat: number;
    neLng: number;
  }) => {
    let countQuery = supabase
      .from("shops")
      .select("id", { count: "exact", head: true })
      .eq("status", "active");

    if (q) {
      const pattern = `%${escapePostgrestPattern(q)}%`;
      countQuery = countQuery.or(
        `name.ilike.${pattern},address.ilike.${pattern}`,
      );
    }

    if (bounds) {
      countQuery = countQuery
        .gte("lat", bounds.swLat)
        .lte("lat", bounds.neLat)
        .gte("lng", bounds.swLng)
        .lte("lng", bounds.neLng);
    }

    return countQuery;
  };

  // recommended sort — composite score RPC
  if (sort === "recommended" && swLat && swLng && neLat && neLng) {
    const bounds = {
      swLat: parseFloat(swLat),
      swLng: parseFloat(swLng),
      neLat: parseFloat(neLat),
      neLng: parseFloat(neLng),
    };
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await supabase.rpc("get_shops_by_score", {
      sw_lat: bounds.swLat,
      sw_lng: bounds.swLng,
      ne_lat: bounds.neLat,
      ne_lng: bounds.neLng,
      p_limit: limit,
      p_offset: offset,
      p_user_id: user?.id ?? null,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const filtered = filterShops((data ?? []) as ShopWithCount[], q);
    const { count, error: countError } = await getTotal(bounds);
    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }
    return NextResponse.json({
      shops: filtered,
      total: count ?? 0,
      offset,
      limit,
    });
  }

  // name sort with bounds — use RPC to include wishlist_count
  if (sort === "name" && swLat && swLng && neLat && neLng) {
    const bounds = {
      swLat: parseFloat(swLat),
      swLng: parseFloat(swLng),
      neLat: parseFloat(neLat),
      neLng: parseFloat(neLng),
    };
    const { data, error } = await supabase.rpc("get_shops_by_name", {
      sw_lat: bounds.swLat,
      sw_lng: bounds.swLng,
      ne_lat: bounds.neLat,
      ne_lng: bounds.neLng,
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const filtered = filterShops((data ?? []) as ShopWithCount[], q);
    const { count, error: countError } = await getTotal(bounds);

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    return NextResponse.json({
      shops: filtered,
      total: count ?? 0,
      offset,
      limit,
    });
  }

  // distance sort — use RPC to include wishlist_count
  if (
    sort === "distance" &&
    swLat &&
    swLng &&
    neLat &&
    neLng &&
    !isNaN(userLat) &&
    !isNaN(userLng)
  ) {
    const bounds = {
      swLat: parseFloat(swLat),
      swLng: parseFloat(swLng),
      neLat: parseFloat(neLat),
      neLng: parseFloat(neLng),
    };
    const { data, error } = await supabase.rpc("get_shops_by_distance", {
      sw_lat: bounds.swLat,
      sw_lng: bounds.swLng,
      ne_lat: bounds.neLat,
      ne_lng: bounds.neLng,
      user_lat: userLat,
      user_lng: userLng,
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const filtered = filterShops((data ?? []) as ShopWithCount[], q);
    const { count, error: countError } = await getTotal(bounds);

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    return NextResponse.json({
      shops: filtered,
      total: count ?? 0,
      offset,
      limit,
    });
  }

  // wishlist_count sort — use RPC
  if (sort === "wishlist_count" && swLat && swLng && neLat && neLng) {
    const bounds = {
      swLat: parseFloat(swLat),
      swLng: parseFloat(swLng),
      neLat: parseFloat(neLat),
      neLng: parseFloat(neLng),
    };
    const { data, error } = await supabase.rpc("get_shops_by_wishlist_count", {
      sw_lat: bounds.swLat,
      sw_lng: bounds.swLng,
      ne_lat: bounds.neLat,
      ne_lng: bounds.neLng,
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const filtered = filterShops((data ?? []) as ShopWithCount[], q);
    const { count, error: countError } = await getTotal(bounds);

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    return NextResponse.json({
      shops: filtered,
      total: count ?? 0,
      offset,
      limit,
    });
  }

  // Fallback: global text search via RPC (includes wishlist_count)
  const { data: textData, error: textError } = await supabase.rpc("search_shops", {
    q: q ?? "",
    sort_by: sort,
    p_limit: limit,
    p_offset: offset,
  });

  if (textError) {
    return NextResponse.json({ error: textError.message }, { status: 500 });
  }

  const textShops = (textData ?? []) as ShopWithCount[];

  if (textShops.length > 0 || !q) {
    const { count, error: countError } = await getTotal();
    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }
    return NextResponse.json({ shops: textShops, total: count ?? 0, offset, limit });
  }

  // 텍스트 결과 0건 → 지역명으로 지오코딩 후 반경 내 샵 조회
  const geocoded = await geocodeKeyword(q);

  if (!geocoded) {
    return NextResponse.json({ shops: [], total: 0, offset, limit });
  }

  // ~2km bounding box (한국 위도 37° 기준: 1°lat≈111km, 1°lng≈89km)
  const DELTA_LAT = 0.018;
  const DELTA_LNG = 0.022;
  const regionBounds = {
    swLat: geocoded.lat - DELTA_LAT,
    swLng: geocoded.lng - DELTA_LNG,
    neLat: geocoded.lat + DELTA_LAT,
    neLng: geocoded.lng + DELTA_LNG,
  };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch a larger pool so reranking covers beyond the first page
  const FALLBACK_POOL = Math.min(MAX_LIMIT, 100);
  const { data: regionData, error: regionError } = await supabase.rpc("get_shops_by_score", {
    sw_lat: regionBounds.swLat,
    sw_lng: regionBounds.swLng,
    ne_lat: regionBounds.neLat,
    ne_lng: regionBounds.neLng,
    p_limit: FALLBACK_POOL,
    p_offset: 0,
    p_user_id: user?.id ?? null,
  });

  if (regionError) {
    return NextResponse.json({ shops: [], total: 0, offset, limit });
  }

  const { count: regionCount } = await getTotal(regionBounds);

  const shops = (regionData ?? []) as ShopWithCount[];
  const tokens = (q ?? "").split(/\s+/).filter(Boolean);

  let rankedShops: ShopWithCount[];
  if (tokens.length > 0 && shops.length > 0) {
    // Precompute IDF weights once — keywords rare in the result set rank higher
    const idfWeights = new Map(
      tokens.map((kw) => {
        const matchCount = shops.filter((s) =>
          s.name.toLowerCase().includes(kw.toLowerCase()),
        ).length;
        return [kw, matchCount > 0 ? shops.length / matchCount : 0];
      }),
    );
    rankedShops = shops
      .map((shop) => ({
        shop,
        relevance: tokens.reduce((score, kw) => {
          if (!shop.name.toLowerCase().includes(kw.toLowerCase())) return score;
          return score + (idfWeights.get(kw) ?? 0);
        }, 0),
      }))
      .sort((a, b) => b.relevance - a.relevance)
      .map((r) => r.shop);
  } else {
    rankedShops = shops;
  }

  return NextResponse.json({
    shops: rankedShops.slice(offset, offset + limit),
    total: regionCount ?? 0,
    offset,
    limit,
  });
}
