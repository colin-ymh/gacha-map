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

interface GachaProductCandidate {
  id: string;
  name: string;
  name_ko: string | null;
  name_ja: string | null;
  manufacturer: string;
  official_image_url: string | null;
  price_jpy: number | null;
}

interface ClaudeExtraction {
  product_name: string | null;
  manufacturer: string | null;
  price_krw: number | null;
}

function extractJson(text: string): ClaudeExtraction {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { product_name: null, manufacturer: null, price_krw: null };
    const parsed = JSON.parse(match[0]);
    return {
      product_name: typeof parsed.product_name === "string" ? parsed.product_name : null,
      manufacturer: typeof parsed.manufacturer === "string" ? parsed.manufacturer : null,
      price_krw: typeof parsed.price_krw === "number" ? Math.round(parsed.price_krw) : null,
    };
  } catch {
    return { product_name: null, manufacturer: null, price_krw: null };
  }
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

  let extraction: ClaudeExtraction = { product_name: null, manufacturer: null, price_krw: null };
  try {
    const claude = createClaudeClient();
    const message = await claude.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: "image/jpeg", data: image },
            },
            {
              type: "text",
              text: `이 가샤폰 기계 사진에서 다음을 추출해주세요.\nJSON만 반환 (다른 텍스트 없이):\n{"product_name":"상품명(한국어우선,없으면일본어,모르면null)","manufacturer":"제조사(예:BANDAI,모르면null)","price_krw":기계LCD왼쪽숫자(없으면null)}`,
            },
          ],
        },
      ],
    });
    const textBlock = message.content.find((c) => c.type === "text");
    if (textBlock && textBlock.type === "text") {
      extraction = extractJson(textBlock.text);
    }
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
