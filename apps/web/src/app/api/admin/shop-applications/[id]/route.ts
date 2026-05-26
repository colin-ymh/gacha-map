import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdminAuth } from "@/lib/supabase/admin";

interface Props {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: Props) {
  const authResult = await verifyAdminAuth(request);
  if (!authResult.ok) {
    return authResult.response;
  }

  const { id } = await params;

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

  const { action, admin_note } = body as Record<string, unknown>;

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json(
      { error: "action must be approve or reject" },
      { status: 400 },
    );
  }

  const note =
    typeof admin_note === "string" ? admin_note.trim() || null : null;

  const supabase = createAdminClient();

  if (action === "approve") {
    const { error } = await supabase.rpc("approve_shop_owner_application", {
      application_id: id,
      note,
    });

    if (error) {
      if (error.message.includes("not found")) {
        return NextResponse.json(
          { error: "Application not found" },
          { status: 404 },
        );
      }
      if (error.message.includes("not in pending")) {
        return NextResponse.json(
          { error: "Application is already processed" },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ id, status: "approved" });
  }

  // reject
  const { data, error } = await supabase
    .from("shop_owner_applications")
    .update({ status: "rejected", admin_note: note })
    .eq("id", id)
    .select("id, status")
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id, status: data.status });
}
