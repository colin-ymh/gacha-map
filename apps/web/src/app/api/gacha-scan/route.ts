import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient, createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 5_000_000;
const DAILY_WINDOW_MS = 86_400_000;
const USER_DAILY_LIMIT = 10;
const SERVICE_DAILY_LIMIT = 100;
const SEARCH_LIMIT = 3;

const VISION_ENDPOINT = "https://vision.googleapis.com/v1/images:annotate";

const MANUFACTURER_PATTERNS: [RegExp, string][] = [
  [/bandai|バンダイ/i, "BANDAI"],
  [/takara\s*tomy|タカラトミー/i, "TAKARA TOMY"],
  [/epoch|エポック/i, "EPOCH"],
  [/yujin|ユージン/i, "YUJIN"],
  [/megahouse|メガハウス/i, "MEGAHOUSE"],
  [/good\s*smile|グッドスマイル/i, "GOOD SMILE"],
];

interface GachaProductCandidate {
  id: string;
  name: string;
  name_ko: string | null;
  name_ja: string | null;
  manufacturer: string;
  official_image_url: string | null;
  price_jpy: number | null;
}

interface ScanExtraction {
  product_name: string | null;
  manufacturer: string | null;
  price_krw: number | null;
}

async function extractFromVision(base64Image: string): Promise<ScanExtraction> {
  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) throw new Error("Missing GOOGLE_VISION_API_KEY");

  const res = await fetch(`${VISION_ENDPOINT}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        {
          image: { content: base64Image },
          features: [{ type: "TEXT_DETECTION", maxResults: 1 }],
        },
      ],
    }),
  });

  if (!res.ok) throw new Error(`Vision API error: ${res.status}`);

  const data = await res.json();
  const fullText: string = data.responses?.[0]?.textAnnotations?.[0]?.description ?? "";

  if (!fullText.trim()) return { product_name: null, manufacturer: null, price_krw: null };

  const manufacturer = MANUFACTURER_PATTERNS.find(([pattern]) => pattern.test(fullText))?.[1] ?? null;

  const priceMatch = fullText.match(/[₩]\s*(\d[\d,]+)|(\d[\d,]+)\s*원/);
  const priceRaw = priceMatch?.[1] ?? priceMatch?.[2] ?? null;
  const price_krw = priceRaw ? Math.round(parseInt(priceRaw.replace(/,/g, ""), 10)) : null;

  const lines = fullText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 3 && !/^\d[\d,]*$/.test(l) && !MANUFACTURER_PATTERNS.some(([p]) => p.test(l)));

  const hasKorean = (s: string) => /[가-힣]/.test(s);
  const hasCJK = (s: string) => /[぀-ヿ一-鿿가-힣]/.test(s);

  // 한국어 줄 우선 (가샤폰 기계에 한국어 표기 있을 경우 검색 정확도 높음)
  const koreanLines = lines.filter(hasKorean);
  const cjkLines = lines.filter(hasCJK);

  // 첫 번째 한국어 줄 + 두 번째 줄 조합 (예: "체인소 맨" + "레제편")
  const titleLines = koreanLines.length > 0 ? koreanLines : cjkLines;
  const product_name = titleLines.slice(0, 2).join(" ").trim() || lines[0] || null;

  return { product_name, manufacturer, price_krw };
}

export async function POST(request: NextRequest) {
  const { user } = await createAuthenticatedClient(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let image: string | undefined;
  try {
    const body = await request.json();
    image = typeof body.image === "string" ? body.image : undefined;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!image) return NextResponse.json({ error: "image is required" }, { status: 400 });
  if (image.length > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image too large (max 5MB)" }, { status: 400 });
  }

  const adminSupabase = createAdminClient();

  const { data: serviceAllowed } = await adminSupabase.rpc("check_rate_limit", {
    p_key: "vision:service",
    p_max: SERVICE_DAILY_LIMIT,
    p_window_ms: DAILY_WINDOW_MS,
  });
  if (!serviceAllowed) return NextResponse.json({ error: "rate_limit" }, { status: 429 });

  const { data: userAllowed } = await adminSupabase.rpc("check_rate_limit", {
    p_key: `vision:u:${user.id}`,
    p_max: USER_DAILY_LIMIT,
    p_window_ms: DAILY_WINDOW_MS,
  });
  if (!userAllowed) return NextResponse.json({ error: "rate_limit" }, { status: 429 });

  let extraction: ScanExtraction = { product_name: null, manufacturer: null, price_krw: null };
  try {
    extraction = await extractFromVision(image);
  } catch {
    return NextResponse.json({ candidates: [], price_krw: null });
  }

  const candidates: GachaProductCandidate[] = [];
  if (extraction.product_name) {
    const { data: rpcData } = await adminSupabase.rpc("search_gacha_products", {
      q: extraction.product_name,
      p_manufacturer: extraction.manufacturer ?? null,
      p_limit: SEARCH_LIMIT,
      p_offset: 0,
    });
    for (const row of (rpcData as GachaProductCandidate[] | null) ?? []) {
      candidates.push({
        id: row.id,
        name: row.name,
        name_ko: row.name_ko,
        name_ja: row.name_ja,
        manufacturer: row.manufacturer,
        official_image_url: row.official_image_url,
        price_jpy: row.price_jpy,
      });
    }
  }

  return NextResponse.json({
    candidates,
    price_krw: extraction.price_krw,
    extracted_name: extraction.product_name,
  });
}
