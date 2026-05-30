import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdminAuth } from "@/lib/supabase/admin";
import type {
  AdminGachaProductItem,
  AdminGachaProductPendingCandidate,
  GachaProductStatus,
} from "@/types";

const DEFAULT_LIMIT = 50;
const PRODUCT_STATUSES: GachaProductStatus[] = ["active", "hidden", "archived"];

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

function withDisplayName(product: Omit<AdminGachaProductItem, "display_name">) {
  return {
    ...product,
    display_name: product.name_ko ?? product.name_ja ?? product.name,
  };
}

export async function GET(request: NextRequest) {
  const authResult = await verifyAdminAuth(request);
  if (!authResult.ok) {
    return authResult.response;
  }

  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status") ?? "active";
  const manufacturer = searchParams.get("manufacturer");
  const q = searchParams.get("q");
  const nameMissing = searchParams.get("name_missing") === "true";
  const { offset, limit } = parsePagination(searchParams);

  if (!PRODUCT_STATUSES.includes(status as GachaProductStatus)) {
    return NextResponse.json(
      { error: "Invalid status parameter" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  let query = supabase
    .from("gacha_products")
    .select(
      [
        "id",
        "manufacturer",
        "name",
        "normalized_name",
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
    .eq("status", status)
    .order("updated_at", { ascending: false });

  if (manufacturer) {
    query = query.eq("manufacturer", manufacturer);
  }

  if (nameMissing) {
    query = query.is("name_ko", null);
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

  const products = (data ?? []) as unknown as Array<
    Omit<AdminGachaProductItem, "display_name">
  >;

  const pendingCandidatesByProductId: Record<
    string,
    AdminGachaProductPendingCandidate
  > = {};

  if (nameMissing && products.length > 0) {
    const productIds = products.map((p) => p.id);
    const { data: candidateRows } = await supabase
      .from("gacha_product_name_candidates")
      .select("id, product_id, name, status, source_type")
      .in("product_id", productIds)
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (candidateRows) {
      for (const row of candidateRows) {
        if (!pendingCandidatesByProductId[row.product_id]) {
          pendingCandidatesByProductId[row.product_id] = {
            id: row.id,
            name: row.name,
            status: row.status,
            source_type: row.source_type,
          };
        }
      }
    }
  }

  return NextResponse.json({
    products: products.map((p) => ({
      ...withDisplayName(p),
      ...(nameMissing
        ? { pending_candidate: pendingCandidatesByProductId[p.id] ?? null }
        : {}),
    })),
    total: count ?? 0,
    offset,
    limit,
  });
}
