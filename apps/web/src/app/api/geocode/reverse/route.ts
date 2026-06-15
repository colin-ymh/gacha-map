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

  const clientId = process.env.NAVER_MAP_CLIENT_ID;
  const clientSecret = process.env.NAVER_MAP_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json({ address: null }, { status: 200 });
  }

  try {
    const url = `https://naveropenapi.apigw.ntruss.com/map-reversegeocode/v2/gc?coords=${parsedLng},${parsedLat}&output=json&orders=roadaddr,addr`;
    const res = await fetch(url, {
      headers: {
        "X-NCP-APIGW-API-KEY-ID": clientId,
        "X-NCP-APIGW-API-KEY": clientSecret,
      },
    });

    if (!res.ok) {
      return NextResponse.json({ address: null }, { status: 200 });
    }

    const json = (await res.json()) as {
      results?: Array<{
        name: string;
        region?: {
          area1?: { name: string };
          area2?: { name: string };
          area3?: { name: string };
          area4?: { name: string };
        };
        land?: { name?: string; number1?: string; number2?: string };
      }>;
    };

    const results = json.results ?? [];
    const roadAddr = results.find((r) => r.name === "roadaddr");
    const addr = results.find((r) => r.name === "addr");
    const target = roadAddr ?? addr;

    if (!target) {
      return NextResponse.json({ address: null }, { status: 200 });
    }

    const region = target.region;
    const land = target.land;
    const area1 = region?.area1?.name ?? "";
    const area2 = region?.area2?.name ?? "";
    const area3 = region?.area3?.name ?? "";
    const area4 = region?.area4?.name ?? "";
    const landName = land?.name ?? "";
    const landNum = [land?.number1, land?.number2].filter(Boolean).join("-");

    const addressParts = [area1, area2, area3, area4, landName, landNum].filter(
      Boolean,
    );
    const address = addressParts.join(" ").trim() || null;

    return NextResponse.json({ address }, { status: 200 });
  } catch {
    return NextResponse.json({ address: null }, { status: 200 });
  }
}
