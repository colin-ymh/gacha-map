interface GeocodeResult {
  roadAddress: string;
  jibunAddress: string;
  lat: number;
  lng: number;
}

export async function geocodeAddress(query: string): Promise<GeocodeResult[]> {
  if (query.trim().length < 2) return [];

  const apiKey = process.env.KAKAO_REST_API_KEY;

  if (!apiKey) {
    return [];
  }

  try {
    const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query.trim())}&size=5`;
    const res = await fetch(url, {
      headers: {
        Authorization: `KakaoAK ${apiKey}`,
      },
      signal: AbortSignal.timeout(3000),
    });

    if (!res.ok) {
      return [];
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

    return (json.documents ?? []).map((d) => ({
      roadAddress: d.road_address?.address_name ?? d.address_name,
      jibunAddress: d.address?.address_name ?? "",
      lat: parseFloat(d.y),
      lng: parseFloat(d.x),
    }));
  } catch {
    return [];
  }
}
