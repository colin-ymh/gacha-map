import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdminAuth } from "@/lib/supabase/admin";
import {
  tryLogBadgeCount,
  checkAndAwardBadge,
  checkAnomalies,
} from "@/lib/badges";
import { enqueueNotification } from "@/lib/notifications/sendPush";
import type { BadgeTrack } from "@gacha-map/shared";
import type { ReportType } from "@/types";

const BADGE_TRACK_MAP: Partial<Record<ReportType, BadgeTrack>> = {
  new_shop: "new_shop_report",
  fix_info: "fix_info_report",
  closed: "closed_shop_report",
};

interface Props {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: Props) {
  const authResult = await verifyAdminAuth(request);
  if (!authResult.ok) {
    return authResult.response;
  }

  const { id } = await params;
  const supabase = createAdminClient();

  const { data: report, error: fetchError } = await supabase
    .from("reports")
    .select("id, status, report_type, user_id, shop_id")
    .eq("id", id)
    .single();

  if (fetchError) {
    if (fetchError.code === "PGRST116") {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("reports")
    .update({ status: "reviewed" })
    .eq("id", id)
    .eq("status", "pending")
    .select("id, status")
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json(
        { error: "Report not found or already processed" },
        { status: 404 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const track = BADGE_TRACK_MAP[report.report_type as ReportType];
  if (track && report.user_id) {
    const shopId = report.shop_id ?? report.id;
    try {
      const counted = await tryLogBadgeCount(
        supabase,
        report.user_id,
        shopId,
        track,
      );
      if (counted) {
        await checkAndAwardBadge(supabase, report.user_id, track);
        await checkAnomalies(supabase, report.user_id, track);
      }
    } catch {
      // badge failure must not affect report approval
    }
  }

  // 알림 발송: report_result
  if (report.user_id) {
    try {
      const shopId = report.shop_id || undefined;
      await enqueueNotification(
        supabase,
        report.user_id,
        "report_result",
        "제보가 승인되었습니다",
        `당신의 제보가 확인되어 지도에 반영되었습니다.`,
        {
          type: "report_result",
          report_id: report.id,
          ...(shopId && { shop_id: shopId }),
        },
      );
    } catch {
      // notification failure must not affect report approval
    }
  }

  return NextResponse.json({ report: data });
}
