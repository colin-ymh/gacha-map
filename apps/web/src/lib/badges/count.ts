import { SupabaseClient } from "@supabase/supabase-js";
import { BadgeTrack } from "@gacha-map/shared";

export function getWeekStart(): string {
  const d = new Date();
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().split("T")[0];
}

export async function tryLogBadgeCount(
  supabase: SupabaseClient,
  userId: string,
  shopId: string,
  actionType: BadgeTrack,
): Promise<boolean> {
  const { error } = await supabase.from("badge_count_log").insert({
    user_id: userId,
    shop_id: shopId,
    action_type: actionType,
    week_start: getWeekStart(),
  });
  return !error;
}

export async function getBadgeCount(
  supabase: SupabaseClient,
  userId: string,
  track: BadgeTrack,
): Promise<number> {
  const { count } = await supabase
    .from("badge_count_log")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("action_type", track);
  return count ?? 0;
}
