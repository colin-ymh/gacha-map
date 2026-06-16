import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdminAuth } from "@/lib/supabase/admin";
import { enqueueNotification } from "@/lib/notifications/sendPush";

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

  // 반려 전에 제보 정보 조회
  const { data: report, error: fetchError } = await supabase
    .from("reports")
    .select("id, status, user_id, shop_id")
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
    .update({ status: "resolved" })
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

  // 알림 발송: report_result
  if (report.user_id) {
    try {
      const shopId = report.shop_id || undefined;
      await enqueueNotification(
        supabase,
        report.user_id,
        "report_result",
        "제보가 반려되었습니다",
        `당신의 제보가 검토 결과 지도에 반영되지 않았습니다.`,
        {
          type: "report_result",
          report_id: report.id,
          ...(shopId && { shop_id: shopId }),
        },
      );
    } catch {
      // notification failure must not affect report rejection
    }
  }

  return NextResponse.json({ report: data });
}
