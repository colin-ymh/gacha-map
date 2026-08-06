import { NextRequest, NextResponse } from "next/server";
import {
  createAuthenticatedClient,
  createAdminClient,
} from "@/lib/supabase/server";
import { todayKSTMidnight, tomorrowKSTString } from "../roll/_utils";
import { DAILY_BASE_ROLLS, REFERRAL_BONUS_MAX } from "@/constants/gacha-roll";

interface Props {
  params: Promise<{ id: string }>;
}

interface RollQuota {
  base: number;
  bonus: number;
  used: number;
  remaining: number;
}

interface RolledVariant {
  id: string;
  name: string;
  name_ko: string | null;
  image_url: string | null;
}

export async function GET(request: NextRequest, { params }: Props) {
  const { id: productId } = await params;
  const adminClient = createAdminClient();

  const { count: variantCount, error: variantError } = await adminClient
    .from("gacha_product_variants")
    .select("*", { count: "exact", head: true })
    .eq("product_id", productId)
    .eq("status", "active");

  if (variantError) {
    return NextResponse.json({ error: variantError.message }, { status: 500 });
  }

  if ((variantCount ?? 0) === 0) {
    return NextResponse.json({ canRoll: false, reason: "no_variants" });
  }

  const { user } = await createAuthenticatedClient(request);
  if (!user) {
    return NextResponse.json({ canRoll: true });
  }

  // 쿼터 산출은 이 RPC 하나만 쓴다. 라우트에서 재계산하지 않는다.
  const { data: quota, error: quotaError } = await adminClient
    .rpc("get_daily_roll_quota", {
      p_user_id: user.id,
      p_base: DAILY_BASE_ROLLS,
      p_bonus_max: REFERRAL_BONUS_MAX,
    })
    .single<RollQuota>();

  if (quotaError || !quota) {
    return NextResponse.json(
      { error: quotaError?.message ?? "quota_failed" },
      { status: 500 },
    );
  }

  // 오늘 이 상품을 뽑은 기록. 앱이 결과 카드를 보여주고 FAB 라벨을
  // "다시 뽑기"로 바꾸는 데 쓴다.
  //
  // 예전에는 이 기록이 있다는 것만으로 뽑기를 막았지만(already_rolled),
  // 이제 제한은 하루 총량 하나뿐이다. 같은 상품을 반복해서 뽑을 수 있다.
  const { data: productRoll } = await adminClient
    .from("gacha_roll_results")
    .select(
      "variant_id, gacha_product_variants!variant_id(id, name, name_ko, image_url)",
    )
    .eq("user_id", user.id)
    .eq("product_id", productId)
    .eq("roll_type", "free_daily")
    .gte("rolled_at", todayKSTMidnight())
    .order("rolled_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const rolledVariant = productRoll?.gacha_product_variants as unknown as
    RolledVariant | null | undefined;

  if (quota.remaining > 0) {
    return NextResponse.json({
      canRoll: true,
      quota,
      ...(rolledVariant ? { rolledVariant } : {}),
    });
  }

  return NextResponse.json({
    canRoll: false,
    reason: "daily_limit",
    nextAvailableAt: tomorrowKSTString(),
    quota,
    ...(rolledVariant ? { rolledVariant } : {}),
  });
}
