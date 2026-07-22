import { NextRequest, NextResponse } from "next/server";
import {
  createAuthenticatedClient,
  createAdminClient,
} from "@/lib/supabase/server";
import type {
  GachaProductVariant,
  GachaRollResult,
  GachaRollStats,
} from "@gacha-map/shared";
import { DAILY_LIMIT, todayKSTMidnight, tomorrowKSTString } from "./_utils";
import { checkAndAwardBadge } from "@/lib/badges/earn";
import { getProductRollStats } from "@/lib/gacha/rollStats";

const EMPTY_STATS: GachaRollStats = {
  totalCount: 0,
  todayCount: 0,
  variantStats: [],
};

async function safeGetProductRollStats(
  adminClient: ReturnType<typeof createAdminClient>,
  userId: string,
  productId: string,
  knownVariants: GachaProductVariant[],
): Promise<GachaRollStats> {
  try {
    return await getProductRollStats(
      adminClient,
      userId,
      productId,
      knownVariants,
    );
  } catch {
    // Stats aggregation must never fail an already-persisted roll.
    return EMPTY_STATS;
  }
}

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

  // Independent lookups — run concurrently instead of round-tripping one at a time.
  const [
    { count: todayCount, error: countError },
    { data: variants, error: variantsError },
    { data: recentRolls },
  ] = await Promise.all([
    adminClient
      .from("gacha_roll_results")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("roll_type", "free_daily")
      .gte("rolled_at", todayKSTMidnight()),
    adminClient
      .from("gacha_product_variants")
      .select(
        "id, product_id, name, name_ko, name_en, image_url, sort_order, status",
      )
      .eq("product_id", productId)
      .eq("status", "active")
      .order("sort_order", { ascending: true }),
    adminClient
      .from("gacha_roll_results")
      .select("variant_id")
      .eq("user_id", user.id)
      .eq("product_id", productId)
      .order("rolled_at", { ascending: false })
      .limit(5),
  ]);

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

  if (variantsError) {
    return NextResponse.json({ error: variantsError.message }, { status: 500 });
  }

  if (!variants || variants.length === 0) {
    return NextResponse.json({ error: "no_variants" }, { status: 422 });
  }

  // Exclude recent rolls to reduce repetition (soft shuffle)
  let pool = variants as GachaProductVariant[];
  if (variants.length >= 2 && recentRolls && recentRolls.length > 0) {
    const excludeCount = Math.min(variants.length - 1, 5);
    const recentIds = new Set(
      recentRolls.slice(0, excludeCount).map((r) => r.variant_id),
    );
    const filtered = pool.filter((v) => !recentIds.has(v.id));
    if (filtered.length > 0) pool = filtered;
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
      // Unique constraint still present in DB — return result without persisting.
      // stats reflects rows already in gacha_roll_results only; this ephemeral
      // roll itself is not counted since nothing was inserted for it.
      const remainingEphemeral = DAILY_LIMIT - ((todayCount ?? 0) + 1);
      const ephemeralStats = await safeGetProductRollStats(
        adminClient,
        user.id,
        productId,
        variants,
      );
      const ephemeralResult: GachaRollResult = {
        variant,
        rollId: "ephemeral",
        permission: {
          type: "free_daily",
          remainingToday: Math.max(0, remainingEphemeral),
          nextAvailableAt: tomorrowKSTString(),
        },
        stats: ephemeralStats,
      };
      return NextResponse.json(ephemeralResult);
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const [, stats] = await Promise.all([
    Promise.all([
      checkAndAwardBadge(adminClient, user.id, "gacha_roll_variety"),
      checkAndAwardBadge(adminClient, user.id, "gacha_roll_days"),
    ]).catch(() => {
      // badge award failure must not affect the roll result
    }),
    safeGetProductRollStats(adminClient, user.id, productId, variants),
  ]);

  const remainingToday = DAILY_LIMIT - ((todayCount ?? 0) + 1);

  const result: GachaRollResult = {
    variant,
    rollId: roll!.id,
    permission: {
      type: "free_daily",
      remainingToday,
      nextAvailableAt: tomorrowKSTString(),
    },
    stats,
  };

  return NextResponse.json(result);
}
