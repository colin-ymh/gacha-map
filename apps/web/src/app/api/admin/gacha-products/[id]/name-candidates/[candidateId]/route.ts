import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdminAuth } from "@/lib/supabase/admin";
import type {
  GachaProductNameCandidate,
  GachaProductNameCandidateStatus,
} from "@/types";

const STATUSES: GachaProductNameCandidateStatus[] = [
  "pending",
  "approved",
  "rejected",
];

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

interface Props {
  params: Promise<{ id: string; candidateId: string }>;
}

interface RequestBody {
  status?: GachaProductNameCandidateStatus;
  is_primary?: boolean;
  name?: string;
}

export async function PATCH(request: NextRequest, { params }: Props) {
  const authResult = await verifyAdminAuth(request);
  if (!authResult.ok) {
    return authResult.response;
  }

  const { id, candidateId } = await params;

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.status && !STATUSES.includes(body.status)) {
    return NextResponse.json(
      { error: "Invalid status value" },
      { status: 400 },
    );
  }

  const shouldApprove = body.status === "approved" || body.is_primary === true;
  const supabase = createAdminClient();

  if (shouldApprove) {
    const { data: existing, error: findError } = await supabase
      .from("gacha_product_name_candidates")
      .select("id")
      .eq("id", candidateId)
      .eq("product_id", id)
      .maybeSingle();

    if (findError) {
      return NextResponse.json({ error: findError.message }, { status: 500 });
    }

    if (!existing) {
      return NextResponse.json(
        { error: "Gacha product name candidate not found" },
        { status: 404 },
      );
    }

    const { data, error } = await supabase.rpc(
      "approve_gacha_product_name_candidate",
      {
        candidate_id: candidateId,
        reviewer_id: authResult.user.id,
      },
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      candidate: data as GachaProductNameCandidate,
    });
  }

  const hasNameUpdate =
    typeof body.name === "string" && body.name.trim().length > 0;
  const hasStatusUpdate = !!body.status;

  if (!hasNameUpdate && !hasStatusUpdate) {
    return NextResponse.json(
      { error: "At least one editable field must be provided" },
      { status: 400 },
    );
  }

  const updatePayload: Record<string, unknown> = {};

  if (hasNameUpdate) {
    const trimmedName = (body.name as string).trim();
    updatePayload.name = trimmedName;
    updatePayload.normalized_name = normalizeName(trimmedName);
  }

  if (hasStatusUpdate) {
    updatePayload.status = body.status;
    updatePayload.is_primary = false;
    updatePayload.reviewed_by = authResult.user.id;
    updatePayload.reviewed_at = new Date().toISOString();
  }

  let wasPrimary = false;
  if (hasNameUpdate && !hasStatusUpdate) {
    const { data: current } = await supabase
      .from("gacha_product_name_candidates")
      .select("is_primary")
      .eq("id", candidateId)
      .eq("product_id", id)
      .maybeSingle();
    wasPrimary = current?.is_primary ?? false;
  }

  const { data, error } = await supabase
    .from("gacha_product_name_candidates")
    .update(updatePayload)
    .eq("id", candidateId)
    .eq("product_id", id)
    .select("*")
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json(
        { error: "Gacha product name candidate not found" },
        { status: 404 },
      );
    }
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "A candidate with this name already exists" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (wasPrimary && hasNameUpdate) {
    await supabase
      .from("gacha_products")
      .update({ name_ko: updatePayload.name as string })
      .eq("id", id);
  }

  return NextResponse.json({
    candidate: data as GachaProductNameCandidate,
  });
}
