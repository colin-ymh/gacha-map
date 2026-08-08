import type { SupabaseClient } from "@supabase/supabase-js";
import { ACTION_BONUS_MAX } from "@/constants/gacha-roll";

/**
 * 리뷰/제보/가챠제보 성공 시 가챠 보너스 이벤트를 적립한다.
 *
 * 삽입 + "오늘 상한(ACTION_BONUS_MAX) 이내인지" 판단을 `grant_gacha_bonus_event`
 * RPC 하나에서 원자적으로 처리한다 — TS에서 별도로 오늘자 count를 세면 동시
 * 액션 race나 KST 자정 계산 오차로 어긋날 수 있어(consume_daily_roll의
 * kst_today_start()와 다른 시계를 쓰게 됨) DB에 맡긴다.
 *
 * 이 이벤트는 앱 안에서 발생하는(사용자가 화면을 보고 있는) 액션이라 푸시
 * 없이 반환값을 호출부에 그대로 넘겨 클라이언트 토스트로만 알린다.
 * 반환값은 "오늘 상한 이내에 든 이벤트라 실제로 뽑기 기회가 늘었는지"를 뜻한다.
 */
export async function grantGachaBonusEvent(
  adminClient: SupabaseClient,
  userId: string,
  sourceType: "review" | "shop_report" | "gacha_report",
  sourceId: string,
): Promise<boolean> {
  const { data: granted, error } = await adminClient.rpc(
    "grant_gacha_bonus_event",
    {
      p_user_id: userId,
      p_source_type: sourceType,
      p_source_id: sourceId,
      p_action_bonus_max: ACTION_BONUS_MAX,
    },
  );

  if (error) {
    console.error("[grantGachaBonusEvent] failed", {
      sourceType,
      sourceId,
      error,
    });
    return false;
  }

  return Boolean(granted);
}
