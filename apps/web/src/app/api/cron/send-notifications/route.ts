import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { sendPushBatch, getPushReceipts } from "@/lib/notifications/sendPush";

const CRON_SECRET = process.env.CRON_SECRET || "";
// Supabase DB 트리거(pg_net)가 INSERT 직후 즉시 호출할 때 쓰는 별도 secret.
// GitHub Actions cron의 CRON_SECRET과 분리해 서로 영향 없이 로테이션 가능하게 한다.
const DB_CRON_SECRET = process.env.DB_CRON_SECRET || "";
const PHASE_A_LIMIT = 100;

/**
 * Cron 인증 검증
 */
function verifyCronAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return false;

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1];
  if (!token) return false;

  if (CRON_SECRET.length > 0 && token === CRON_SECRET) return true;
  if (DB_CRON_SECRET.length > 0 && token === DB_CRON_SECRET) return true;
  return false;
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
    const {
      notification_id,
      out_user_id: user_id,
      category,
      title,
      body,
      data,
    } = notif;

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
    const { error: updateError } = await supabase.rpc(
      "update_notification_delivery_results",
      {
        p_notification_id: notification_id,
        p_delivery_results: deliveryResults,
      },
    );

    if (updateError) {
      // 저장 실패 시 row가 processing에 남아 중복 발송 위험 → 실패로 카운트
      console.error(
        `[Cron] delivery_results update failed for notification ${notification_id}:`,
        updateError,
      );
      failed++;
      continue;
    }

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
    .select("id, delivery_results, retry_count, claimed_at")
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
  // receipt 미도착 row를 재조회할 최대 기간. 초과 시 failed로 확정.
  const RECEIPT_WAIT_MAX_MS = 2 * 60 * 60 * 1000;
  // 재시도해도 성공할 수 없는 영구 에러. transient로 오분류하면 retry storm 발생.
  // (MessageRateExceeded 등은 일시적이므로 제외)
  const PERMANENT_ERRORS = [
    "DeviceNotRegistered",
    "InvalidExpoPushToken",
    "InvalidCredentials",
    "MessageTooBig",
    "DeveloperError",
  ];

  type DeliveryResult = {
    token: string;
    ticket_id: string | null;
    status: string;
    error?: string | null;
  };

  // 성공 디바이스가 하나라도 있으면 sent, 전부 실패면 영구/일시 에러 구분해서
  // 일시 에러가 있고 retry 여유가 있으면 backoff 재시도, 아니면 failed.
  // receipt가 아직 안 온 경우(pending_receipt 잔류)는 wait → 재발송 없이 다음 실행에서 재조회.
  function decideOutcome(
    results: DeliveryResult[],
    retryCount: number,
    claimedAt: string | null,
  ): "sent" | "failed" | "retry" | "wait" {
    // 아직 receipt 미도착 토큰이 있으면, cap 이내에는 row를 열어두고 재조회(wait).
    // sent보다 먼저 검사해야 mixed(일부 sent + 일부 pending)에서 남은 receipt를
    // 확인하고 DeviceNotRegistered 토큰을 정리할 수 있다. wait는 재발송이 아니므로 중복 없음.
    const hasPendingReceipt = results.some(
      (r) => r.status === "pending_receipt",
    );
    if (hasPendingReceipt) {
      const claimedMs = claimedAt ? Date.parse(claimedAt) : NaN;
      const withinWindow =
        !Number.isNaN(claimedMs) &&
        Date.now() - claimedMs < RECEIPT_WAIT_MAX_MS;
      if (withinWindow) return "wait";
      // cap 초과: 남은 pending은 포기하고 현재까지 결과로 확정 (아래 로직)
    }

    // 성공 디바이스가 하나라도 있으면 sent로 확정 (cap 초과한 pending이 있어도)
    if (results.some((r) => r.status === "sent")) return "sent";

    const errorDevices = results.filter((r) => r.status === "error");
    const isPermanent = (err?: string | null) =>
      !!err && PERMANENT_ERRORS.some((code) => err.includes(code));
    const hasTransientError = errorDevices.some((r) => !isPermanent(r.error));

    if (hasTransientError && retryCount < MAX_RETRY_COUNT) return "retry";
    return "failed";
  }

  for (const row of rows) {
    const {
      id: notificationId,
      delivery_results: rawResults,
      retry_count: retryCount,
      claimed_at: claimedAt,
    } = row;

    console.log(`[Cron] Checking receipt for notification ${notificationId}`);

    const results = (rawResults ?? []) as DeliveryResult[];

    // 무효 토큰은 모아서 루프 종료 후 일괄 삭제 (중복 제거)
    const tokensToDelete = new Set<string>();

    const isUnregistered = (code?: string, message?: string | null) =>
      code === "DeviceNotRegistered" ||
      (message?.includes("DeviceNotRegistered") ?? false);

    // 유효한 ticket_id 추출
    const ticketIds = results
      .filter((r) => r.ticket_id && r.status === "pending_receipt")
      .map((r) => r.ticket_id as string);

    let finalResults = results;

    if (ticketIds.length > 0) {
      // 영수증 조회
      const { receipts } = await getPushReceipts(ticketIds);

      finalResults = results.map((r) => {
        // ticket 발급 단계에서 이미 영구 에러난 토큰도 삭제 대상
        if (!r.ticket_id) {
          if (r.status === "error" && isUnregistered(undefined, r.error)) {
            tokensToDelete.add(r.token);
          }
          return r;
        }

        const receipt = receipts[r.ticket_id];
        if (!receipt) return r; // receipt 아직 없음

        if (receipt.status === "error") {
          const errCode = receipt.details?.error;
          if (isUnregistered(errCode, receipt.message)) {
            tokensToDelete.add(r.token);
          }
          return { ...r, status: "error", error: errCode ?? receipt.message };
        }

        return { ...r, status: "sent", error: null };
      });
    } else {
      // ticket_id 없는 영구 에러 토큰도 삭제 대상으로 수집
      results.forEach((r) => {
        if (
          !r.ticket_id &&
          r.status === "error" &&
          isUnregistered(undefined, r.error)
        ) {
          tokensToDelete.add(r.token);
        }
      });
    }

    // 무효 토큰 일괄 삭제 (best-effort — 실패해도 상태 확정은 진행)
    if (tokensToDelete.size > 0) {
      const deleteResults = await Promise.all(
        [...tokensToDelete].map((token) =>
          supabase.rpc("delete_unregistered_token", { p_token: token }),
        ),
      );
      deleteResults.forEach((d) => {
        if (d.error) console.error(`[Cron] token delete failed:`, d.error);
      });
    }

    const outcome = decideOutcome(finalResults, retryCount, claimedAt);

    // receipt 아직 미도착: 상태 변경 없이 다음 실행에서 재조회 (재발송 아님)
    if (outcome === "wait") {
      checked++;
      continue;
    }

    if (outcome === "retry") {
      const { error: rescheduleError } = await supabase.rpc(
        "reschedule_notification_with_backoff",
        {
          p_notification_id: notificationId,
          p_retry_count: retryCount,
        },
      );
      if (rescheduleError)
        console.error(
          `[Cron] reschedule failed for notification ${notificationId}:`,
          rescheduleError,
        );
      retried++;
      checked++;
      continue;
    }

    const { error: receiptUpdateError } = await supabase.rpc(
      "update_notification_receipt",
      {
        p_notification_id: notificationId,
        p_delivery_results: finalResults,
        p_final_status: outcome,
      },
    );
    if (receiptUpdateError)
      console.error(
        `[Cron] receipt update failed for notification ${notificationId}:`,
        receiptUpdateError,
      );

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
