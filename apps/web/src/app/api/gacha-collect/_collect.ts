import { createAdminClient } from "@/lib/supabase/server";
import { createClaudeClient } from "@/lib/claude";
import ipTitleMapping from "@/data/ip-title-mapping.json";

const BANDAI_SEARCH_URL = "https://www.gashapon.jp/products/result.php";
const BANDAI_BASE_URL = "https://www.gashapon.jp";
const MAX_PRODUCTS = 5;
const CLAUDE_MODEL = "claude-haiku-4-5-20251001";

type IpEntry = { ko: string; aliases_ja: string[]; source: string };
const IP_MAPPING = ipTitleMapping as Record<string, IpEntry>;

function lookupIpKo(ipName: string | null): string | null {
  if (!ipName) return null;
  for (const [key, entry] of Object.entries(IP_MAPPING)) {
    if (key === ipName || entry.aliases_ja.includes(ipName)) return entry.ko;
  }
  return null;
}

async function translateNameKo(nameJa: string, ipKo: string | null): Promise<string | null> {
  try {
    const claude = createClaudeClient();
    const msg = await claude.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 100,
      messages: [{
        role: "user",
        content: `일본어 가샤폰 상품명을 한국어로 번역하세요. JSON만 반환: {"name_ko":"번역된 상품명"}
${ipKo ? `IP명은 반드시 "${ipKo}"로 교체. ` : ""}상품 타입: フィギュア→피규어, マスコット→마스코트, ぬいぐるみ→봉제인형, キーチェーン→키체인, 缶バッジ→캔배지, ストラップ→스트랩, アクリルチャーム→아크릴 참
일본어 상품명: ${nameJa}`,
      }],
    });
    const text = msg.content.find((c) => c.type === "text");
    if (text?.type === "text") {
      const m = text.text.match(/\{[\s\S]*\}/);
      if (m) {
        const parsed = JSON.parse(m[0]);
        if (typeof parsed.name_ko === "string" && parsed.name_ko.trim()) {
          return parsed.name_ko.trim();
        }
      }
    }
  } catch (e) {
    console.error("[collect] translateNameKo error:", e);
  }
  return null;
}

// ── minimal HTML helpers (ported from gacha-collector) ──

function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = {
    amp: "&", apos: "'", gt: ">", lt: "<", nbsp: " ", quot: '"',
    reg: "®", copy: "©", trade: "™", times: "×",
  };
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
    const n = String(entity).toLowerCase();
    if (n.startsWith("#x")) return String.fromCodePoint(parseInt(n.slice(2), 16));
    if (n.startsWith("#")) return String.fromCodePoint(parseInt(n.slice(1), 10));
    return named[n] ?? match;
  });
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function stripTags(html: string): string {
  return decodeHtmlEntities(
    html.replace(/<!--[\s\S]*?-->/g, " ")
       .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, " ")
       .replace(/<[^>]+>/g, " "),
  );
}

function textFromHtml(html: string): string {
  return normalizeWhitespace(stripTags(html));
}

function parseAttributes(value: string): Map<string, string> {
  const attrs = new Map<string, string>();
  const pattern = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(value)) !== null) {
    attrs.set(
      (m[1] ?? "").toLowerCase(),
      decodeHtmlEntities(m[2] ?? m[3] ?? m[4] ?? ""),
    );
  }
  return attrs;
}

function absoluteUrl(url: string | undefined, baseUrl: string): string | null {
  if (!url) return null;
  try {
    const abs = new URL(url, baseUrl);
    abs.hash = "";
    return abs.toString();
  } catch {
    return null;
  }
}

function firstTagText(html: string, tagName: string): string {
  const m = html.match(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return m ? textFromHtml(m[1] ?? "") : "";
}

function firstMetaContent(html: string, key: "name" | "property", value: string): string | undefined {
  const pattern = /<meta\b([^>]*)>/gi;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const attrs = parseAttributes(m[1] ?? "");
    if (attrs.get(key) === value) return attrs.get("content");
  }
  return undefined;
}

function isSiteChromeImage(url: string): boolean {
  return /(?:^|[/_-])(?:logo|favicon|webclip)(?:[._/?-]|$)/i.test(url);
}

function pickMetaImage(html: string, sourceUrl: string): string | null {
  for (const candidate of [
    firstMetaContent(html, "property", "og:image"),
    firstMetaContent(html, "name", "twitter:image"),
  ]) {
    const url = absoluteUrl(candidate, sourceUrl);
    if (url && !isSiteChromeImage(url)) return url;
  }
  return null;
}

function cleanProductTitle(value: string): string {
  return normalizeWhitespace(value)
    .replace(/\| ガシャポンオフィシャルサイト$/, "")
    .replace(/｜ガシャポンオフィシャルサイト$/, "");
}

function extractPrice(text: string): number | null {
  const m = text.match(/(?:税込)?\s*([0-9,]+)\s*円/);
  return m ? parseInt((m[1] ?? "0").replace(/,/g, ""), 10) : null;
}

function extractJanFromUrl(sourceUrl: string): string | null {
  return new URL(sourceUrl).searchParams.get("jan_code");
}

// ── Bandai-specific ──

function extractBandaiProductLinks(html: string, sourceUrl: string): string[] {
  const seen = new Set<string>();
  const links: string[] = [];
  const pattern = /<a\b([^>]*)>/gi;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const href = parseAttributes(m[1] ?? "").get("href");
    if (!href || href.startsWith("#")) continue;
    const url = absoluteUrl(href, sourceUrl);
    if (!url) continue;
    if (/\/products\/.*(?:detail|jan_code)/.test(url) && !seen.has(url)) {
      seen.add(url);
      links.push(url);
    }
  }
  return links;
}

interface ParsedProduct {
  name: string;
  name_ja: string;
  jan_code: string | null;
  price_jpy: number | null;
  official_image_url: string | null;
  source_url: string;
}

function parseBandaiProductBasic(html: string, sourceUrl: string): ParsedProduct {
  const name = cleanProductTitle(
    firstTagText(html, "h1") ||
    firstMetaContent(html, "property", "og:title") ||
    firstMetaContent(html, "name", "twitter:title") ||
    firstTagText(html, "title") ||
    "",
  );
  const text = textFromHtml(html);
  return {
    name,
    name_ja: name,
    jan_code: extractJanFromUrl(sourceUrl),
    price_jpy: extractPrice(text),
    official_image_url: pickMetaImage(html, sourceUrl),
    source_url: sourceUrl,
  };
}

// ── relevance check ──

function isRelevant(productName: string, ipName: string): boolean {
  const prefix = ipName.slice(0, 3);
  return productName.includes(prefix);
}

// ── main export ──

export interface CollectOptions {
  observation_id: string | null;
  ip_name: string;
  series_label: string | null;
  manufacturer_hint: string | null;
}

export async function collectForObservation(opts: CollectOptions): Promise<void> {
  const { observation_id, ip_name, series_label } = opts;

  const keyword = [ip_name, series_label].filter(Boolean).join(" ");
  const searchUrl = `${BANDAI_SEARCH_URL}?free=${encodeURIComponent(keyword)}`;

  let html: string;
  try {
    const res = await fetch(searchUrl, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`search ${res.status}`);
    html = await res.text();
  } catch (e) {
    console.error("[collect] search fetch failed:", e);
    return;
  }

  const allLinks = extractBandaiProductLinks(html, BANDAI_BASE_URL);
  // keep only links relevant to the IP
  const relevantLinks = allLinks
    .filter((url) => {
      const jan = extractJanFromUrl(url);
      return !!jan;
    })
    .slice(0, MAX_PRODUCTS * 2);

  if (relevantLinks.length === 0) {
    console.log("[collect] no product links found for:", keyword);
    return;
  }

  const supabase = createAdminClient();
  const insertedIds: string[] = [];

  for (const url of relevantLinks) {
    if (insertedIds.length >= MAX_PRODUCTS) break;

    let productHtml: string;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
      if (!res.ok) continue;
      productHtml = await res.text();
    } catch {
      continue;
    }

    const product = parseBandaiProductBasic(productHtml, url);
    if (!product.name) continue;

    // relevance gate: title must contain IP name prefix
    if (!isRelevant(product.name, ip_name)) continue;

    // dedup by jan_code
    const { data: existing } = await supabase
      .from("gacha_products")
      .select("id")
      .or(
        product.jan_code
          ? `jan_code.eq.${product.jan_code},source_url.eq.${url}`
          : `source_url.eq.${url}`
      )
      .maybeSingle();

    if (existing) {
      insertedIds.push(existing.id);
      continue;
    }

    const ip_ko = lookupIpKo(ip_name);
    const name_ko = await translateNameKo(product.name_ja, ip_ko);
    const displayName = name_ko ?? product.name_ja;

    const { data: inserted, error } = await supabase
      .from("gacha_products")
      .insert({
        name: displayName,
        name_ja: product.name_ja,
        name_ko,
        normalized_name: displayName.toLowerCase(),
        manufacturer: "bandai",
        price_jpy: product.price_jpy,
        official_image_url: product.official_image_url,
        source_url: product.source_url,
        source_type: "official",
        jan_code: product.jan_code,
        status: "active",
      })
      .select("id")
      .single();

    if (error) {
      console.error("[collect] insert failed:", error.message, "url:", url);
      continue;
    }
    if (inserted) {
      console.log("[collect] inserted:", product.name, "id:", inserted.id);
      insertedIds.push(inserted.id);
    }
  }

  if (insertedIds.length === 0) {
    console.log("[collect] no relevant products found for:", keyword);
    return;
  }

  if (observation_id) {
    await supabase
      .from("gacha_product_observation_matches")
      .upsert(
        insertedIds.map((id, i) => ({
          observation_id,
          product_id: id,
          rank: i + 1,
          score: i === 0 ? 0.9 : parseFloat((0.7 - i * 0.05).toFixed(2)),
          match_reasons: { auto_collect: true, ip_name, series_label },
          status: "candidate",
        })),
        { onConflict: "observation_id,product_id" },
      );

    await supabase
      .from("gacha_product_observations")
      .update({ status: "matched" })
      .eq("id", observation_id)
      .eq("status", "needs_review");

    console.log("[collect] linked", insertedIds.length, "products to observation:", observation_id);
  }
}

// ── collectAndReplace ──
// user_manual 상품을 만든 직후 호출. collect 실행 후 공식 상품으로 교체.

export interface CollectAndReplaceOptions {
  observation_id: string;
  user_manual_product_id: string;
  shop_id: string | undefined;
}

export async function collectAndReplace(opts: CollectAndReplaceOptions): Promise<void> {
  const { observation_id, user_manual_product_id, shop_id } = opts;

  const supabase = createAdminClient();

  // observation에서 ip_name, series_label 조회
  const { data: obs } = await supabase
    .from("gacha_product_observations")
    .select("raw_vision, manufacturer_hint")
    .eq("id", observation_id)
    .single();

  const rawVision = obs?.raw_vision as { ip_name?: string; series_label?: string } | null;
  const ip_name = rawVision?.ip_name ?? null;
  const series_label = rawVision?.series_label ?? null;

  if (!ip_name) {
    console.log("[collect] no ip_name in observation, skipping replace:", observation_id);
    return;
  }

  // collect 실행
  await collectForObservation({
    observation_id,
    ip_name,
    series_label,
    manufacturer_hint: obs?.manufacturer_hint ?? null,
  });

  // collect로 저장된 공식 상품 중 가장 순위 높은 것
  const { data: bestMatch } = await supabase
    .from("gacha_product_observation_matches")
    .select("product_id")
    .eq("observation_id", observation_id)
    .eq("status", "candidate")
    .order("rank", { ascending: true })
    .limit(1)
    .single();

  if (!bestMatch) {
    console.log("[collect] no official match found, keeping user_manual:", user_manual_product_id);
    return;
  }

  const officialProductId = bestMatch.product_id;

  // shop_gacha_products: user_manual → official 교체
  if (shop_id) {
    const { error: updateErr } = await supabase
      .from("shop_gacha_products")
      .update({ gacha_product_id: officialProductId })
      .eq("gacha_product_id", user_manual_product_id)
      .eq("shop_id", shop_id);

    if (updateErr) {
      console.error("[collect] shop_gacha_products update failed:", updateErr.message);
      return;
    }
    console.log("[collect] upgraded shop product:", user_manual_product_id, "→", officialProductId);
  }

  // user_manual 상품 아카이브
  await supabase
    .from("gacha_products")
    .update({ status: "archived" })
    .eq("id", user_manual_product_id)
    .eq("source_type", "user_manual");

  console.log("[collect] deactivated user_manual product:", user_manual_product_id);
}
