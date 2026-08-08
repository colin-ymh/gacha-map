import { NextRequest, NextResponse } from "next/server";
import {
  createAdminClient,
  createAuthenticatedClient,
} from "@/lib/supabase/server";
import { haversineDistanceMeters } from "@gacha-map/shared";
import {
  tryLogBadgeCount,
  checkAndAwardBadge,
  checkAnomalies,
  getWeekStart,
} from "@/lib/badges";
import { enqueueNotification } from "@/lib/notifications/sendPush";
import type { QuickReportKind } from "@gacha-map/shared";
import { grantGachaBonusEvent } from "@/lib/gacha/bonus";

export const dynamic = "force-dynamic";

const LOCATION_RADIUS_M = 500;

interface Props {
  params: Promise<{ id: string }>;
}

interface RequestBody {
  kind: QuickReportKind;
  user_lat: number;
  user_lng: number;
}

export async function POST(request: NextRequest, { params }: Props) {
  const { id: shopId } = await params;

  const { user } = await createAuthenticatedClient(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { kind, user_lat, user_lng } = body;

  if (kind !== "gacha_present" && kind !== "gacha_absent") {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }
  if (typeof user_lat !== "number" || typeof user_lng !== "number") {
    return NextResponse.json(
      { error: "user_lat and user_lng required" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  const [{ data: shop }, { data: profile }] = await Promise.all([
    supabase
      .from("shops")
      .select("id, lat, lng, owner_id")
      .eq("id", shopId)
      .maybeSingle(),
    supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  if (!shop) {
    return NextResponse.json({ error: "Shop not found" }, { status: 404 });
  }

  const isAdmin = profile?.role === "admin";

  if (!isAdmin) {
    const distance = haversineDistanceMeters(
      user_lat,
      user_lng,
      shop.lat,
      shop.lng,
    );
    if (distance > LOCATION_RADIUS_M) {
      return NextResponse.json(
        { error: "Too far from shop", distance_m: Math.round(distance) },
        { status: 403 },
      );
    }
  }

  const { data: quickReport, error: insertError } = await supabase
    .from("shop_quick_reports")
    .insert({
      shop_id: shopId,
      user_id: user.id,
      kind,
      week_start: getWeekStart(),
    })
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({ error: "Already reported" }, { status: 409 });
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  let newBadge: { id: string; name: string; icon_url: string } | null = null;
  try {
    const counted = await tryLogBadgeCount(
      supabase,
      user.id,
      shopId,
      "quick_report",
    );
    if (counted) {
      const badge = await checkAndAwardBadge(supabase, user.id, "quick_report");
      if (badge)
        newBadge = {
          id: badge.userBadgeId,
          name: badge.name,
          icon_url: badge.icon_url,
        };
      await checkAnomalies(supabase, user.id, "quick_report");
    }
  } catch {
    // badge failure must not affect quick-report response
  }

  // 가챠 보너스 이벤트 적립 (non-blocking)
  let gachaBonusGranted = false;
  if (quickReport?.id) {
    try {
      gachaBonusGranted = await grantGachaBonusEvent(
        supabase,
        user.id,
        "shop_report",
        quickReport.id,
      );
    } catch {
      // bonus failure must not affect quick-report response
    }
  }

  if (kind === "gacha_absent") {
    await supabase.rpc("auto_hide_shop_if_absent", { p_shop_id: shopId });
  }

  // 알림 발송: shop_owner_activity (제보 작성자가 소유자가 아닌 경우만)
  if (shop && shop.owner_id && shop.owner_id !== user.id) {
    try {
      await enqueueNotification(
        supabase,
        shop.owner_id,
        "shop_owner_activity",
        "매장에 새로운 제보가 등록되었습니다",
        `당신의 매장에 ${kind === "gacha_present" ? "가차가 있다" : "가차가 없다"}는 제보가 올라왔습니다.`,
        {
          type: "shop_owner_activity",
          shop_id: shopId,
        },
      );
    } catch {
      // notification failure must not affect quick-report response
    }
  }

  return NextResponse.json({
    success: true,
    new_badge: newBadge,
    gachaBonusGranted,
  });
}
