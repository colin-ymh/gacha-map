import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdminAuth } from "@/lib/supabase/admin";
import type { AdminReportItem } from "@/types";

const DEFAULT_LIMIT = 50;

export async function GET(request: NextRequest) {
  // Verify admin authentication
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

  // Validate status parameter
  if (!["pending", "approved", "rejected"].includes(status)) {
    return NextResponse.json(
      { error: "Invalid status parameter" },
      { status: 400 },
    );
  }

  const offset = isNaN(rawOffset) || rawOffset < 0 ? 0 : rawOffset;
  const limit = isNaN(rawLimit) ? DEFAULT_LIMIT : Math.min(rawLimit, 100);

  const supabase = createAdminClient();

  const { data, error, count } = await supabase
    .from("temporal_shops")
    .select(
      "id, name, address, lat, lng, description, tags, shop_id, submitter_name, submitter_contact, status, admin_note, created_at",
      { count: "exact" },
    )
    .eq("status", status)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const reports: AdminReportItem[] = data as AdminReportItem[];

  return NextResponse.json({
    reports,
    total: count ?? 0,
    offset,
    limit,
  });
}
