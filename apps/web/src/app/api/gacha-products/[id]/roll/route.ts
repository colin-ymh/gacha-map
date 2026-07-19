import { NextRequest, NextResponse } from "next/server";
import {
  createAuthenticatedClient,
  createAdminClient,
} from "@/lib/supabase/server";
import type { GachaProductVariant, GachaRollResult } from "@gacha-map/shared";
import { DAILY_LIMIT, todayKSTMidnight, tomorrowKSTString } from "./_utils";
import { checkAndAwardBadge } from "@/lib/badges/earn";

interface Props {
  params: Promise<{ id: string }>;
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
      {
        reason: "daily_limit",
        nextAvailableAt: tomorrowKSTString(),
        remainingToday: 0,
      },
      { status: 409 },
    );
  }

  // Fetch active variants
  const { data: variants, error: variantsError } = await adminClient
    .from("gacha_product_variants")
    .select(
      "id, product_id, name, name_ko, name_en, image_url, sort_order, status",
    )
    .eq("product_id", productId)
    .eq("status", "active")
    .order("sort_order", { ascending: true });

  if (variantsError) {
    return NextResponse.json({ error: variantsError.message }, { status: 500 });
  }

  if (!variants || variants.length === 0) {
    return NextResponse.json({ error: "no_variants" }, { status: 422 });
  }

  // Exclude recent rolls to reduce repetition (soft shuffle)
  let pool = variants as GachaProductVariant[];
  if (variants.length >= 2) {
    const excludeCount = Math.min(variants.length - 1, 5);
    const { data: recentRolls } = await adminClient
      .from("gacha_roll_results")
      .select("variant_id")
      .eq("user_id", user.id)
      .eq("product_id", productId)
      .order("rolled_at", { ascending: false })
      .limit(excludeCount);
    if (recentRolls && recentRolls.length > 0) {
      const recentIds = new Set(recentRolls.map((r) => r.variant_id));
      const filtered = pool.filter((v) => !recentIds.has(v.id));
      if (filtered.length > 0) pool = filtered;
    }
  }

  const variant = pool[
    Math.floor(Math.random() * pool.length)
  ] as GachaProductVariant;

  const { data: roll, error: insertError } = await adminClient
    .from("gacha_roll_results")
    .insert({
      user_id: user.id,
      product_id: productId,
      variant_id: variant.id,
      roll_type: "free_daily",
    })
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      // Unique constraint still present in DB — return result without persisting
      const remainingEphemeral = DAILY_LIMIT - ((todayCount ?? 0) + 1);
      const ephemeralResult: GachaRollResult = {
        variant,
        rollId: "ephemeral",
        permission: {
          type: "free_daily",
          remainingToday: Math.max(0, remainingEphemeral),
          nextAvailableAt: tomorrowKSTString(),
        },
      };
      return NextResponse.json(ephemeralResult);
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  try {
    await checkAndAwardBadge(adminClient, user.id, "gacha_roll_variety");
    await checkAndAwardBadge(adminClient, user.id, "gacha_roll_days");
  } catch {
    // badge award failure must not affect the roll result
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
