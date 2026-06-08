import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { supabase, user } = await createAuthenticatedClient(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [definitionsResult, earnedResult, profileResult] = await Promise.all([
    supabase.from("badge_definitions").select("*").order("track").order("tier"),
    supabase
      .from("user_badges")
      .select("*, badge_definitions(*)")
      .eq("user_id", user.id),
    supabase
      .from("user_profiles")
      .select("main_badge_id")
      .eq("id", user.id)
      .single(),
  ]);

  return NextResponse.json({
    definitions: definitionsResult.data ?? [],
    earned: earnedResult.data ?? [],
    main_badge_id: profileResult.data?.main_badge_id ?? null,
  });
}
