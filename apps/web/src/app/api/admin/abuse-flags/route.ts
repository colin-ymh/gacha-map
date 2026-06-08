import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdminAuth } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const authResult = await verifyAdminAuth(request);
  if (!authResult.ok) {
    return authResult.response;
  }

  const { searchParams } = request.nextUrl;
  const reviewed = searchParams.get("reviewed");
  const page = Math.max(0, parseInt(searchParams.get("page") ?? "0", 10));
  const limit = Math.min(
    50,
    Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)),
  );

  const adminClient = createAdminClient();

  const from = page * limit;
  const to = from + limit - 1;

  let query = adminClient
    .from("abuse_flags")
    .select(
      "id, user_id, flag_type, detail, created_at, reviewed_at, reviewed_by",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (reviewed === "true") {
    query = query.not("reviewed_at", "is", null);
  } else if (reviewed === "false") {
    query = query.is("reviewed_at", null);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    flags: data ?? [],
    total: count ?? 0,
    hasMore: from + (data?.length ?? 0) < (count ?? 0),
  });
}
