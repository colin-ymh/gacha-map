import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdminAuth } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 50;
const VALID_STATUSES = ["needs_review", "matched", "rejected"] as const;

export async function GET(request: NextRequest) {
  const authResult = await verifyAdminAuth(request);
  if (!authResult.ok) return authResult.response;

  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status") ?? "needs_review";
  const rawOffset = parseInt(searchParams.get("offset") ?? "0", 10);
  const rawLimit = parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10);
  const offset = isNaN(rawOffset) || rawOffset < 0 ? 0 : rawOffset;
  const limit = isNaN(rawLimit) ? DEFAULT_LIMIT : Math.min(rawLimit, 100);

  const supabase = createAdminClient();

  let query = supabase
    .from("gacha_product_observations")
    .select(`
      id, status, source_type,
      observed_title_ko, observed_title_ja,
      manufacturer_hint, price_krw,
      image_url, raw_vision,
      shop_id, shops(name),
      created_at
    `, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
    query = query.eq("status", status);
  }

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ observations: data ?? [], total: count ?? 0 });
}
