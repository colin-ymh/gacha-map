import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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
  const sort = searchParams.get("sort") ?? "name";
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

  // Fallback: global search via RPC (includes wishlist_count)
  const { data, error } = await supabase.rpc("search_shops", {
    q: q ?? "",
    sort_by: sort,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const filtered = (data ?? []) as ShopWithCount[];
  const { count, error: countError } = await getTotal();

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
