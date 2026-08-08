import type { SupabaseClient } from "@supabase/supabase-js";
import { ACTION_BONUS_MAX } from "@/constants/gacha-roll";
import { enqueueNotification } from "@/lib/notifications/sendPush";

/**
 * 리뷰/제보/가챠제보 성공 시 가챠 보너스 이벤트를 적립한다.
 *
 * 삽입 + "오늘 상한(ACTION_BONUS_MAX) 이내인지" 판단 + notification_preferences
 * 확인을 `grant_gacha_bonus_event` RPC 하나에서 원자적으로 처리한다 — TS에서
 * 별도로 오늘자 count를 세면 동시 액션 race나 KST 자정 계산 오차로 어긋날 수
 * 있어(consume_daily_roll의 kst_today_start()와 다른 시계를 쓰게 됨) DB에 맡긴다.
 * RPC가 true를 돌려줄 때만 실제로 뽑기 기회가 늘었고 알림 설정도 켜져 있다는
 * 뜻이라 그때만 푸시한다.
 */
export async function grantGachaBonusEvent(
  adminClient: SupabaseClient,
  userId: string,
  sourceType: "review" | "shop_report" | "gacha_report",
  sourceId: string,
): Promise<void> {
  const { data: shouldNotify, error } = await adminClient.rpc(
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
    return;
  }

  if (!shouldNotify) return;

  try {
    await enqueueNotification(
      adminClient,
      userId,
      "gacha_bonus",
      "가챠 뽑기 기회 +1",
      "리뷰/제보로 오늘 가챠 뽑기 기회가 늘었어요!",
      { type: "gacha_bonus" },
    );
  } catch {
    // notification failure must not affect the caller's response
  }
}
