import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { supabase, user } = await createAuthenticatedClient(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const nickname = request.nextUrl.searchParams.get("nickname")?.trim();

  if (!nickname) {
    return NextResponse.json(
      { error: "nickname is required" },
      { status: 400 },
    );
  }

  if (nickname.length > 20) {
    return NextResponse.json(
      { error: "Nickname must be 20 characters or less" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("nickname", nickname)
    .neq("id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ available: data === null });
}
