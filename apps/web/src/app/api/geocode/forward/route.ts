import { NextRequest, NextResponse } from "next/server";

export interface GeocodeResult {
  roadAddress: string;
  jibunAddress: string;
  lat: number;
  lng: number;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query");

  if (!query || query.trim().length < 2) {
    return NextResponse.json({ results: [] }, { status: 200 });
  }

  const apiKey = process.env.KAKAO_REST_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ results: [] }, { status: 200 });
  }

  try {
    const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query.trim())}&size=5`;
    const res = await fetch(url, {
      headers: {
        Authorization: `KakaoAK ${apiKey}`,
      },
    });

    if (!res.ok) {
      return NextResponse.json({ results: [] }, { status: 200 });
    }

    const json = (await res.json()) as {
      documents?: Array<{
        address_name: string;
        x: string;
        y: string;
        road_address?: { address_name?: string } | null;
        address?: { address_name?: string } | null;
      }>;
    };

    const results: GeocodeResult[] = (json.documents ?? []).map((d) => ({
      roadAddress: d.road_address?.address_name ?? d.address_name,
      jibunAddress: d.address?.address_name ?? "",
      lat: parseFloat(d.y),
      lng: parseFloat(d.x),
    }));

    return NextResponse.json({ results }, { status: 200 });
  } catch {
    return NextResponse.json({ results: [] }, { status: 200 });
  }
}
