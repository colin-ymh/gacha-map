import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { createAuthenticatedClient, createAdminClient } from "@/lib/supabase/server";
import { createClaudeClient } from "@/lib/claude";
import ipTitleMapping from "@/data/ip-title-mapping.json";
import { collectForObservation } from "@/app/api/gacha-collect/_collect";

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
  series_label: string | null;    // 형태 시리즈 라벨 단독 일본어 (おねむたん, 肩ズン 등)
  series_label_ko: string | null; // 시리즈 라벨 한국어 (오네무탄, 카타즌 등)
  ip_name: string | null;         // IP명 일본어 (ぼっち・ざ・ろっく!, ハイキュー!! 등)
  manufacturer: string | null;
  price_krw: number | null;
  fullText: string;
}

type IpEntry = { ko: string; aliases_ja: string[]; source: string };
const IP_MAPPING = ipTitleMapping as Record<string, IpEntry>;

// ip_name(일본어)로 공식 한국어명 조회
function lookupIpKo(ipName: string | null): string | null {
  if (!ipName) return null;
  for (const [key, entry] of Object.entries(IP_MAPPING)) {
    if (key === ipName || entry.aliases_ja.includes(ipName)) return entry.ko;
  }
  return null;
}

function heuristicExtract(fullText: string): Pick<ScanExtraction, "series_label" | "ip_name" | "manufacturer"> {
  const lines = fullText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 3 && !/^\d[\d,]*$/.test(l) && !MANUFACTURER_PATTERNS.some(([p]) => p.test(l)));
  const hasKorean = (s: string) => /[가-힣]/.test(s);
  const hasCJK = (s: string) => /[぀-ヿ一-鿿가-힣]/.test(s);
  const koreanLines = lines.filter(hasKorean);
  const cjkLines = lines.filter(hasCJK);
  const titleLines = koreanLines.length > 0 ? koreanLines : cjkLines;
  const name = titleLines.slice(0, 2).join(" ").trim() || lines[0] || null;
  return {
    series_label: null,
    ip_name: name,
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

  if (!fullText.trim()) return { series_label: null, series_label_ko: null, ip_name: null, manufacturer: null, price_krw: null, fullText: "" };

  const priceMatch = fullText.match(/[₩]\s*(\d[\d,]+)|(\d[\d,]+)\s*원/);
  const priceRaw = priceMatch?.[1] ?? priceMatch?.[2] ?? null;
  const price_krw = priceRaw ? Math.round(parseInt(priceRaw.replace(/,/g, ""), 10)) : null;

  let series_label: string | null = null;
  let series_label_ko: string | null = null;
  let ip_name: string | null = null;
  let manufacturer: string | null = null;

  try {
    const claude = createClaudeClient();
    const msg = await claude.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 250,
      messages: [
        {
          role: "user",
          content: `가샤폰 기계 패널 OCR 텍스트에서 상품 정보를 추출하세요. JSON만 반환:\n{"series_label":"형태 시리즈 라벨—반드시 일본어로(예:おねむたん、肩ズン、こっちむいて、ぺっとねじまき、ぐにゃっと, 없으면null)","series_label_ko":"시리즈 라벨 한국어 번역(예:오네무탄、카타즌、코치무이테、펫토네지마키、구냐또, 없으면null)","ip_name":"IP·원작명 일본어(예:ぼっち・ざ・ろっく!、ハイキュー!!、チェンソーマン、鬼滅の刃、呪術廻戦, 없으면null)","manufacturer":"제조사(BANDAI/TAKARA TOMY 등, 없으면null)"}\n\n시리즈 라벨 힌트(한국어↔일본어):\n돌아봐/이쪽봐/코치무이테→こっちむいて / 어깨위/카타즌→肩ズン / 잠자/오네무탄→おねむたん / 구냐→ぐにゃっと / 펫토네지→ぺっとねじまき\n\n상품 타입 번역(name_ko에 포함될 수 있음):\nフィギュア→피규어 / マスコット→마스코트 / ぬいぐるみ→봉제인형 / キーチェーン→키체인 / 缶バッジ→캔배지 / アクリルチャーム→아크릴 참 / ストラップ→스트랩\n\n캐릭터→IP: 고조사토루·五条悟→呪術廻戦 / 히나타·카게야마→ハイキュー!! / 탄지로·네즈코·竈門→鬼滅の刃 / 봇치·キタ·山田→ぼっち・ざ・ろっく! / 파워·마키마→チェンソーマン\n\nOCR:\n${fullText.slice(0, 800)}`,
        },
      ],
    });
    const textBlock = msg.content.find((c) => c.type === "text");
    if (textBlock?.type === "text") {
      console.log("[scan] haiku raw:", textBlock.text);
      const match = textBlock.text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        series_label = typeof parsed.series_label === "string" && parsed.series_label.trim() ? parsed.series_label.trim() : null;
        series_label_ko = typeof parsed.series_label_ko === "string" && parsed.series_label_ko.trim() ? parsed.series_label_ko.trim() : null;
        ip_name = typeof parsed.ip_name === "string" && parsed.ip_name.trim() ? parsed.ip_name.trim() : null;
        manufacturer = typeof parsed.manufacturer === "string" && parsed.manufacturer.trim() ? parsed.manufacturer.trim() : null;
      }
    }
    console.log("[scan] haiku result:", { series_label, series_label_ko, ip_name, manufacturer });
  } catch (e) {
    console.error("[scan] haiku error:", e);
    const fallback = heuristicExtract(fullText);
    series_label = fallback.series_label;
    ip_name = fallback.ip_name;
    manufacturer = fallback.manufacturer;
    console.log("[scan] fallback result:", { series_label, ip_name, manufacturer });
  }

  return { series_label, series_label_ko, ip_name, manufacturer, price_krw, fullText };
}

export async function POST(request: NextRequest) {
  const { user } = await createAuthenticatedClient(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let image: string | undefined;
  let shopId: string | null = null;
  try {
    const body = await request.json();
    image = typeof body.image === "string" ? body.image : undefined;
    shopId = typeof body.shop_id === "string" ? body.shop_id : null;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!image) return NextResponse.json({ error: "image is required" }, { status: 400 });
  if (image.length > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image too large (max 5MB)" }, { status: 400 });
  }

  const adminSupabase = createAdminClient();

  const { data: profile } = await adminSupabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const isAdmin = profile?.role === "admin";

  if (!isAdmin) {
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
  }

  let extraction: ScanExtraction = { series_label: null, series_label_ko: null, ip_name: null, manufacturer: null, price_krw: null, fullText: "" };
  try {
    extraction = await extractFromVision(image);
    console.log("[gacha-scan] extraction:", JSON.stringify(extraction));
  } catch (e) {
    console.error("[gacha-scan] extractFromVision error:", e);
    return NextResponse.json({ candidates: [], price_krw: null });
  }

  const searchRpc = async (q: string, limit = SEARCH_LIMIT) => {
    const { data } = await adminSupabase.rpc("search_gacha_products", {
      q,
      p_manufacturer: null,
      p_limit: limit,
      p_offset: 0,
    });
    return (data as GachaProductCandidate[] | null) ?? [];
  };

  const candidates: GachaProductCandidate[] = [];
  const { series_label, series_label_ko, ip_name } = extraction;

  // 매핑 파일로 IP 한국어명 조회 → series_label_ko 조합
  const ip_ko = lookupIpKo(ip_name);
  const name_ko = [ip_ko, series_label_ko].filter(Boolean).join(" ") || null;

  if (series_label) {
    // 시리즈 라벨로 넓게 검색 후 IP명으로 필터링
    const allRows = await searchRpc(series_label, 20);
    const ipPrefix = ip_name ? ip_name.slice(0, 3) : null;
    const filtered = ipPrefix
      ? allRows.filter(
          (r) =>
            r.name.includes(ipPrefix) ||
            (r.name_ja && r.name_ja.includes(ipPrefix)) ||
            (r.name_ko && r.name_ko.includes(ipPrefix))
        )
      : allRows;

    const rows = filtered.length > 0 ? filtered.slice(0, SEARCH_LIMIT) : (ip_name ? await searchRpc(ip_name) : []);
    console.log("[gacha-scan] series search:", { series_label, ipPrefix, total: allRows.length, filtered: filtered.length, final: rows.length });
    for (const row of rows) {
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
  } else if (ip_name) {
    const rows = await searchRpc(ip_name);
    for (const row of rows) {
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

  // observation 저장 (의미있는 추출 결과 있을 때만)
  let observationId: string | null = null;
  const shouldSave =
    extraction.fullText.trim().length > 0 &&
    (extraction.series_label !== null || extraction.ip_name !== null);

  if (shouldSave) {
    try {
      const { data: obs, error } = await adminSupabase
        .from("gacha_product_observations")
        .insert({
          shop_id: shopId,
          observed_title_ja: extraction.series_label,
          observed_title_ko: name_ko ?? extraction.ip_name,
          manufacturer_hint: extraction.manufacturer,
          price_krw: extraction.price_krw,
          source_type: "user_photo",
          raw_ocr: { fullText: extraction.fullText },
          raw_vision: { series_label: extraction.series_label, ip_name: extraction.ip_name },
          status: candidates.length > 0 ? "matched" : "needs_review",
        })
        .select("id")
        .single();

      if (!error && obs) {
        observationId = obs.id;
        if (candidates.length === 0 && extraction.ip_name) {
          after(() =>
            collectForObservation({
              observation_id: obs.id,
              ip_name: extraction.ip_name!,
              series_label: extraction.series_label,
              manufacturer_hint: extraction.manufacturer,
            }).catch((e) => console.error("[gacha-scan] collect after failed:", e))
          );
        }
        if (candidates.length > 0) {
          void adminSupabase
            .from("gacha_product_observation_matches")
            .insert(
              candidates.map((c, i) => ({
                observation_id: obs.id,
                product_id: c.id,
                rank: i + 1,
                score: i === 0 ? 1.0 : parseFloat((0.8 - i * 0.1).toFixed(1)),
                match_reasons: { series_label: extraction.series_label, ip_name: extraction.ip_name },
                status: "candidate",
              }))
            )
            .then(({ error: e }) => {
              if (e) console.error("[gacha-scan] matches insert failed:", e);
            });
        }
      }
    } catch (e) {
      console.error("[gacha-scan] observation insert failed:", e);
    }
  }

  return NextResponse.json({
    candidates,
    price_krw: extraction.price_krw,
    extracted_name: name_ko ?? extraction.ip_name,
    observation_id: observationId,
    _debug: { series_label, series_label_ko, ip_name, ip_ko, name_ko, manufacturer: extraction.manufacturer },
  });
}
