import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdminAuth } from "@/lib/supabase/admin";
import type { AdminReportItem } from "@/types";

const DEFAULT_LIMIT = 50;

export async function GET(request: NextRequest) {
  const authResult = await verifyAdminAuth(request);
  if (!authResult.ok) {
    return authResult.response;
  }

  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status") ?? "pending";
  const rawOffset = parseInt(searchParams.get("offset") ?? "0", 10);
  const rawLimit = parseInt(
    searchParams.get("limit") ?? String(DEFAULT_LIMIT),
    10,
  );

  if (!["pending", "reviewed", "resolved"].includes(status)) {
    return NextResponse.json(
      { error: "Invalid status parameter" },
      { status: 400 },
    );
  }

  const offset = isNaN(rawOffset) || rawOffset < 0 ? 0 : rawOffset;
  const limit = isNaN(rawLimit) ? DEFAULT_LIMIT : Math.min(rawLimit, 100);

  const supabase = createAdminClient();

  const { data, error, count } = await supabase
    .from("reports")
    .select(
      "id, shop_id, report_type, reporter_name, reporter_contact, content, status, created_at, shops(name)",
      { count: "exact" },
    )
    .eq("status", status)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const reports: AdminReportItem[] = (data ?? []).map((row) => ({
    id: row.id,
    shop_id: row.shop_id,
    shop_name: (row.shops as { name: string }[] | null)?.[0]?.name ?? null,
    report_type: row.report_type,
    reporter_name: row.reporter_name,
    reporter_contact: row.reporter_contact,
    content: row.content,
    status: row.status,
    created_at: row.created_at,
  }));

  return NextResponse.json({
    reports,
    total: count ?? 0,
    offset,
    limit,
  });
}
