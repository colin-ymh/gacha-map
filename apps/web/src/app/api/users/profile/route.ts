import { NextRequest, NextResponse } from "next/server";
import {
  createAdminClient,
  createAuthenticatedClient,
} from "@/lib/supabase/server";

export async function GET(request?: NextRequest) {
  const { supabase, user } = await createAuthenticatedClient(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, name, nickname, avatar_url, avatar_thumb_url, role")
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
      avatar_thumb_url: null,
      role: "user",
    },
  });
}

export async function PATCH(request: NextRequest) {
  const { supabase, user } = await createAuthenticatedClient(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { nickname, avatar_url, avatar_thumb_url } = body as {
    nickname?: string;
    avatar_url?: string;
    avatar_thumb_url?: string;
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

  for (const [field, val] of [
    ["avatar_url", avatar_url],
    ["avatar_thumb_url", avatar_thumb_url],
  ] as const) {
    if (val !== undefined) {
      if (typeof val !== "string") {
        return NextResponse.json(
          { error: `${field} must be a string` },
          { status: 400 },
        );
      }
      try {
        const parsed = new URL(val);
        if (!["http:", "https:"].includes(parsed.protocol)) {
          return NextResponse.json(
            { error: `${field} must be an http(s) URL` },
            { status: 400 },
          );
        }
      } catch {
        return NextResponse.json(
          { error: `${field} must be a valid URL` },
          { status: 400 },
        );
      }
    }
  }

  const upsertPayload: Record<string, string> = { id: user.id };
  if (trimmedNickname !== undefined) upsertPayload.nickname = trimmedNickname;
  if (avatar_url !== undefined) upsertPayload.avatar_url = avatar_url;
  if (avatar_thumb_url !== undefined) upsertPayload.avatar_thumb_url = avatar_thumb_url;

  if (Object.keys(upsertPayload).length <= 1) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .upsert(upsertPayload, { onConflict: "id" })
    .select("id, name, nickname, avatar_url, avatar_thumb_url, role")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data });
}

export async function DELETE(request: NextRequest) {
  const adminClient = createAdminClient();
  const { user } = await createAuthenticatedClient(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await adminClient.auth.admin.deleteUser(user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
