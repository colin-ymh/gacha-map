import { SupabaseClient } from "@supabase/supabase-js";
import { BadgeTrack } from "@gacha-map/shared";

async function createAbuseFlag(
  supabase: SupabaseClient,
  userId: string,
  flagType: string,
  detail: Record<string, unknown>,
): Promise<void> {
  await supabase
    .from("abuse_flags")
    .insert({ user_id: userId, flag_type: flagType, detail });
}

export async function checkAnomalies(
  supabase: SupabaseClient,
  userId: string,
  actionType: BadgeTrack,
): Promise<void> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { count: recentCount } = await supabase
    .from("badge_count_log")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("action_type", actionType)
    .gte("counted_at", oneHourAgo);

  if ((recentCount ?? 0) >= 10) {
    await createAbuseFlag(supabase, userId, "burst_activity", {
      actionType,
      count: recentCount,
    });
    return;
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("created_at")
    .eq("id", userId)
    .single();

  if (!profile) return;

  const accountAgeDays =
    (Date.now() - new Date(profile.created_at).getTime()) /
    (1000 * 60 * 60 * 24);

  if (accountAgeDays < 7) {
    const { data: tier2Badges } = await supabase
      .from("user_badges")
      .select("badge_definitions(tier)")
      .eq("user_id", userId);

    const hasTier2 = tier2Badges?.some(
      (b: { badge_definitions: { tier: number }[] }) =>
        b.badge_definitions?.some((bd) => bd.tier >= 2),
    );
    if (hasTier2) {
      await createAbuseFlag(supabase, userId, "new_account_rapid_achievement", {
        accountAgeDays: Math.floor(accountAgeDays),
      });
    }
  }
}

export async function flagPriceAnomaly(
  supabase: SupabaseClient,
  userId: string,
  price: number,
  context: Record<string, unknown>,
): Promise<void> {
  if (price < 100 || price > 10000) {
    await createAbuseFlag(supabase, userId, "price_anomaly", {
      price,
      ...context,
    });
  }
}
