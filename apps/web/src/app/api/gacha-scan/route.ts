import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient, createAdminClient } from "@/lib/supabase/server";
import { createClaudeClient } from "@/lib/claude";

export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 5_000_000;
const DAILY_WINDOW_MS = 86_400_000;
const USER_DAILY_LIMIT = 10;
const SERVICE_DAILY_LIMIT = 100;
const CLAUDE_MODEL = "claude-haiku-4-5-20251001";
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

function heuristicExtract(fullText: string): Pick<ScanExtraction, "product_name" | "manufacturer"> {
  const lines = fullText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 3 && !/^\d[\d,]*$/.test(l) && !MANUFACTURER_PATTERNS.some(([p]) => p.test(l)));
  const hasKorean = (s: string) => /[가-힣]/.test(s);
  const hasCJK = (s: string) => /[぀-ヿ一-鿿가-힣]/.test(s);
  const koreanLines = lines.filter(hasKorean);
  const cjkLines = lines.filter(hasCJK);
  const titleLines = koreanLines.length > 0 ? koreanLines : cjkLines;
  return {
    product_name: titleLines.slice(0, 2).join(" ").trim() || lines[0] || null,
    manufacturer: MANUFACTURER_PATTERNS.find(([p]) => p.test(fullText))?.[1] ?? null,
  };
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
  console.log("[scan] ocr length:", fullText.length, "| first 200:", fullText.slice(0, 200).replace(/\n/g, "\\n"));

  if (!fullText.trim()) return { product_name: null, manufacturer: null, price_krw: null };

  const priceMatch = fullText.match(/[₩]\s*(\d[\d,]+)|(\d[\d,]+)\s*원/);
  const priceRaw = priceMatch?.[1] ?? priceMatch?.[2] ?? null;
  const price_krw = priceRaw ? Math.round(parseInt(priceRaw.replace(/,/g, ""), 10)) : null;

  let product_name: string | null = null;
  let manufacturer: string | null = null;

  try {
    const claude = createClaudeClient();
    const msg = await claude.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 128,
      messages: [
        {
          role: "user",
          content: `가샤폰 기계 패널 OCR 텍스트에서 IP/시리즈명과 제조사를 추출하세요. JSON만 반환:\n{"product_name":"IP·시리즈명(肩ズン/ぷくっと/おねむたん/꾸백/돌아봐 같은 상품 형태 라벨은 제외하고 실제 IP명만)","manufacturer":"제조사(BANDAI/TAKARA TOMY 등,모르면null)"}\n\n캐릭터→IP 힌트: 고조사토루·나나미켄토·게토스구루·하이바라유우·오카쓰파쿠·五条悟→呪術廻戦 / 히나타·카게야마·우카이·네코마·스가와라→ハイキュー!! / 탄지로·네즈코·젠이쓰·이노스케·煉獄·竈門→鬼滅の刃 / 봇치·키타·리코·니지카·山田·伊地知→ぼっち・ざ・ろっく! / 파워·마키마·아카네→チェンソーマン\n\nOCR:\n${fullText.slice(0, 800)}`,
        },
      ],
    });
    const textBlock = msg.content.find((c) => c.type === "text");
    if (textBlock?.type === "text") {
      console.log("[scan] haiku raw:", textBlock.text);
      const match = textBlock.text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        product_name = typeof parsed.product_name === "string" ? parsed.product_name : null;
        manufacturer = typeof parsed.manufacturer === "string" ? parsed.manufacturer : null;
      }
    }
    console.log("[scan] haiku result:", { product_name, manufacturer });
  } catch (e) {
    console.error("[scan] haiku error:", e);
    const fallback = heuristicExtract(fullText);
    product_name = fallback.product_name;
    manufacturer = fallback.manufacturer;
    console.log("[scan] fallback result:", { product_name, manufacturer });
  }

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
    console.log("[gacha-scan] extraction:", JSON.stringify(extraction));
  } catch (e) {
    console.error("[gacha-scan] extractFromVision error:", e);
    return NextResponse.json({ candidates: [], price_krw: null });
  }

  const candidates: GachaProductCandidate[] = [];
  if (extraction.product_name) {
    const { data: rpcData } = await adminSupabase.rpc("search_gacha_products", {
      q: extraction.product_name,
      p_manufacturer: null,
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
    _debug: { product_name: extraction.product_name, manufacturer: extraction.manufacturer },
  });
}
