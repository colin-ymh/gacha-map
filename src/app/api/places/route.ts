import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const search = searchParams.get("search");
  const swLat = searchParams.get("swLat");
  const swLng = searchParams.get("swLng");
  const neLat = searchParams.get("neLat");
  const neLng = searchParams.get("neLng");
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  if (lat !== null || lng !== null) {
    const parsedLat = parseFloat(lat ?? "");
    const parsedLng = parseFloat(lng ?? "");
    if (isNaN(parsedLat) || isNaN(parsedLng)) {
      return NextResponse.json(
        { error: "Invalid lat/lng parameters. Both must be valid numbers." },
        { status: 400 },
      );
    }
  }

  const supabase = await createClient();

  let query = supabase
    .from("places")
    .select("id, name, road_address, lat, lng, phone, category")
    .not("lat", "is", null)
    .not("lng", "is", null);

  if (search) {
    query = query.ilike("name", `%${search}%`);
  }

  if (swLat && swLng && neLat && neLng) {
    query = query
      .gte("lat", parseFloat(swLat))
      .lte("lat", parseFloat(neLat))
      .gte("lng", parseFloat(swLng))
      .lte("lng", parseFloat(neLng));
  }

  const { data, error } = await query.order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ places: data });
}
