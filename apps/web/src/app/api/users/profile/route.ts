import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";

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

  if (nickname !== undefined && typeof nickname !== "string") {
    return NextResponse.json(
      { error: "Nickname must be a string" },
      { status: 400 },
    );
  }

  const trimmedNickname = nickname?.trim();

  if (trimmedNickname !== undefined && trimmedNickname.length > 20) {
    return NextResponse.json(
      { error: "Nickname must be 20 characters or less" },
      { status: 400 },
    );
  }

  if (avatar_url !== undefined && typeof avatar_url !== "string") {
    return NextResponse.json(
      { error: "avatar_url must be a string" },
      { status: 400 },
    );
  }

  if (avatar_url) {
    try {
      const parsedAvatarUrl = new URL(avatar_url);
      if (!["http:", "https:"].includes(parsedAvatarUrl.protocol)) {
        return NextResponse.json(
          { error: "avatar_url must be an http(s) URL" },
          { status: 400 },
        );
      }
    } catch {
      return NextResponse.json(
        { error: "avatar_url must be a valid URL" },
        { status: 400 },
      );
    }
  }

  const upsertPayload: Record<string, string> = { id: user.id };
  if (trimmedNickname !== undefined) upsertPayload.nickname = trimmedNickname;
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

export async function DELETE(request: NextRequest) {
  const adminClient = createAdminClient();

  // Bearer 토큰(모바일) 또는 쿠키(웹) 둘 다 지원
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  let userId: string | null = null;

  if (bearerToken) {
    const { data, error } = await adminClient.auth.getUser(bearerToken);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    userId = data.user.id;
  } else {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    userId = user.id;
  }

  const { error } = await adminClient.auth.admin.deleteUser(userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
