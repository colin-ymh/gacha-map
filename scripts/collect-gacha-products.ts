import { createHash } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { load } from "cheerio";
import { loadEnvConfig } from "@next/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type Manufacturer = "bandai" | "takara_tomy_arts";
type CollectionMode = "current" | "full";

export interface ParsedGachaProduct {
  manufacturer: Manufacturer;
  name: string;
  name_ja: string;
  jan_code: string | null;
  product_code: string | null;
  price_jpy: number | null;
  release_month: string | null;
  release_week_text: string | null;
  types_count: number | null;
  official_image_url: string | null;
  source_url: string;
  source_name: string;
  source_product_key: string;
  raw_price_text: string | null;
  raw_release_text: string | null;
}

interface ProductRecord {
  id: string;
}

interface CollectResult {
  products: ParsedGachaProduct[];
  errors: string[];
  links: string[];
  duplicateCount: number;
}

interface CliOptions {
  dryRun: boolean;
  mode: CollectionMode;
  sources: Manufacturer[];
  maxPages: number;
  maxProducts: number | null;
  concurrency: number;
  timeoutMs: number;
  output: string | null;
}

const SOURCE_URLS = {
  bandai: process.env.BANDAI_GASHAPON_SOURCE_URL ?? "https://www.gashapon.jp/",
  takara:
    process.env.TAKARA_TOMY_ARTS_GACHA_SOURCE_URL ??
    "https://www.takaratomy-arts.co.jp/items/gacha/calendar/",
};

const FULL_SOURCE_URLS = {
  bandai:
    process.env.BANDAI_GASHAPON_FULL_SOURCE_URL ??
    "https://www.gashapon.jp/products/result.php",
  takara:
    process.env.TAKARA_TOMY_ARTS_GACHA_FULL_SOURCE_URL ??
    "https://www.takaratomy-arts.co.jp/items/gacha/search.html",
};

function loadCollectorEnv() {
  const candidateDirs = [process.cwd(), resolve(process.cwd(), "../..")];
  const loaded = new Set<string>();

  for (const dir of candidateDirs) {
    if (loaded.has(dir) || !existsSync(resolve(dir, ".env.local"))) {
      continue;
    }

    loadEnvConfig(dir);
    loaded.add(dir);
  }
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeName(value: string) {
  return normalizeWhitespace(value).toLowerCase();
}

function firstNonBlank(...values: Array<string | undefined>) {
  for (const value of values) {
    const normalized = normalizeWhitespace(value ?? "");
    if (normalized) return normalized;
  }

  return "";
}

function cleanProductTitle(value: string) {
  return normalizeWhitespace(value)
    .replace(/｜商品情報｜タカラトミーアーツ$/, "")
    .replace(/\| ガシャポンオフィシャルサイト$/, "");
}

function absoluteUrl(url: string | undefined, baseUrl: string) {
  if (!url) return null;
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return null;
  }
}

function getArgValue(name: string) {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);

  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0) return process.argv[index + 1] ?? null;

  return null;
}

function parseCliOptions(): CliOptions {
  const mode = getArgValue("mode") === "full" ? "full" : "current";
  const sourceValue = getArgValue("source");
  const sources = sourceValue
    ? sourceValue
        .split(",")
        .map((source) => source.trim())
        .filter(
          (
            source,
          ): source is Manufacturer | "takara" =>
          ["bandai", "takara_tomy_arts", "takara"].includes(source),
        )
        .map((source) =>
          source === "takara" ? "takara_tomy_arts" : source,
        )
    : (["bandai", "takara_tomy_arts"] as Manufacturer[]);
  const maxPages = Number(getArgValue("max-pages") ?? "100");
  const maxProductsValue = getArgValue("max-products");
  const maxProducts = maxProductsValue ? Number(maxProductsValue) : null;
  const concurrency = Number(getArgValue("concurrency") ?? "3");
  const timeoutMs = Number(getArgValue("timeout-ms") ?? "15000");

  return {
    dryRun: process.argv.includes("--dry-run"),
    mode,
    sources: Array.from(new Set(sources)),
    maxPages: Number.isFinite(maxPages) && maxPages > 0 ? maxPages : 100,
    maxProducts:
      maxProducts !== null && Number.isFinite(maxProducts) && maxProducts > 0
        ? maxProducts
        : null,
    concurrency:
      Number.isFinite(concurrency) && concurrency > 0
        ? Math.min(Math.floor(concurrency), 5)
        : 3,
    timeoutMs:
      Number.isFinite(timeoutMs) && timeoutMs >= 5000 ? timeoutMs : 15000,
    output: getArgValue("output"),
  };
}

function textFromHtml(html: string) {
  return normalizeWhitespace(load(html).root().text());
}

function pickMetaImage(html: string, sourceUrl: string) {
  const $ = load(html);
  const candidates = [
    $('meta[property="og:image"]').attr("content"),
    $('meta[name="twitter:image"]').attr("content"),
    $("img").first().attr("src"),
  ];

  for (const candidate of candidates) {
    const url = absoluteUrl(candidate, sourceUrl);
    if (url) return url;
  }

  return null;
}

function extractPrice(text: string) {
  const match = text.match(/(?:税込)?\s*([0-9,]+)\s*円/);
  if (!match) return { price_jpy: null, raw_price_text: null };

  return {
    price_jpy: Number(match[1].replace(/,/g, "")),
    raw_price_text: normalizeWhitespace(match[0]),
  };
}

function extractRelease(text: string) {
  const monthMatch =
    text.match(/(20\d{2})[年./-]\s*(\d{1,2})\s*月?/) ??
    text.match(/(20\d{2})(\d{2})/);
  const weekMatch = text.match(
    /(20\d{2}\s*年\s*\d{1,2}\s*月\s*(?:第?\d+\s*週|上旬|中旬|下旬)?)/,
  );

  if (!monthMatch) {
    return { release_month: null, release_week_text: null };
  }

  const year = monthMatch[1];
  const month = monthMatch[2].padStart(2, "0");

  return {
    release_month: `${year}-${month}-01`,
    release_week_text: weekMatch ? normalizeWhitespace(weekMatch[1]) : null,
  };
}

function extractTypesCount(text: string) {
  const match = text.match(/(?:全|全種類|種類数)\s*(\d{1,3})\s*(?:種|種類)/);
  return match ? Number(match[1]) : null;
}

function extractJan(text: string, sourceUrl: string) {
  const urlJan = new URL(sourceUrl).searchParams.get("jan_code");
  if (urlJan) return urlJan;

  const match = text.match(/\b(45\d{11,15}|49\d{11,15})\b/);
  return match?.[1] ?? null;
}

function contentHash(product: ParsedGachaProduct) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        name: product.name,
        jan_code: product.jan_code,
        product_code: product.product_code,
        price_jpy: product.price_jpy,
        release_month: product.release_month,
        release_week_text: product.release_week_text,
        types_count: product.types_count,
        official_image_url: product.official_image_url,
        source_url: product.source_url,
      }),
    )
    .digest("hex");
}

function dedupeLinks(links: string[]) {
  return [...new Set(links)];
}

function dedupeProducts(products: ParsedGachaProduct[]) {
  const seen = new Set<string>();
  const deduped: ParsedGachaProduct[] = [];

  for (const product of products) {
    const key =
      product.jan_code ??
      product.product_code ??
      `${product.manufacturer}:${normalizeName(product.name)}:${product.release_month ?? ""}`;

    if (seen.has(key)) continue;

    seen.add(key);
    deduped.push(product);
  }

  return {
    products: deduped,
    duplicateCount: products.length - deduped.length,
  };
}

export function extractProductLinks(
  html: string,
  sourceUrl: string,
  manufacturer: Manufacturer,
) {
  const $ = load(html);
  const seen = new Set<string>();
  const links: string[] = [];

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    const url = absoluteUrl(href, sourceUrl);
    if (!url) return;

    const isProduct =
      manufacturer === "bandai"
        ? /\/products\/.*(?:detail|jan_code)/.test(url)
        : /\/items\/item\.html\?n=/.test(url);

    if (isProduct && !seen.has(url)) {
      seen.add(url);
      links.push(url);
    }
  });

  return links;
}

function buildBandaiFullPageUrl(pageIndex: number) {
  const url = new URL(FULL_SOURCE_URLS.bandai);
  url.searchParams.set("sort", "release_date_desc");
  url.searchParams.set("offset", String(pageIndex * 10));
  return url.toString();
}

function buildTakaraFullPageUrl(pageIndex: number) {
  const url = new URL(FULL_SOURCE_URLS.takara);
  url.searchParams.set("p", String(pageIndex + 1));
  return url.toString();
}

async function collectLinksFromPages(
  manufacturer: Manufacturer,
  mode: CollectionMode,
  maxPages: number,
) {
  if (mode === "current") {
    const sourceUrl =
      manufacturer === "bandai" ? SOURCE_URLS.bandai : SOURCE_URLS.takara;
    const html = await fetchHtml(sourceUrl);
    return dedupeLinks(extractProductLinks(html, sourceUrl, manufacturer));
  }

  const allLinks: string[] = [];
  const seen = new Set<string>();

  for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
    const pageUrl =
      manufacturer === "bandai"
        ? buildBandaiFullPageUrl(pageIndex)
        : buildTakaraFullPageUrl(pageIndex);
    let html: string;

    try {
      html = await fetchHtml(pageUrl);
    } catch (error) {
      if (manufacturer === "bandai" && pageIndex === 0) {
        const sourceUrl = SOURCE_URLS.bandai;
        const fallbackHtml = await fetchHtml(sourceUrl);
        return dedupeLinks(
          extractProductLinks(fallbackHtml, sourceUrl, manufacturer),
        );
      }

      throw error;
    }

    const pageLinks = extractProductLinks(html, pageUrl, manufacturer);
    let newLinks = 0;

    for (const link of pageLinks) {
      if (seen.has(link)) continue;
      seen.add(link);
      allLinks.push(link);
      newLinks += 1;
    }

    if (pageLinks.length === 0 || newLinks === 0) break;
  }

  return allLinks;
}

export function parseBandaiProduct(
  html: string,
  sourceUrl: string,
): ParsedGachaProduct {
  const $ = load(html);
  const text = textFromHtml(html);
  const name = cleanProductTitle(
    firstNonBlank(
      $("h1").first().text(),
      $('meta[property="og:title"]').attr("content") ||
        $("title").text(),
    ),
  );
  const janCode = extractJan(text, sourceUrl);
  const price = extractPrice(text);
  const release = extractRelease(text);

  if (!name) {
    throw new Error(`Failed to parse Bandai product name: ${sourceUrl}`);
  }

  return {
    manufacturer: "bandai",
    name,
    name_ja: name,
    jan_code: janCode,
    product_code: null,
    price_jpy: price.price_jpy,
    release_month: release.release_month,
    release_week_text: release.release_week_text,
    types_count: extractTypesCount(text),
    official_image_url: pickMetaImage(html, sourceUrl),
    source_url: sourceUrl,
    source_name: "bandai_gashapon",
    source_product_key: janCode ?? sourceUrl,
    raw_price_text: price.raw_price_text,
    raw_release_text: release.release_week_text,
  };
}

export function parseTakaraProduct(
  html: string,
  sourceUrl: string,
): ParsedGachaProduct {
  const $ = load(html);
  const text = textFromHtml(html);
  const name = cleanProductTitle(
    firstNonBlank(
      $(".itemName").first().text(),
      $(".item_name").first().text(),
      $(".name").first().text(),
      $("h1").first().text(),
      $('meta[property="og:title"]').attr("content") ||
        $("title").text(),
    ),
  );
  const productCode = new URL(sourceUrl).searchParams.get("n");
  const price = extractPrice(text);
  const release = extractRelease(text);

  if (!name) {
    throw new Error(`Failed to parse Takara Tomy Arts product name: ${sourceUrl}`);
  }

  return {
    manufacturer: "takara_tomy_arts",
    name,
    name_ja: name,
    jan_code: extractJan(text, sourceUrl),
    product_code: productCode,
    price_jpy: price.price_jpy,
    release_month: release.release_month,
    release_week_text: release.release_week_text,
    types_count: extractTypesCount(text),
    official_image_url: pickMetaImage(html, sourceUrl),
    source_url: sourceUrl,
    source_name: "takara_tomy_arts_gacha",
    source_product_key: productCode ?? sourceUrl,
    raw_price_text: price.raw_price_text,
    raw_release_text: release.release_week_text,
  };
}

async function fetchHtml(url: string, timeoutMs = 15000) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": "gacha-map-product-collector/1.0",
        },
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status}`);
      }

      return await response.text();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
    }
  }

  throw lastError;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
) {
  const results: R[] = [];
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );

  return results;
}

async function findExistingProduct(
  supabase: SupabaseClient,
  product: ParsedGachaProduct,
): Promise<ProductRecord | null> {
  if (product.jan_code) {
    const { data, error } = await supabase
      .from("gacha_products")
      .select("id")
      .eq("jan_code", product.jan_code)
      .maybeSingle();

    if (error) throw error;
    if (data) return data as ProductRecord;
  }

  if (product.product_code) {
    const { data, error } = await supabase
      .from("gacha_products")
      .select("id")
      .eq("manufacturer", product.manufacturer)
      .eq("product_code", product.product_code)
      .maybeSingle();

    if (error) throw error;
    if (data) return data as ProductRecord;
  }

  if (product.release_month) {
    const { data, error } = await supabase
      .from("gacha_products")
      .select("id")
      .eq("manufacturer", product.manufacturer)
      .eq("normalized_name", normalizeName(product.name))
      .eq("release_month", product.release_month)
      .maybeSingle();

    if (error) throw error;
    if (data) return data as ProductRecord;
  }

  return null;
}

export async function upsertProduct(
  supabase: SupabaseClient,
  product: ParsedGachaProduct,
) {
  const payload = {
    manufacturer: product.manufacturer,
    name: product.name,
    normalized_name: normalizeName(product.name),
    name_ja: product.name_ja,
    jan_code: product.jan_code,
    product_code: product.product_code,
    price_jpy: product.price_jpy,
    release_month: product.release_month,
    release_week_text: product.release_week_text,
    types_count: product.types_count,
    official_image_url: product.official_image_url,
    source_url: product.source_url,
    source_type: "official",
    status: "active",
    last_seen_at: new Date().toISOString(),
  };

  const existing = await findExistingProduct(supabase, product);
  const productResult = existing
    ? await supabase
        .from("gacha_products")
        .update(payload)
        .eq("id", existing.id)
        .select("id")
        .single()
    : await supabase.from("gacha_products").insert(payload).select("id").single();

  if (productResult.error) throw productResult.error;

  const productId = (productResult.data as ProductRecord).id;
  const { error: sourceError } = await supabase
    .from("gacha_product_sources")
    .upsert(
      {
        product_id: productId,
        source_name: product.source_name,
        source_url: product.source_url,
        source_product_key: product.source_product_key,
        raw_name: product.name,
        raw_price_text: product.raw_price_text,
        raw_release_text: product.raw_release_text,
        raw_image_url: product.official_image_url,
        fetched_at: new Date().toISOString(),
        content_hash: contentHash(product),
      },
      { onConflict: "source_name,source_product_key" },
    );

  if (sourceError) throw sourceError;

  return productId;
}

async function collectManufacturer(
  manufacturer: Manufacturer,
  options: CliOptions,
): Promise<CollectResult> {
  const links = await collectLinksFromPages(
    manufacturer,
    options.mode,
    options.maxPages,
  );
  const limitedLinks =
    options.maxProducts === null ? links : links.slice(0, options.maxProducts);
  let completed = 0;

  console.error(
    `[${manufacturer}] collected ${links.length} links; parsing ${limitedLinks.length} detail pages`,
  );

  const collected = await mapWithConcurrency(
    limitedLinks,
    options.concurrency,
    async (link) => {
      try {
        const detailHtml = await fetchHtml(link, options.timeoutMs);
        return {
          product:
            manufacturer === "bandai"
              ? parseBandaiProduct(detailHtml, link)
              : parseTakaraProduct(detailHtml, link),
          error: null,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          product: null,
          error: `${link}: ${message}`,
        };
      } finally {
        completed += 1;
        if (completed % 50 === 0 || completed === limitedLinks.length) {
          console.error(
            `[${manufacturer}] parsed ${completed}/${limitedLinks.length}`,
          );
        }
      }
    },
  );

  const products = collected
    .map((item) => item.product)
    .filter((product): product is ParsedGachaProduct => product !== null);
  const errors = collected
    .map((item) => item.error)
    .filter((error): error is string => error !== null);
  const deduped = dedupeProducts(products);

  return {
    products: deduped.products,
    errors,
    links,
    duplicateCount: deduped.duplicateCount,
  };
}

async function main() {
  loadCollectorEnv();

  const options = parseCliOptions();
  const results: CollectResult[] = [];

  for (const manufacturer of options.sources) {
    results.push(await collectManufacturer(manufacturer, options));
  }

  const products = results.flatMap((result) => result.products);
  const errors = results.flatMap((result) => result.errors);
  const links = dedupeLinks(results.flatMap((result) => result.links));
  const duplicateCount = results.reduce(
    (total, result) => total + result.duplicateCount,
    0,
  );
  const summary = {
    mode: options.mode,
    sources: options.sources,
    linkCount: links.length,
    parsedCount: products.length,
    duplicateCount,
    errorCount: errors.length,
    errors,
    sample: products.slice(0, 5),
  };

  if (options.output) {
    writeFileSync(
      options.output,
      JSON.stringify({ ...summary, products }, null, 2),
      "utf8",
    );
  }

  if (options.dryRun) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  if (products.length === 0) {
    throw new Error("No gacha products collected.");
  }

  for (const error of errors) {
    console.warn(`Skipped product: ${error}`);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceRoleKey) throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  let saved = 0;

  for (const product of products) {
    await upsertProduct(supabase, product);
    saved += 1;
    if (saved % 50 === 0 || saved === products.length) {
      console.error(`Saved ${saved}/${products.length} gacha products`);
    }
  }

  console.log(`Collected ${products.length} gacha products.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
