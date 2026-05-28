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

interface Props {
  params: Promise<{ id: string; candidateId: string }>;
}

interface RequestBody {
  status?: GachaProductNameCandidateStatus;
  is_primary?: boolean;
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

  const shouldApprove =
    body.status === "approved" || body.is_primary === true;
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

  if (!body.status) {
    return NextResponse.json(
      { error: "At least one editable field must be provided" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("gacha_product_name_candidates")
    .update({
      status: body.status,
      is_primary: false,
      reviewed_by: authResult.user.id,
      reviewed_at: new Date().toISOString(),
    })
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    candidate: data as GachaProductNameCandidate,
  });
}
