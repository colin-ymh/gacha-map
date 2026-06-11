import { NextRequest, NextResponse } from "next/server";
import { validateNickname } from "@gacha-map/shared";
import { createAuthenticatedClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { supabase, user } = await createAuthenticatedClient(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const nickname = request.nextUrl.searchParams.get("nickname")?.trim();

  if (!nickname) {
    return NextResponse.json({ error: "too_short" }, { status: 400 });
  }

  const validationError = validateNickname(nickname);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
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
