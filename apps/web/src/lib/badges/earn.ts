import { SupabaseClient } from "@supabase/supabase-js";
import { BadgeDefinition, BadgeTrack } from "@gacha-map/shared";
import { getBadgeCount } from "./count";

export async function checkAndAwardBadge(
  supabase: SupabaseClient,
  userId: string,
  track: BadgeTrack,
): Promise<(BadgeDefinition & { userBadgeId: string }) | null> {
  const currentCount = await getBadgeCount(supabase, userId, track);

  const { data: definitions } = await supabase
    .from("badge_definitions")
    .select("*")
    .eq("track", track)
    .order("tier", { ascending: true });

  if (!definitions?.length) return null;

  const { data: earnedBadges } = await supabase
    .from("user_badges")
    .select("badge_definition_id")
    .eq("user_id", userId)
    .in(
      "badge_definition_id",
      definitions.map((d) => d.id),
    );

  const earnedIds = new Set(
    (earnedBadges ?? []).map((b) => b.badge_definition_id),
  );

  let newBadge: BadgeDefinition | null = null;
  for (const def of definitions) {
    if (currentCount >= def.threshold && !earnedIds.has(def.id)) {
      newBadge = def;
    }
  }

  if (!newBadge) return null;

  const { data: insertedRow, error } = await supabase
    .from("user_badges")
    .insert({ user_id: userId, badge_definition_id: newBadge.id })
    .select("id")
    .single();

  if (error || !insertedRow?.id) return null;

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("main_badge_id")
    .eq("id", userId)
    .single();

  if (profile && !profile.main_badge_id) {
    await supabase
      .from("user_profiles")
      .update({ main_badge_id: insertedRow.id })
      .eq("id", userId);
  }

  return { ...newBadge, userBadgeId: insertedRow.id };
}
