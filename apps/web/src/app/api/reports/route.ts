import { NextRequest, NextResponse } from "next/server";
import {
  createAdminClient,
  createAuthenticatedClient,
} from "@/lib/supabase/server";
import type { ReportType } from "@/types";

export async function GET(request: NextRequest) {
  const { supabase, user } = await createAuthenticatedClient(request);

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
const REPORT_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const REPORT_RATE_LIMIT_MAX = 5;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getRateLimitKey(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0];
  return (
    forwardedFor?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

export async function POST(request: NextRequest) {
  const rateLimitKey = `report:${getRateLimitKey(request)}`;
  try {
    const adminClient = createAdminClient();
    const { data: allowed, error: rlError } = await adminClient.rpc(
      "check_rate_limit",
      {
        p_key: rateLimitKey,
        p_max: REPORT_RATE_LIMIT_MAX,
        p_window_ms: REPORT_RATE_LIMIT_WINDOW_MS,
      },
    );
    if (!rlError && allowed === false) {
      return NextResponse.json(
        { error: "Too many reports. Please try again later." },
        { status: 429 },
      );
    }
  } catch {
    // DB 오류 시 fail-open (요청 허용)
  }

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

  const { report_type, content, shop_id, reporter_name, reporter_contact } =
    body as Record<string, unknown>;
  const trimmedContent = typeof content === "string" ? content.trim() : "";
  const trimmedReporterName =
    typeof reporter_name === "string" ? reporter_name.trim() : null;
  const trimmedReporterContact =
    typeof reporter_contact === "string" ? reporter_contact.trim() : null;

  if (!VALID_TYPES.includes(report_type as ReportType)) {
    return NextResponse.json(
      {
        error: "report_type must be one of: new_shop, fix_info, closed, other",
      },
      { status: 400 },
    );
  }

  if (trimmedContent.length < 10) {
    return NextResponse.json(
      { error: "content must be at least 10 characters" },
      { status: 400 },
    );
  }

  if (trimmedContent.length > 1000) {
    return NextResponse.json(
      { error: "content must be 1000 characters or fewer" },
      { status: 400 },
    );
  }

  if (
    shop_id !== undefined &&
    shop_id !== null &&
    typeof shop_id !== "string"
  ) {
    return NextResponse.json(
      { error: "shop_id must be a valid UUID string" },
      { status: 400 },
    );
  }

  if (typeof shop_id === "string" && !UUID_PATTERN.test(shop_id)) {
    return NextResponse.json(
      { error: "shop_id must be a valid UUID string" },
      { status: 400 },
    );
  }

  if (reporter_name !== undefined && reporter_name !== null) {
    if (typeof reporter_name !== "string" || trimmedReporterName!.length > 50) {
      return NextResponse.json(
        { error: "reporter_name must be 50 characters or fewer" },
        { status: 400 },
      );
    }
  }

  if (reporter_contact !== undefined && reporter_contact !== null) {
    if (
      typeof reporter_contact !== "string" ||
      trimmedReporterContact!.length > 100
    ) {
      return NextResponse.json(
        { error: "reporter_contact must be 100 characters or fewer" },
        { status: 400 },
      );
    }
  }

  const { user } = await createAuthenticatedClient(request);

  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from("reports")
    .insert({
      report_type: report_type as ReportType,
      content: trimmedContent,
      shop_id: typeof shop_id === "string" ? shop_id : null,
      user_id: user?.id ?? null,
      reporter_name: trimmedReporterName || null,
      reporter_contact: trimmedReporterContact || null,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
