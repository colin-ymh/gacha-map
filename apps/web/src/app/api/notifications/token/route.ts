import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient, createAdminClient } from "@/lib/supabase/server";

interface PostBody {
  token: string;
  platform: "ios" | "android";
}

interface DeleteBody {
  token: string;
}

/**
 * POST /api/notifications/token
 * 인증된 세션의 user_id로만 토큰을 upsert
 * 요청 body의 user_id는 무시하고 세션에서 읽은 user_id 사용
 */
export async function POST(request: NextRequest) {
  const { user } = await createAuthenticatedClient(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: PostBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { token, platform } = body;

  if (!token || typeof token !== "string" || token.trim().length === 0) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  if (!platform || !["ios", "android"].includes(platform)) {
    return NextResponse.json(
      { error: "platform must be 'ios' or 'android'" },
      { status: 400 },
    );
  }

  // 쓰기는 admin client로 수행: device_push_tokens는 타 유저→본인 재할당(기기 재로그인)이
  // 가능해야 하는데 RLS USING(auth.uid()=user_id)로는 이전 소유자 row를 업데이트할 수 없음.
  // user.id는 위에서 인증된 본인 값만 사용하므로 스푸핑 위험 없음.
  const supabase = createAdminClient();

  // 기본값 초기화: user가 설정 페이지에 접근하기 전에 토큰을 등록하는 경우 대비
  await supabase
    .from("notification_preferences")
    .insert({ user_id: user.id });

  // 토큰 upsert: 같은 토큰으로 재로그인 시 user_id 갱신
  const { data, error } = await supabase
    .from("device_push_tokens")
    .upsert(
      {
        user_id: user.id,
        token: token.trim(),
        platform,
      },
      { onConflict: "token" },
    )
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ token_id: data.id }, { status: 201 });
}

/**
 * DELETE /api/notifications/token
 * body의 token으로 본인 소유 row만 삭제
 */
export async function DELETE(request: NextRequest) {
  const { supabase, user } = await createAuthenticatedClient(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: DeleteBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { token } = body;

  if (!token || typeof token !== "string" || token.trim().length === 0) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("device_push_tokens")
    .delete()
    .eq("user_id", user.id)
    .eq("token", token.trim());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: true }, { status: 200 });
}
