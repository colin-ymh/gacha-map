export async function geocodeKeyword(
  query: string,
): Promise<{ lat: number; lng: number } | null> {
  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);

  try {
    const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query.trim())}&size=1`;
    const res = await fetch(url, {
      headers: { Authorization: `KakaoAK ${key}` },
      signal: controller.signal,
    });
    if (!res.ok) return null;

    const json = (await res.json()) as {
      documents?: Array<{ x: string; y: string }>;
    };
    const doc = json.documents?.[0];
    if (!doc) return null;

    const lat = parseFloat(doc.y);
    const lng = parseFloat(doc.x);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return { lat, lng };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
