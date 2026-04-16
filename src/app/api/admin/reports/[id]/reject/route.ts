import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdminAuth } from "@/lib/supabase/admin";
import type { AdminReportItem } from "@/types";

interface Props {
  params: Promise<{ id: string }>;
}

interface RequestBody {
  adminNote: string;
}

export async function POST(request: NextRequest, { params }: Props) {
  // Verify admin authentication
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

  // Validate adminNote
  if (!body.adminNote || typeof body.adminNote !== "string") {
    return NextResponse.json(
      { error: "adminNote is required and must be a string" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  // Update temporal shop to rejected with admin note
  const { data, error } = await supabase
    .from("temporal_shops")
    .update({
      status: "rejected",
      admin_note: body.adminNote,
    })
    .eq("id", id)
    .select(
      "id, name, address, lat, lng, description, tags, shop_id, submitter_name, submitter_contact, status, admin_note, created_at",
    )
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const report: AdminReportItem = data as AdminReportItem;

  return NextResponse.json({ report });
}
