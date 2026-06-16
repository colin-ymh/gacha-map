import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { sendPushBatch, getPushReceipts } from "@/lib/notifications/sendPush";

const CRON_SECRET = process.env.CRON_SECRET || "";
const PHASE_A_LIMIT = 100;

/**
 * Cron 인증 검증
 */
function verifyCronAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return false;

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1];

  return token === CRON_SECRET && CRON_SECRET.length > 0;
}

/**
 * Phase A: pending row 클레임 및 Expo Push API 호출
 */
async function phaseA(supabase: ReturnType<typeof createAdminClient>) {
  console.log("[Cron] Phase A: Claiming pending notifications...");

  // RPC로 pending row 클레임 (FOR UPDATE SKIP LOCKED 포함)
  const { data: claimedRows, error: claimError } = await supabase.rpc(
    "claim_pending_notifications",
    { p_limit: PHASE_A_LIMIT },
  );

  if (claimError) {
    console.error("[Cron] Claim error:", claimError);
    return { processed: 0, failed: 0 };
  }

  const notifications = claimedRows ?? [];
  let processed = 0;
  let failed = 0;

  for (const notif of notifications) {
    const { notification_id, user_id, category, title, body, data } = notif;

    console.log(
      `[Cron] Processing notification ${notification_id} for user ${user_id}`,
    );

    // user_id의 토큰들 조회
    const { data: tokens, error: tokenError } = await supabase
      .from("device_push_tokens")
      .select("token, platform")
      .eq("user_id", user_id);

    if (tokenError) {
      console.error(
        `[Cron] Token fetch error for user ${user_id}:`,
        tokenError,
      );
      // 토큰 조회 실패도 실패 처리
      await supabase.rpc("mark_notification_failed_no_tokens", {
        p_notification_id: notification_id,
      });
      failed++;
      continue;
    }

    const tokenList = tokens ?? [];

    // 토큰 0건: 즉시 failed
    if (tokenList.length === 0) {
      console.log(`[Cron] No tokens for user ${user_id}, marking as failed`);
      await supabase.rpc("mark_notification_failed_no_tokens", {
        p_notification_id: notification_id,
      });
      failed++;
      continue;
    }

    // Expo로 푸시 발송 (100개씩 배치)
    const tokenValues = tokenList.map((t) => t.token);
    const { tickets, errors } = await sendPushBatch(
      tokenValues,
      title,
      body,
      data,
    );

    console.log(
      `[Cron] Sent ${tickets.length} tickets, ${errors.length} errors for notification ${notification_id}`,
    );

    // delivery_results 구성
    const deliveryResults = [
      ...tickets.map((t) => ({
        token: t.token,
        ticket_id: t.ticketId,
        status: "pending_receipt",
        error: null,
      })),
      ...errors.map((e) => ({
        token: e.token,
        ticket_id: null,
        status: "error",
        error: e.error,
      })),
    ];

    // DB에 delivery_results 저장 및 receipt_pending 상태로
    await supabase.rpc("update_notification_delivery_results", {
      p_notification_id: notification_id,
      p_delivery_results: deliveryResults,
    });

    processed++;
  }

  return { processed, failed };
}

/**
 * Phase B: receipt_pending row의 영수증 조회 및 최종 상태 확정
 */
async function phaseB(supabase: ReturnType<typeof createAdminClient>) {
  console.log("[Cron] Phase B: Checking receipts...");

  // receipt_pending + 15분 이상 경과한 row 조회
  const { data: receiptsRows, error: receiptError } = await supabase
    .from("pending_notifications")
    .select("id, delivery_results, retry_count")
    .eq("status", "receipt_pending")
    .lt("claimed_at", new Date(Date.now() - 15 * 60 * 1000).toISOString())
    .limit(50);

  if (receiptError) {
    console.error("[Cron] Receipt query error:", receiptError);
    return { checked: 0, sent: 0, failed: 0, retried: 0 };
  }

  const rows = receiptsRows ?? [];
  let checked = 0;
  let sent = 0;
  let failed = 0;
  let retried = 0;
  const MAX_RETRY_COUNT = 5;

  type DeliveryResult = {
    token: string;
    ticket_id: string | null;
    status: string;
    error?: string | null;
  };

  // 성공 디바이스가 하나라도 있으면 sent, 전부 실패면 영구/일시 에러 구분해서
  // 일시 에러가 있고 retry 여유가 있으면 backoff 재시도, 아니면 failed
  function decideOutcome(
    results: DeliveryResult[],
    retryCount: number,
  ): "sent" | "failed" | "retry" {
    if (results.some((r) => r.status === "sent")) return "sent";

    const errorDevices = results.filter((r) => r.status === "error");
    const hasTransientError = errorDevices.some(
      (r) => !(r.error && r.error.includes("DeviceNotRegistered")),
    );

    if (hasTransientError && retryCount < MAX_RETRY_COUNT) return "retry";
    return "failed";
  }

  for (const row of rows) {
    const {
      id: notificationId,
      delivery_results: rawResults,
      retry_count: retryCount,
    } = row;

    console.log(`[Cron] Checking receipt for notification ${notificationId}`);

    const results = (rawResults ?? []) as DeliveryResult[];

    // 유효한 ticket_id 추출
    const ticketIds = results
      .filter((r) => r.ticket_id && r.status === "pending_receipt")
      .map((r) => r.ticket_id as string);

    let finalResults = results;

    if (ticketIds.length > 0) {
      // 영수증 조회
      const { receipts } = await getPushReceipts(ticketIds);

      finalResults = results.map((r) => {
        if (!r.ticket_id) return r;

        const receipt = receipts[r.ticket_id];
        if (!receipt) return r; // receipt 아직 없음

        if (receipt.status === "error") {
          // DeviceNotRegistered 처리
          if (
            receipt.message &&
            receipt.message.includes("DeviceNotRegistered")
          ) {
            // 토큰 삭제
            supabase.rpc("delete_unregistered_token", { p_token: r.token }); // async, 결과 무시
          }
          return { ...r, status: "error", error: receipt.message };
        }

        return { ...r, status: "sent", error: null };
      });
    }

    const outcome = decideOutcome(finalResults, retryCount);

    if (outcome === "retry") {
      await supabase.rpc("reschedule_notification_with_backoff", {
        p_notification_id: notificationId,
        p_retry_count: retryCount,
      });
      retried++;
      checked++;
      continue;
    }

    await supabase.rpc("update_notification_receipt", {
      p_notification_id: notificationId,
      p_delivery_results: finalResults,
      p_final_status: outcome,
    });

    if (outcome === "sent") sent++;
    else failed++;
    checked++;
  }

  return { checked, sent, failed, retried };
}

/**
 * POST /api/cron/send-notifications
 */
export async function POST(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  try {
    const phaseAResult = await phaseA(supabase);
    const phaseBResult = await phaseB(supabase);

    return NextResponse.json({
      success: true,
      phaseA: phaseAResult,
      phaseB: phaseBResult,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[Cron] Unhandled error:", errMsg);
    return NextResponse.json(
      { error: "Internal server error", details: errMsg },
      { status: 500 },
    );
  }
}
