import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, name, nickname, avatar_url, role")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    profile: data ?? {
      id: user.id,
      name: null,
      nickname: null,
      avatar_url: null,
      role: "user",
    },
  });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { nickname, avatar_url } = body as {
    nickname?: string;
    avatar_url?: string;
  };

  if (nickname !== undefined && nickname.length > 20) {
    return NextResponse.json(
      { error: "Nickname must be 20 characters or less" },
      { status: 400 },
    );
  }

  const upsertPayload: Record<string, string> = { id: user.id };
  if (nickname !== undefined) upsertPayload.nickname = nickname;
  if (avatar_url !== undefined) upsertPayload.avatar_url = avatar_url;

  if (Object.keys(upsertPayload).length <= 1) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .upsert(upsertPayload, { onConflict: "id" })
    .select("id, name, nickname, avatar_url")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data });
}
