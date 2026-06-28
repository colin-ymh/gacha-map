import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient, createAdminClient } from "@/lib/supabase/server";
import type { GachaProductVariant, GachaRollResult } from "@gacha-map/shared";

const DAILY_LIMIT = 5;

interface Props {
  params: Promise<{ id: string }>;
}

function kstDate(offsetDays = 0): { y: number; m: string; d: string } {
  const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  kst.setDate(kst.getDate() + offsetDays);
  return {
    y: kst.getFullYear(),
    m: String(kst.getMonth() + 1).padStart(2, "0"),
    d: String(kst.getDate()).padStart(2, "0"),
  };
}

function todayKSTMidnight(): string {
  const { y, m, d } = kstDate(0);
  return `${y}-${m}-${d}T00:00:00+09:00`;
}

function tomorrowKSTString(): string {
  const { y, m, d } = kstDate(1);
  return `${y}-${m}-${d}T00:00:00+09:00`;
}

export async function POST(request: NextRequest, { params }: Props) {
  const { id: productId } = await params;

  const { user } = await createAuthenticatedClient(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const adminClient = createAdminClient();

  // Check total rolls today (across all products)
  const { count: todayCount, error: countError } = await adminClient
    .from("gacha_roll_results")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("roll_type", "free_daily")
    .gte("rolled_at", todayKSTMidnight());

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  if ((todayCount ?? 0) >= DAILY_LIMIT) {
    return NextResponse.json(
      { reason: "daily_limit", nextAvailableAt: tomorrowKSTString(), remainingToday: 0 },
      { status: 409 },
    );
  }

  // Fetch active variants
  const { data: variants, error: variantsError } = await adminClient
    .from("gacha_product_variants")
    .select("id, product_id, name, name_ko, name_en, image_url, sort_order, status")
    .eq("product_id", productId)
    .eq("status", "active")
    .order("sort_order", { ascending: true });

  if (variantsError) {
    return NextResponse.json({ error: variantsError.message }, { status: 500 });
  }

  if (!variants || variants.length === 0) {
    return NextResponse.json({ error: "no_variants" }, { status: 422 });
  }

  const variant = variants[Math.floor(Math.random() * variants.length)] as GachaProductVariant;

  const { data: roll, error: insertError } = await adminClient
    .from("gacha_roll_results")
    .insert({ user_id: user.id, product_id: productId, variant_id: variant.id, roll_type: "free_daily" })
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json(
        { reason: "product_limit", nextAvailableAt: tomorrowKSTString(), remainingToday: DAILY_LIMIT - (todayCount ?? 0) },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const remainingToday = DAILY_LIMIT - ((todayCount ?? 0) + 1);

  const result: GachaRollResult = {
    variant,
    rollId: roll!.id,
    permission: {
      type: "free_daily",
      remainingToday,
      nextAvailableAt: tomorrowKSTString(),
    },
  };

  return NextResponse.json(result);
}
