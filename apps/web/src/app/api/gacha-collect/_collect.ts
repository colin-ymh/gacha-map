import { createAdminClient } from "@/lib/supabase/server";

const BANDAI_SEARCH_URL = "https://www.gashapon.jp/products/result.php";
const BANDAI_BASE_URL = "https://www.gashapon.jp";
const MAX_PRODUCTS = 5;

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
    const lookupKey = product.jan_code ?? url;
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

    const { data: inserted, error } = await supabase
      .from("gacha_products")
      .insert({
        name: product.name,
        name_ja: product.name_ja,
        normalized_name: product.name.toLowerCase(),
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
