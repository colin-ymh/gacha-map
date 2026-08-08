import type { SupabaseClient } from "@supabase/supabase-js";

export async function grantGachaBonusEvent(
  adminClient: SupabaseClient,
  userId: string,
  sourceType: "review" | "shop_report" | "gacha_report",
  sourceId: string,
): Promise<void> {
  const { error } = await adminClient
    .from("gacha_bonus_events")
    .insert({ user_id: userId, source_type: sourceType, source_id: sourceId });

  // 23505 = unique 충돌(같은 액션 재제출) → 정상, 조용히 무시.
  // 그 외 에러는 원본 액션(리뷰/제보) 응답을 막지 않되 로그는 남긴다.
  if (error && error.code !== "23505") {
    console.error("[grantGachaBonusEvent] failed", {
      sourceType,
      sourceId,
      error,
    });
  }
}
