import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { GachaBrowseSort, GachaProductWithShops } from "@/types";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const SORTS: GachaBrowseSort[] = ["popular", "recent", "name"];

function parsePagination(searchParams: URLSearchParams) {
  const rawOffset = parseInt(searchParams.get("offset") ?? "0", 10);
  const rawLimit = parseInt(
    searchParams.get("limit") ?? String(DEFAULT_LIMIT),
    10,
  );

  const offset = isNaN(rawOffset) || rawOffset < 0 ? 0 : rawOffset;
  const limit = isNaN(rawLimit) ? DEFAULT_LIMIT : Math.min(rawLimit, MAX_LIMIT);

  return { offset, limit };
}

/** `a,b,c` 형태를 uuid 배열로. 빈 값이면 null 을 돌려줘야 RPC 가 "필터 없음"으로 본다. */
function parseIds(raw: string | null): string[] | null {
  if (!raw) return null;
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.length > 0 ? ids : null;
}

/**
 * GET /api/gacha-browse/products
 *
 * 진입 축과 필터 축을 구분하지 않고 한 배열로 합쳐 코어 RPC 에 넘긴다.
 * browse_gacha_products 가 category_type 으로 축을 나눠 축 안 OR / 축 간 AND 로
 * 평가하므로, 호출자는 그냥 전부 넘기면 된다. 기획서 §17-4 / §17-6.
 *
 * 쿼리:
 *   categoryId          진입 축이 카테고리일 때
 *   seriesId            진입 축이 시리즈일 때
 *   filterCategoryIds   드롭다운으로 고른 카테고리 (쉼표 구분)
 *   filterSeriesIds     드롭다운으로 고른 시리즈 (쉼표 구분)
 *   includeDescendants  시리즈 진입 시 자손 포함 여부. 기본 true
 *   sort                popular | recent | name. 기본 popular
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const { offset, limit } = parsePagination(searchParams);

  const rawSort = searchParams.get("sort") ?? "popular";
  if (!SORTS.includes(rawSort as GachaBrowseSort)) {
    return NextResponse.json(
      { error: `unsupported sort: ${rawSort}` },
      { status: 400 },
    );
  }

  const categoryId = searchParams.get("categoryId");
  const seriesId = searchParams.get("seriesId");
  const filterCategoryIds = parseIds(searchParams.get("filterCategoryIds"));
  const filterSeriesIds = parseIds(searchParams.get("filterSeriesIds"));

  if (!categoryId && !seriesId && !filterCategoryIds && !filterSeriesIds) {
    return NextResponse.json(
      { error: "at least one of categoryId, seriesId or a filter is required" },
      { status: 400 },
    );
  }

  const categoryIds = [
    ...(categoryId ? [categoryId] : []),
    ...(filterCategoryIds ?? []),
  ];
  const seriesIds = [
    ...(seriesId ? [seriesId] : []),
    ...(filterSeriesIds ?? []),
  ];

  // 기본 true. 부모 시리즈로 진입하면 자손 상품까지 보여야 한다. 기획서 §7-3.
  const includeDescendants = searchParams.get("includeDescendants") !== "false";

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("browse_gacha_products", {
    p_category_ids: categoryIds.length > 0 ? categoryIds : null,
    p_series_ids: seriesIds.length > 0 ? seriesIds : null,
    p_include_descendants: includeDescendants,
    p_sort: rawSort,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as (GachaProductWithShops & {
    total_count: number;
  })[];

  const products = rows.map((row) => ({
    ...row,
    display_name: row.name_ko ?? row.name_ja ?? row.name,
  }));

  return NextResponse.json({
    products,
    total: rows[0]?.total_count ?? 0,
    offset,
    limit,
  });
}
