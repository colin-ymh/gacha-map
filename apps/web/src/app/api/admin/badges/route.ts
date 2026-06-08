import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdminAuth } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const authResult = await verifyAdminAuth(request);
  if (!authResult.ok) {
    return authResult.response;
  }

  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from("badge_definitions")
    .select(
      "id, track, tier, name, description, icon_url, threshold, created_at, updated_at",
    )
    .order("track")
    .order("tier");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ badges: data ?? [] });
}
