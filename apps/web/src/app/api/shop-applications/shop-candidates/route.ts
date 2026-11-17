import { NextRequest, NextResponse } from "next/server";
import type { ShopApplicationCandidate } from "@gacha-map/shared/src/hooks/useShopApplicationCandidates";
import { createAdminClient, createAuthenticatedClient } from "@/lib/supabase/server";

const MAX_CANDIDATES = 5;
const QUERY_LIMIT = 60;

function normalize(name: string): string {
  return name.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

function oneEditApart(first: string, second: string): boolean {
  const a = [...first];
  const b = [...second];
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) return a.slice(i + 1).join("") === b.slice(i + 1).join("");
  const [longer, shorter] = a.length > b.length ? [a, b] : [b, a];
  return longer.slice(i + 1).join("") === shorter.slice(i).join("");
}

function rank(name: string, query: string): number {
  const value = normalize(name);
  if (value === query) return 4;
  if (value.startsWith(query)) return 3;
  if (value.includes(query)) return 2;
  if ([...query].length >= 3 && oneEditApart(value, query)) return 1;
  return 0;
}

export async function GET(request: NextRequest) {
  const { user } = await createAuthenticatedClient(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rawQuery = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (rawQuery.length > 100) {
    return NextResponse.json({ error: "Query is too long" }, { status: 400 });
  }
  const query = normalize(rawQuery);
  const chars = [...query];
  if (chars.length < 2) return NextResponse.json({ candidates: [] });

  const supabase = createAdminClient();
  const spaced = chars.join("%");
  const anchorSize = Math.floor(chars.length / 2);
  const patterns = new Set([spaced, `%${spaced}%`]);
  if (chars.length >= 3) {
    patterns.add(`%${chars.slice(0, anchorSize).join("%")}%`);
    patterns.add(`%${chars.slice(-anchorSize).join("%")}%`);
  }

  const batches = await Promise.all([...patterns].map((pattern) =>
    supabase.from("shops")
      .select("id, name, address")
      .eq("status", "active")
      .is("owner_id", null)
      .ilike("name", pattern)
      .order("name")
      .order("id")
      .limit(QUERY_LIMIT),
  ));
  if (batches.some(({ error }) => error)) {
    return NextResponse.json({ error: "Unable to search shops" }, { status: 500 });
  }

  const shops = new Map(batches.flatMap(({ data }) => data ?? []).map((shop) => [shop.id, shop]));
  const candidates: ShopApplicationCandidate[] = [...shops.values()]
    .map((shop) => ({ shop, score: rank(shop.name, query) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score ||
      a.shop.name.localeCompare(b.shop.name, "ko") ||
      (a.shop.address ?? "").localeCompare(b.shop.address ?? "", "ko") ||
      a.shop.id.localeCompare(b.shop.id))
    .slice(0, MAX_CANDIDATES)
    .map(({ shop }) => ({
      id: shop.id,
      name: shop.name,
      address: shop.address,
      claimable: true,
    }));

  return NextResponse.json({ candidates });
}
