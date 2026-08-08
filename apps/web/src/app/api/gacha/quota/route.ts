import { NextRequest, NextResponse } from "next/server";
import {
  createAuthenticatedClient,
  createAdminClient,
} from "@/lib/supabase/server";
import type { GachaDailyQuota } from "@gacha-map/shared";
import { tomorrowKSTString } from "../../gacha-products/[id]/roll/_utils";
import {
  ACTION_BONUS_MAX,
  DAILY_BASE_ROLLS,
  REFERRAL_BONUS_MAX,
} from "@/constants/gacha-roll";

// 뽑기를 하지 않고 잔여 횟수만 조회한다. 앱이 화면 진입/포커스 때 호출한다.
export async function GET(request: NextRequest) {
  const { user } = await createAuthenticatedClient(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const adminClient = createAdminClient();

  const { data: quota, error } = await adminClient
    .rpc("get_daily_roll_quota", {
      p_user_id: user.id,
      p_base: DAILY_BASE_ROLLS,
      p_bonus_max: REFERRAL_BONUS_MAX,
      p_action_bonus_max: ACTION_BONUS_MAX,
    })
    .single<Omit<GachaDailyQuota, "nextAvailableAt">>();

  if (error || !quota) {
    return NextResponse.json(
      { error: error?.message ?? "quota_failed" },
      { status: 500 },
    );
  }

  const result: GachaDailyQuota = {
    ...quota,
    nextAvailableAt: tomorrowKSTString(),
  };

  return NextResponse.json(result);
}
