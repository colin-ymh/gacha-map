import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { GachaProduct } from "@/types";

const DEFAULT_LIMIT = 20;

function parsePagination(searchParams: URLSearchParams) {
  const rawOffset = parseInt(searchParams.get("offset") ?? "0", 10);
  const rawLimit = parseInt(
    searchParams.get("limit") ?? String(DEFAULT_LIMIT),
    10,
  );

  const offset = isNaN(rawOffset) || rawOffset < 0 ? 0 : rawOffset;
  const limit = isNaN(rawLimit) ? DEFAULT_LIMIT : Math.min(rawLimit, 100);

  return { offset, limit };
}

function toPostgrestSearchTerm(value: string) {
  return value.trim().replace(/[%,()]/g, "");
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q");
  const manufacturer = searchParams.get("manufacturer");
  const { offset, limit } = parsePagination(searchParams);

  const supabase = await createClient();

  let query = supabase
    .from("gacha_products")
    .select(
      [
        "id",
        "manufacturer",
        "name",
        "name_ja",
        "name_ko",
        "name_en",
        "jan_code",
        "product_code",
        "price_jpy",
        "release_month",
        "release_week_text",
        "types_count",
        "official_image_url",
        "source_url",
        "source_type",
        "status",
        "created_at",
        "updated_at",
        "last_seen_at",
      ].join(", "),
      { count: "exact" },
    )
    .eq("status", "active")
    .order("release_month", { ascending: false, nullsFirst: false })
    .order("name", { ascending: true });

  if (manufacturer) {
    query = query.eq("manufacturer", manufacturer);
  }

  if (q) {
    const term = toPostgrestSearchTerm(q);
    if (term) {
      query = query.or(
        [
          `name.ilike.%${term}%`,
          `name_ja.ilike.%${term}%`,
          `name_ko.ilike.%${term}%`,
          `name_en.ilike.%${term}%`,
          `jan_code.ilike.%${term}%`,
          `product_code.ilike.%${term}%`,
        ].join(","),
      );
    }
  }

  const { data, error, count } = await query.range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    products: (data ?? []) as unknown as GachaProduct[],
    total: count ?? 0,
    offset,
    limit,
  });
}
