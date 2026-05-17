import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { tileRangeToBounds } from "@gacha-map/shared";
import type { ShopSummary } from "@/types";

const DEFAULT_LIMIT = 20;

type ShopWithCount = ShopSummary & {
  place_id?: string;
  candidate_group_id?: number;
};

function filterShops(
  shops: ShopWithCount[],
  q: string | null,
  tag: string | null,
): ShopWithCount[] {
  let filtered = shops;
  if (q) {
    filtered = filtered.filter(
      (shop) =>
        shop.name.toLowerCase().includes(q.toLowerCase()) ||
        (shop.address ?? "").toLowerCase().includes(q.toLowerCase()),
    );
  }
  if (tag) {
    filtered = filtered.filter((shop) => (shop.tags ?? []).includes(tag));
  }
  return filtered;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q");
  const tag = searchParams.get("tag");
  const sort = searchParams.get("sort") ?? "name";
  const userLat = parseFloat(searchParams.get("lat") ?? "");
  const userLng = parseFloat(searchParams.get("lng") ?? "");
  const rawOffset = parseInt(searchParams.get("offset") ?? "0", 10);
  const rawLimit = parseInt(
    searchParams.get("limit") ?? String(DEFAULT_LIMIT),
    10,
  );
  const offset = isNaN(rawOffset) || rawOffset < 0 ? 0 : rawOffset;
  const limit = isNaN(rawLimit) ? DEFAULT_LIMIT : Math.min(rawLimit, 100);

  // 타일 파라미터 → bounds 변환 (모바일 신규 방식)
  const tileMinX = searchParams.get("tileMinX");
  const tileMinY = searchParams.get("tileMinY");
  const tileMaxX = searchParams.get("tileMaxX");
  const tileMaxY = searchParams.get("tileMaxY");
  const tileZoom = searchParams.get("tileZoom");

  let swLat: string | null = searchParams.get("swLat");
  let swLng: string | null = searchParams.get("swLng");
  let neLat: string | null = searchParams.get("neLat");
  let neLng: string | null = searchParams.get("neLng");

  if (tileMinX && tileMinY && tileMaxX && tileMaxY && tileZoom) {
    const parsed = [tileMinX, tileMinY, tileMaxX, tileMaxY, tileZoom].map(
      Number,
    );
    if (!parsed.some(isNaN)) {
      const bounds = tileRangeToBounds({
        minX: parsed[0],
        minY: parsed[1],
        maxX: parsed[2],
        maxY: parsed[3],
        zoom: parsed[4],
      });
      swLat = String(bounds.swLat);
      swLng = String(bounds.swLng);
      neLat = String(bounds.neLat);
      neLng = String(bounds.neLng);
    }
  }

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

  // name sort with bounds — use RPC to include wishlist_count
  if (sort === "name" && swLat && swLng && neLat && neLng) {
    const { data, error } = await supabase.rpc("get_shops_by_name", {
      sw_lat: parseFloat(swLat),
      sw_lng: parseFloat(swLng),
      ne_lat: parseFloat(neLat),
      ne_lng: parseFloat(neLng),
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const filtered = filterShops((data ?? []) as ShopWithCount[], q, tag);

    return NextResponse.json({
      shops: filtered,
      total: filtered.length,
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
    const { data, error } = await supabase.rpc("get_shops_by_distance", {
      sw_lat: parseFloat(swLat),
      sw_lng: parseFloat(swLng),
      ne_lat: parseFloat(neLat),
      ne_lng: parseFloat(neLng),
      user_lat: userLat,
      user_lng: userLng,
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const filtered = filterShops((data ?? []) as ShopWithCount[], q, tag);

    return NextResponse.json({
      shops: filtered,
      total: filtered.length,
      offset,
      limit,
    });
  }

  // wishlist_count sort — use RPC
  if (sort === "wishlist_count" && swLat && swLng && neLat && neLng) {
    const { data, error } = await supabase.rpc("get_shops_by_wishlist_count", {
      sw_lat: parseFloat(swLat),
      sw_lng: parseFloat(swLng),
      ne_lat: parseFloat(neLat),
      ne_lng: parseFloat(neLng),
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const filtered = filterShops((data ?? []) as ShopWithCount[], q, tag);

    return NextResponse.json({
      shops: filtered,
      total: filtered.length,
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

  const filtered = tag
    ? (data ?? []).filter((shop: { tags?: string[] }) =>
        (shop.tags ?? []).includes(tag),
      )
    : (data ?? []);

  return NextResponse.json({
    shops: filtered,
    total: filtered.length,
    offset,
    limit,
  });
}
