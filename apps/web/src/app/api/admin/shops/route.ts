import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdminAuth } from "@/lib/supabase/admin";
import type { AdminShopItem } from "@/types";

const DEFAULT_LIMIT = 50;

function escapePostgrestPattern(value: string): string {
  return value.replace(/[%_]/g, (match) => `\\${match}`);
}

export async function GET(request: NextRequest) {
  // Verify admin authentication
  const authResult = await verifyAdminAuth(request);
  if (!authResult.ok) {
    return authResult.response;
  }

  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status") ?? "active";
  const q = searchParams.get("q");
  const rawOffset = parseInt(searchParams.get("offset") ?? "0", 10);
  const rawLimit = parseInt(
    searchParams.get("limit") ?? String(DEFAULT_LIMIT),
    10,
  );

  // Validate status parameter
  if (!["active", "hidden", "archived"].includes(status)) {
    return NextResponse.json(
      { error: "Invalid status parameter" },
      { status: 400 },
    );
  }

  const offset = isNaN(rawOffset) || rawOffset < 0 ? 0 : rawOffset;
  const limit = isNaN(rawLimit) ? DEFAULT_LIMIT : Math.min(rawLimit, 100);

  const supabase = createAdminClient();

  let query = supabase
    .from("shops")
    .select(
      "id, name, address, lat, lng, is_authorized, status, created_at, owner_id, hidden_reason, opening_hours",
      { count: "exact" },
    )
    .eq("status", status)
    .order("created_at", { ascending: false });

  if (q) {
    const pattern = `%${escapePostgrestPattern(q)}%`;
    query = query.or(`name.ilike.${pattern},address.ilike.${pattern}`);
  }

  const { data, error, count } = await query.range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const shops: AdminShopItem[] = data as AdminShopItem[];

  // Attach quick report counts
  const shopIds = shops.map((s) => s.id);
  if (shopIds.length > 0) {
    const { data: qrData } = await supabase
      .from("shop_quick_reports")
      .select("shop_id, kind")
      .in("shop_id", shopIds);

    if (qrData) {
      const counts: Record<string, { present: number; absent: number }> = {};
      for (const row of qrData) {
        if (!counts[row.shop_id])
          counts[row.shop_id] = { present: 0, absent: 0 };
        if (row.kind === "gacha_present") counts[row.shop_id].present++;
        else if (row.kind === "gacha_absent") counts[row.shop_id].absent++;
      }
      for (const shop of shops) {
        const c = counts[shop.id];
        shop.quick_report_present = c?.present ?? 0;
        shop.quick_report_absent = c?.absent ?? 0;
      }
    }
  }

  return NextResponse.json({
    shops,
    total: count ?? 0,
    offset,
    limit,
  });
}
