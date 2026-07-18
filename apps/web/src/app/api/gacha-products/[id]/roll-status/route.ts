import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient, createAdminClient } from "@/lib/supabase/server";
import { DAILY_LIMIT, todayKSTMidnight, tomorrowKSTString } from "../roll/_utils";

interface Props {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: Props) {
  const { id: productId } = await params;
  const adminClient = createAdminClient();

  const { count: variantCount, error: variantError } = await adminClient
    .from("gacha_product_variants")
    .select("*", { count: "exact", head: true })
    .eq("product_id", productId)
    .eq("status", "active");

  if (variantError) {
    return NextResponse.json({ error: variantError.message }, { status: 500 });
  }

  if ((variantCount ?? 0) === 0) {
    return NextResponse.json({ canRoll: false, reason: "no_variants" });
  }

  const { user } = await createAuthenticatedClient(request);
  if (!user) {
    return NextResponse.json({ canRoll: true });
  }

  const todayStart = todayKSTMidnight();

  const { count: todayCount, error: countError } = await adminClient
    .from("gacha_roll_results")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("roll_type", "free_daily")
    .gte("rolled_at", todayStart);

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  if ((todayCount ?? 0) >= DAILY_LIMIT) {
    // 이 상품을 오늘 뽑은 기록이 있으면 variant 포함 반환
    const { data: productRollForLimit } = await adminClient
      .from("gacha_roll_results")
      .select("variant_id, gacha_product_variants!variant_id(id, name, name_ko, image_url)")
      .eq("user_id", user.id)
      .eq("product_id", productId)
      .eq("roll_type", "free_daily")
      .gte("rolled_at", todayStart)
      .limit(1)
      .maybeSingle();

    const vLimit = productRollForLimit?.gacha_product_variants as unknown as {
      id: string;
      name: string;
      name_ko: string | null;
      image_url: string | null;
    } | null | undefined;

    return NextResponse.json({
      canRoll: false,
      reason: "daily_limit",
      nextAvailableAt: tomorrowKSTString(),
      ...(vLimit ? { rolledVariant: vLimit } : {}),
    });
  }

  const { data: productRoll, error: productError } = await adminClient
    .from("gacha_roll_results")
    .select("variant_id, gacha_product_variants!variant_id(id, name, name_ko, image_url)")
    .eq("user_id", user.id)
    .eq("product_id", productId)
    .eq("roll_type", "free_daily")
    .gte("rolled_at", todayStart)
    .limit(1)
    .maybeSingle();

  if (productError) {
    return NextResponse.json({ error: productError.message }, { status: 500 });
  }

  if (productRoll) {
    const v = productRoll.gacha_product_variants as unknown as {
      id: string;
      name: string;
      name_ko: string | null;
      image_url: string | null;
    } | null;
    return NextResponse.json({
      canRoll: false,
      reason: "already_rolled",
      nextAvailableAt: tomorrowKSTString(),
      ...(v ? { rolledVariant: v } : {}),
    });
  }

  return NextResponse.json({ canRoll: true });
}
