import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdminAuth } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 50;
const VALID_STATUSES = [
  "needs_review",
  "pending",
  "searching",
  "imported",
  "no_match",
  "failed",
] as const;
type DiscoveryStatus = (typeof VALID_STATUSES)[number];

export async function GET(request: NextRequest) {
  const authResult = await verifyAdminAuth(request);
  if (!authResult.ok) return authResult.response;

  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status") ?? "needs_review";
  const rawOffset = parseInt(searchParams.get("offset") ?? "0", 10);
  const rawLimit = parseInt(
    searchParams.get("limit") ?? String(DEFAULT_LIMIT),
    10,
  );
  const offset = isNaN(rawOffset) || rawOffset < 0 ? 0 : rawOffset;
  const limit = isNaN(rawLimit) ? DEFAULT_LIMIT : Math.min(rawLimit, 100);

  const supabase = createAdminClient();

  let query = supabase
    .from("gacha_product_discovery_requests")
    .select(
      `
      id, status,
      extracted_title_ko, extracted_title_ja,
      manufacturer_hint, price_krw,
      image_url, raw_vision, raw_ocr,
      jan_code, attempt_count, error_message,
      candidate_urls, admin_note,
      user_manual_product_id,
      matched_product_id, matched_product:gacha_products!matched_product_id(id, name, name_ko, official_image_url),
      observation_id,
      shop_id, shops(name),
      created_at, updated_at
    `,
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (VALID_STATUSES.includes(status as DiscoveryStatus)) {
    query = query.eq("status", status);
  }

  const { data, error, count } = await query;
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ requests: data ?? [], total: count ?? 0 });
}

const ADMIN_NOTE_MAX_LENGTH = 1000;

interface PatchBody {
  id: string;
  status?: DiscoveryStatus;
  error_message?: string | null;
  candidate_urls?: unknown;
  admin_note?: string | null;
}

export async function PATCH(request: NextRequest) {
  const authResult = await verifyAdminAuth(request);
  if (!authResult.ok) return authResult.response;

  let body: PatchBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { id, status, error_message, candidate_urls, admin_note } = body;
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  if (status && !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }
  if (
    admin_note !== undefined &&
    admin_note !== null &&
    typeof admin_note !== "string"
  ) {
    return NextResponse.json({ error: "invalid admin_note" }, { status: 400 });
  }
  if (
    typeof admin_note === "string" &&
    admin_note.length > ADMIN_NOTE_MAX_LENGTH
  ) {
    return NextResponse.json(
      { error: `admin_note too long (max ${ADMIN_NOTE_MAX_LENGTH})` },
      { status: 400 },
    );
  }

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (status !== undefined) update.status = status;
  if (error_message !== undefined) update.error_message = error_message;
  if (candidate_urls !== undefined) update.candidate_urls = candidate_urls;
  if (admin_note !== undefined) {
    const trimmed = typeof admin_note === "string" ? admin_note.trim() : null;
    update.admin_note = trimmed ? trimmed : null;
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("gacha_product_discovery_requests")
    .update(update)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
