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

  const clientId = process.env.NAVER_MAP_CLIENT_ID;
  const clientSecret = process.env.NAVER_MAP_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json({ results: [] }, { status: 200 });
  }

  try {
    const url = `https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(query.trim())}&count=5`;
    const res = await fetch(url, {
      headers: {
        "X-NCP-APIGW-API-KEY-ID": clientId,
        "X-NCP-APIGW-API-KEY": clientSecret,
      },
    });

    if (!res.ok) {
      return NextResponse.json({ results: [] }, { status: 200 });
    }

    const json = (await res.json()) as {
      status: string;
      addresses?: Array<{
        roadAddress: string;
        jibunAddress: string;
        x: string;
        y: string;
      }>;
    };

    if (json.status !== "OK" || !json.addresses?.length) {
      return NextResponse.json({ results: [] }, { status: 200 });
    }

    const results: GeocodeResult[] = json.addresses.map((a) => ({
      roadAddress: a.roadAddress,
      jibunAddress: a.jibunAddress,
      lat: parseFloat(a.y),
      lng: parseFloat(a.x),
    }));

    return NextResponse.json({ results }, { status: 200 });
  } catch {
    return NextResponse.json({ results: [] }, { status: 200 });
  }
}
