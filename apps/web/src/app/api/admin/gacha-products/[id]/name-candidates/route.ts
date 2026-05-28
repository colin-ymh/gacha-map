import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdminAuth } from "@/lib/supabase/admin";
import type {
  GachaProductNameCandidate,
  GachaProductNameCandidateSourceType,
  GachaProductNameCandidateStatus,
} from "@/types";

const SOURCE_TYPES: GachaProductNameCandidateSourceType[] = [
  "official_ko",
  "domestic_vendor",
  "admin",
  "machine",
  "user_alias",
];
const STATUSES: GachaProductNameCandidateStatus[] = [
  "pending",
  "approved",
  "rejected",
];

interface Props {
  params: Promise<{ id: string }>;
}

interface RequestBody {
  name?: string;
  source_type?: GachaProductNameCandidateSourceType;
  source_name?: string;
  source_url?: string | null;
  source_product_key?: string | null;
  confidence?: number | null;
  status?: GachaProductNameCandidateStatus;
  is_primary?: boolean;
}

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function readNullableString(value: unknown) {
  if (value === undefined || value === null) return null;
  return typeof value === "string" ? value.trim() || null : undefined;
}

function readConfidence(value: unknown) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || value < 0 || value > 1) return undefined;
  return value;
}

export async function GET(request: NextRequest, { params }: Props) {
  const authResult = await verifyAdminAuth(request);
  if (!authResult.ok) {
    return authResult.response;
  }

  const { id } = await params;
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("gacha_product_name_candidates")
    .select("*")
    .eq("product_id", id)
    .eq("locale", "ko")
    .order("is_primary", { ascending: false })
    .order("status", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    candidates: (data ?? []) as GachaProductNameCandidate[],
  });
}

export async function POST(request: NextRequest, { params }: Props) {
  const authResult = await verifyAdminAuth(request);
  if (!authResult.ok) {
    return authResult.response;
  }

  const { id } = await params;

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.name !== "string" || body.name.trim().length === 0) {
    return NextResponse.json({ error: "Invalid name value" }, { status: 400 });
  }

  const sourceType = body.source_type ?? "admin";
  if (!SOURCE_TYPES.includes(sourceType)) {
    return NextResponse.json(
      { error: "Invalid source_type value" },
      { status: 400 },
    );
  }

  const status = body.status ?? "pending";
  if (!STATUSES.includes(status)) {
    return NextResponse.json(
      { error: "Invalid status value" },
      { status: 400 },
    );
  }

  const sourceName = body.source_name?.trim() || sourceType;
  const sourceUrl = readNullableString(body.source_url);
  const sourceProductKey = readNullableString(body.source_product_key);
  const confidence = readConfidence(body.confidence);

  if (sourceUrl === undefined || sourceProductKey === undefined) {
    return NextResponse.json(
      { error: "Invalid source URL or product key" },
      { status: 400 },
    );
  }

  if (confidence === undefined) {
    return NextResponse.json(
      { error: "Invalid confidence value" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const candidatePayload = {
    product_id: id,
    locale: "ko",
    name: body.name.trim(),
    normalized_name: normalizeName(body.name),
    source_type: sourceType,
    source_name: sourceName,
    source_url: sourceUrl,
    source_product_key: sourceProductKey,
    confidence,
    status,
    is_primary: false,
    reviewed_by: status === "approved" ? authResult.user.id : null,
    reviewed_at: status === "approved" ? new Date().toISOString() : null,
  };

  const { data, error } = await supabase
    .from("gacha_product_name_candidates")
    .upsert(candidatePayload, {
      onConflict:
        "product_id,locale,normalized_name,source_type,source_name",
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (body.is_primary && status === "approved") {
    const { data: approved, error: approveError } = await supabase.rpc(
      "approve_gacha_product_name_candidate",
      {
        candidate_id: data.id,
        reviewer_id: authResult.user.id,
      },
    );

    if (approveError) {
      return NextResponse.json({ error: approveError.message }, { status: 500 });
    }

    return NextResponse.json({
      candidate: approved as GachaProductNameCandidate,
    });
  }

  return NextResponse.json({
    candidate: data as GachaProductNameCandidate,
  });
}
