import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const limitParam = parseInt(searchParams.get("limit") ?? "20", 10);
  const limit = Math.min(50, Math.max(1, isNaN(limitParam) ? 20 : limitParam));

  const supabase = createAdminClient();

  let query = supabase
    .from("gacha_products")
    .select(
      "id, manufacturer, name, name_ja, name_ko, name_en, price_jpy, release_month, official_image_url, status",
    )
    .eq("status", "active")
    .limit(limit);

  if (q) {
    const escaped = q.replace(/[%_\\]/g, "\\$&");
    query = query.or(
      `name.ilike.%${escaped}%,name_ko.ilike.%${escaped}%,name_en.ilike.%${escaped}%,manufacturer.ilike.%${escaped}%`,
    );
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ products: data ?? [] });
}
