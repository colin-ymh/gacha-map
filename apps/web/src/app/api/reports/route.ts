import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import type { ReportType } from "@/types";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("reports")
    .select(
      "id, shop_id, report_type, content, status, created_at, shops(id, name)",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const reports = (data ?? []).map((r) => {
    const { shops, ...rest } = r as typeof r & {
      shops: { id: string; name: string } | null;
    };
    return { ...rest, shop_name: shops?.name ?? null };
  });

  return NextResponse.json({ reports, total: reports.length });
}

const VALID_TYPES: ReportType[] = ["new_shop", "fix_info", "closed", "other"];

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const { report_type, content, shop_id } = body as Record<string, unknown>;

  if (!VALID_TYPES.includes(report_type as ReportType)) {
    return NextResponse.json(
      {
        error: "report_type must be one of: new_shop, fix_info, closed, other",
      },
      { status: 400 },
    );
  }

  if (typeof content !== "string" || content.trim().length < 10) {
    return NextResponse.json(
      { error: "content must be at least 10 characters" },
      { status: 400 },
    );
  }

  if (content.length > 1000) {
    return NextResponse.json(
      { error: "content must be 1000 characters or fewer" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from("reports")
    .insert({
      report_type: report_type as ReportType,
      content: content.trim(),
      shop_id: typeof shop_id === "string" ? shop_id : null,
      user_id: user?.id ?? null,
      reporter_name: null,
      reporter_contact: null,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
