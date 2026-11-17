import { NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "./server";

type ShopOwnerAuthSuccess = { ok: true; user: User };
type ShopOwnerAuthFailure = { ok: false; response: NextResponse };
export type ShopOwnerAuthResult = ShopOwnerAuthSuccess | ShopOwnerAuthFailure;

export async function verifyShopOwnerAuth(
  request: NextRequest,
): Promise<ShopOwnerAuthResult> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Missing or invalid authorization header" },
        { status: 401 },
      ),
    };
  }

  const token = authHeader.slice(7);

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Invalid or expired token" },
          { status: 401 },
        ),
      };
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    // admin도 통과시킨다. 승인 RPC는 admin이 본인 샵을 등록/클레임해도 role을
    // shop_owner로 강등하지 않으므로(권한 상실 방지), role만 보면 admin 소유자가
    // 자기 샵 관리 API에서 403을 맞는다.
    if (profile?.role !== "shop_owner" && profile?.role !== "admin") {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Forbidden: Shop owner role required" },
          { status: 403 },
        ),
      };
    }

    return { ok: true, user: data.user };
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Failed to verify token" },
        { status: 500 },
      ),
    };
  }
}
