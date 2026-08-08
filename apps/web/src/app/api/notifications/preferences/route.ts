import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/supabase/server";

interface PreferencesRow {
  user_id: string;
  report_result: boolean;
  shop_owner_activity: boolean;
  wishlist_news: boolean;
  badge: boolean;
  shop_owner_update: boolean;
  wishlist_product_update: boolean;
  product_wishlist_restock: boolean;
  gacha_bonus: boolean;
  gacha_referral_bonus: boolean;
}

interface PatchBody {
  report_result?: boolean;
  shop_owner_activity?: boolean;
  wishlist_news?: boolean;
  badge?: boolean;
  shop_owner_update?: boolean;
  wishlist_product_update?: boolean;
  product_wishlist_restock?: boolean;
  gacha_bonus?: boolean;
  gacha_referral_bonus?: boolean;
}

/**
 * GET /api/notifications/preferences
 * 본인의 알림 설정 조회
 */
export async function GET(request: NextRequest) {
  const { supabase, user } = await createAuthenticatedClient(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // row가 없으면 기본값 반환
  const preferences: PreferencesRow = data ?? {
    user_id: user.id,
    report_result: true,
    shop_owner_activity: true,
    wishlist_news: true,
    badge: true,
    shop_owner_update: true,
    wishlist_product_update: true,
    product_wishlist_restock: true,
    gacha_bonus: true,
    gacha_referral_bonus: true,
  };

  return NextResponse.json({ preferences });
}

/**
 * PATCH /api/notifications/preferences
 * 본인의 알림 설정 업데이트
 */
export async function PATCH(request: NextRequest) {
  const { supabase, user } = await createAuthenticatedClient(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: PatchBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const updatePayload: Record<string, boolean> = {};
  const validKeys = [
    "report_result",
    "shop_owner_activity",
    "wishlist_news",
    "badge",
    "shop_owner_update",
    "wishlist_product_update",
    "gacha_bonus",
    "gacha_referral_bonus",
  ];

  for (const key of validKeys) {
    const value = body[key as keyof PatchBody];
    if (typeof value === "boolean") {
      updatePayload[key] = value;
    }
  }

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json(
      { error: "At least one valid boolean field must be provided" },
      { status: 400 },
    );
  }

  // 먼저 기본값으로 초기화 시도 (이미 있으면 무시)
  try {
    await supabase
      .from("notification_preferences")
      .insert({ user_id: user.id });
  } catch {
    // 이미 존재하거나 다른 이유로 실패해도 무시
  }

  // 업데이트
  const { data, error } = await supabase
    .from("notification_preferences")
    .update(updatePayload)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ preferences: data as PreferencesRow });
}
