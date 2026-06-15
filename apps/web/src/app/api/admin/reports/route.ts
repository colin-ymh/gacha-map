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
      "id, shop_id, user_id, report_type, reporter_name, reporter_contact, content, status, proposed_shop_name, proposed_address, proposed_lat, proposed_lng, created_at, shops(name)",
      { count: "exact" },
    )
    .eq("status", status)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data ?? [];

  // Batch-fetch user profiles and emails for logged-in reporters
  const userIds = [
    ...new Set(rows.map((r) => r.user_id).filter(Boolean) as string[]),
  ];

  const profileMap: Record<
    string,
    { nickname: string | null; created_at: string }
  > = {};
  const emailMap: Record<string, string> = {};

  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("user_id, nickname, created_at")
      .in("user_id", userIds);

    for (const p of profiles ?? []) {
      profileMap[p.user_id] = {
        nickname: p.nickname ?? null,
        created_at: p.created_at,
      };
    }

    await Promise.all(
      userIds.map(async (uid) => {
        const { data: authData } = await supabase.auth.admin.getUserById(uid);
        if (authData?.user?.email) {
          emailMap[uid] = authData.user.email;
        }
      }),
    );
  }

  const reports: AdminReportItem[] = rows.map((row) => {
    const uid = row.user_id ?? null;
    const profile = uid ? (profileMap[uid] ?? null) : null;
    return {
      id: row.id,
      shop_id: row.shop_id,
      shop_name: (row.shops as { name: string }[] | null)?.[0]?.name ?? null,
      report_type: row.report_type,
      reporter_name: row.reporter_name,
      reporter_contact: row.reporter_contact,
      content: row.content,
      status: row.status,
      proposed_shop_name: row.proposed_shop_name ?? null,
      proposed_address: row.proposed_address ?? null,
      proposed_lat: row.proposed_lat ?? null,
      proposed_lng: row.proposed_lng ?? null,
      created_at: row.created_at,
      user_id: uid,
      user_nickname: profile?.nickname ?? null,
      user_email: uid ? (emailMap[uid] ?? null) : null,
      user_created_at: profile?.created_at ?? null,
    };
  });

  return NextResponse.json({
    reports,
    total: count ?? 0,
    offset,
    limit,
  });
}
