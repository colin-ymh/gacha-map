import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  if (!lat || !lng) {
    return NextResponse.json(
      { error: "lat and lng are required" },
      { status: 400 },
    );
  }

  const parsedLat = parseFloat(lat);
  const parsedLng = parseFloat(lng);
  if (isNaN(parsedLat) || isNaN(parsedLng)) {
    return NextResponse.json(
      { error: "lat and lng must be valid numbers" },
      { status: 400 },
    );
  }

  const apiKey = process.env.KAKAO_REST_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ address: null }, { status: 200 });
  }

  try {
    const url = `https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${parsedLng}&y=${parsedLat}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `KakaoAK ${apiKey}`,
      },
    });

    if (!res.ok) {
      return NextResponse.json({ address: null }, { status: 200 });
    }

    const json = (await res.json()) as {
      documents?: Array<{
        road_address?: { address_name?: string } | null;
        address?: { address_name?: string } | null;
      }>;
    };

    const doc = json.documents?.[0];
    const address =
      doc?.road_address?.address_name ?? doc?.address?.address_name ?? null;

    return NextResponse.json({ address }, { status: 200 });
  } catch {
    return NextResponse.json({ address: null }, { status: 200 });
  }
}
