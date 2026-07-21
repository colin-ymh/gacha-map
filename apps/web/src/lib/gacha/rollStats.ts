import { SupabaseClient } from "@supabase/supabase-js";
import type { GachaRollStats, GachaRollVariantStat } from "@gacha-map/shared";

const EMPTY_STATS: GachaRollStats = {
  totalCount: 0,
  todayCount: 0,
  variantStats: [],
};

function todayKST(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

export async function getProductRollStats(
  client: SupabaseClient,
  userId: string,
  productId: string,
): Promise<GachaRollStats> {
  const { data: rolls, error } = await client
    .from("gacha_roll_results")
    .select("variant_id, rolled_at")
    .eq("user_id", userId)
    .eq("product_id", productId);

  if (error || !rolls || rolls.length === 0) {
    return EMPTY_STATS;
  }

  const today = todayKST();
  const todayCount = rolls.filter((r) => {
    const kst = new Date(new Date(r.rolled_at).getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().slice(0, 10) === today;
  }).length;

  const countByVariant = new Map<string, number>();
  for (const roll of rolls) {
    countByVariant.set(
      roll.variant_id,
      (countByVariant.get(roll.variant_id) ?? 0) + 1,
    );
  }

  const variantIds = Array.from(countByVariant.keys());
  const { data: variants } = await client
    .from("gacha_product_variants")
    .select("id, name, name_ko, image_url")
    .in("id", variantIds);

  const variantStats: GachaRollVariantStat[] = variantIds
    .map((variantId) => {
      const variant = variants?.find((v) => v.id === variantId);
      return {
        variantId,
        variantName: variant?.name ?? "",
        variantNameKo: variant?.name_ko ?? null,
        variantImageUrl: variant?.image_url ?? null,
        count: countByVariant.get(variantId) ?? 0,
      };
    })
    .sort((a, b) => b.count - a.count);

  return {
    totalCount: rolls.length,
    todayCount,
    variantStats,
  };
}
