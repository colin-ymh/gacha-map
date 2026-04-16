import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_LIMIT = 20;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q");
  const tag = searchParams.get("tag");
  const swLat = searchParams.get("swLat");
  const swLng = searchParams.get("swLng");
  const neLat = searchParams.get("neLat");
  const neLng = searchParams.get("neLng");
  const rawOffset = parseInt(searchParams.get("offset") ?? "0", 10);
  const rawLimit = parseInt(
    searchParams.get("limit") ?? String(DEFAULT_LIMIT),
    10,
  );
  const offset = isNaN(rawOffset) || rawOffset < 0 ? 0 : rawOffset;
  const limit = isNaN(rawLimit) ? DEFAULT_LIMIT : Math.min(rawLimit, 100);

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

  let query = supabase
    .from("shops")
    .select("id, name, address, lat, lng, tags, image_urls, is_authorized", {
      count: "exact",
    })
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (q) {
    query = query.or(`name.ilike.%${q}%,address.ilike.%${q}%`);
  }

  if (tag) {
    query = query.contains("tags", [tag]);
  }

  if (swLat && swLng && neLat && neLng) {
    query = query
      .gte("lat", parseFloat(swLat))
      .lte("lat", parseFloat(neLat))
      .gte("lng", parseFloat(swLng))
      .lte("lng", parseFloat(neLng));
  }

  const { data, error, count } = await query.range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    shops: data,
    total: count ?? 0,
    offset,
    limit,
  });
}
