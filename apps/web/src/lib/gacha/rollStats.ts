import { SupabaseClient } from "@supabase/supabase-js";
import type {
  GachaRollStats,
  GachaRollVariantStat,
  GachaCollectionSummary,
  GachaCollectionDetail,
  GachaCollectionVariant,
} from "@gacha-map/shared";

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

type KnownVariant = {
  id: string;
  name: string;
  name_ko: string | null;
  image_url: string | null;
};

export async function getProductRollStats(
  client: SupabaseClient,
  userId: string,
  productId: string,
  knownVariants?: KnownVariant[],
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
  const knownMap = new Map((knownVariants ?? []).map((v) => [v.id, v]));
  const missingIds = variantIds.filter((id) => !knownMap.has(id));

  let fetchedVariants: KnownVariant[] = [];
  if (missingIds.length > 0) {
    const { data } = await client
      .from("gacha_product_variants")
      .select("id, name, name_ko, image_url")
      .in("id", missingIds);
    fetchedVariants = data ?? [];
  }
  const variants = [...(knownVariants ?? []), ...fetchedVariants];

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

function displayName(product: {
  name: string;
  name_ja: string | null;
  name_ko: string | null;
}): string {
  return product.name_ko ?? product.name_ja ?? product.name;
}

export async function getUserGachaCollections(
  client: SupabaseClient,
  userId: string,
): Promise<GachaCollectionSummary[]> {
  const { data: rolls, error } = await client
    .from("gacha_roll_results")
    .select("product_id, variant_id")
    .eq("user_id", userId);

  if (error || !rolls || rolls.length === 0) {
    return [];
  }

  const variantsByProduct = new Map<string, Set<string>>();
  for (const roll of rolls) {
    const set = variantsByProduct.get(roll.product_id) ?? new Set<string>();
    set.add(roll.variant_id);
    variantsByProduct.set(roll.product_id, set);
  }

  const productIds = Array.from(variantsByProduct.keys());

  const [{ data: products }, { data: activeVariants }] = await Promise.all([
    client
      .from("gacha_products")
      .select("id, name, name_ja, name_ko, official_image_url")
      .in("id", productIds),
    client
      .from("gacha_product_variants")
      .select("product_id")
      .in("product_id", productIds)
      .eq("status", "active"),
  ]);

  const totalVariantsByProduct = new Map<string, number>();
  for (const variant of activeVariants ?? []) {
    totalVariantsByProduct.set(
      variant.product_id,
      (totalVariantsByProduct.get(variant.product_id) ?? 0) + 1,
    );
  }

  const productsById = new Map((products ?? []).map((p) => [p.id, p]));

  const summaries: GachaCollectionSummary[] = productIds.map((productId) => {
    const product = productsById.get(productId);
    const totalVariants = totalVariantsByProduct.get(productId) ?? 0;
    const collectedCount = variantsByProduct.get(productId)?.size ?? 0;
    return {
      productId,
      productDisplayName: product ? displayName(product) : "",
      productImageUrl: product?.official_image_url ?? null,
      totalVariants,
      collectedCount,
      isComplete: totalVariants > 0 && collectedCount >= totalVariants,
    };
  });

  return summaries.sort((a, b) => {
    if (a.isComplete !== b.isComplete) return a.isComplete ? -1 : 1;
    return b.collectedCount - a.collectedCount;
  });
}

export async function getProductCollectionDetail(
  client: SupabaseClient,
  userId: string | null,
  productId: string,
): Promise<GachaCollectionDetail> {
  const { data: activeVariants } = await client
    .from("gacha_product_variants")
    .select("id, name, name_ko, image_url")
    .eq("product_id", productId)
    .eq("status", "active")
    .order("sort_order", { ascending: true });

  const variantsList = activeVariants ?? [];

  const countByVariant = new Map<string, number>();
  if (userId && variantsList.length > 0) {
    const { data: rolls } = await client
      .from("gacha_roll_results")
      .select("variant_id")
      .eq("user_id", userId)
      .eq("product_id", productId);

    for (const roll of rolls ?? []) {
      countByVariant.set(
        roll.variant_id,
        (countByVariant.get(roll.variant_id) ?? 0) + 1,
      );
    }
  }

  const variants: GachaCollectionVariant[] = variantsList.map((variant) => {
    const count = countByVariant.get(variant.id) ?? 0;
    return {
      variantId: variant.id,
      variantName: variant.name,
      variantNameKo: variant.name_ko,
      variantImageUrl: variant.image_url,
      collected: count > 0,
      count,
    };
  });

  const totalVariants = variants.length;
  const collectedCount = variants.filter((v) => v.collected).length;

  return {
    productId,
    totalVariants,
    collectedCount,
    isComplete: totalVariants > 0 && collectedCount >= totalVariants,
    variants,
  };
}
