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
import { pickRandomVariant, tomorrowKSTString } from "./_utils";
import {
  ACTION_BONUS_MAX,
  DAILY_BASE_ROLLS,
  REFERRAL_BONUS_MAX,
} from "@/constants/gacha-roll";
import { checkAndAwardBadge } from "@/lib/badges/earn";
import { getProductRollStats } from "@/lib/gacha/rollStats";

const EMPTY_STATS: GachaRollStats = {
  totalCount: 0,
  todayCount: 0,
  variantStats: [],
};

// consume_daily_roll RPC가 돌려주는 행.
// roll_id가 null이면 쿼터 소진이라 아무것도 저장되지 않았다는 뜻이다.
interface ConsumedRoll {
  roll_id: string | null;
  base: number;
  bonus: number;
  used_after: number;
  remaining_after: number;
}

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

  const variant = pickRandomVariant(variants as GachaProductVariant[]);

  // 쿼터 확인과 INSERT를 한 트랜잭션 안에서 처리한다. 동시 요청이 상한을 넘기지
  // 못하도록 함수 안에서 advisory lock을 잡는다.
  const { data: consumed, error: consumeError } = await adminClient
    .rpc("consume_daily_roll", {
      p_user_id: user.id,
      p_product_id: productId,
      p_variant_id: variant.id,
      p_base: DAILY_BASE_ROLLS,
      p_bonus_max: REFERRAL_BONUS_MAX,
      p_action_bonus_max: ACTION_BONUS_MAX,
    })
    .single<ConsumedRoll>();

  if (consumeError || !consumed) {
    return NextResponse.json(
      { error: consumeError?.message ?? "roll_failed" },
      { status: 500 },
    );
  }

  if (!consumed.roll_id) {
    return NextResponse.json(
      {
        reason: "daily_limit",
        nextAvailableAt: tomorrowKSTString(),
        remainingToday: 0,
        base: consumed.base,
        bonus: consumed.bonus,
        used: consumed.used_after,
      },
      { status: 409 },
    );
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

  const result: GachaRollResult = {
    variant,
    rollId: consumed.roll_id,
    permission: {
      type: "free_daily",
      // RPC가 이번 INSERT까지 반영해 계산한 값이다. 여기서 재계산하면 어긋난다.
      remainingToday: consumed.remaining_after,
      nextAvailableAt: tomorrowKSTString(),
      base: consumed.base,
      bonus: consumed.bonus,
      used: consumed.used_after,
    },
    stats,
  };

  return NextResponse.json(result);
}
