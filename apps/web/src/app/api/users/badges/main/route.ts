import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/supabase/server";

export async function PUT(request: NextRequest) {
  const { supabase, user } = await createAuthenticatedClient(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { badge_id } = await request.json();

  if (badge_id === null) {
    await supabase
      .from("user_profiles")
      .update({ main_badge_id: null })
      .eq("id", user.id);
    return NextResponse.json({ success: true });
  }

  const { data: badge } = await supabase
    .from("user_badges")
    .select("id")
    .eq("id", badge_id)
    .eq("user_id", user.id)
    .single();

  if (!badge) {
    return NextResponse.json({ error: "Badge not found" }, { status: 404 });
  }

  await supabase
    .from("user_profiles")
    .update({ main_badge_id: badge_id })
    .eq("id", user.id);

  return NextResponse.json({ success: true });
}
