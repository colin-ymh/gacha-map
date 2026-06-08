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
  const adminClient = createAdminClient();

  const { data: flag } = await adminClient
    .from("abuse_flags")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (!flag) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data, error } = await adminClient
    .from("abuse_flags")
    .update({
      reviewed_at: new Date().toISOString(),
      reviewed_by: authResult.user.id,
    })
    .eq("id", id)
    .select("id, reviewed_at, reviewed_by")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ flag: data });
}
