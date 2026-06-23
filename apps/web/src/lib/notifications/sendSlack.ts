import "server-only";
import type { ReportType } from "@/types";

const REPORT_TYPE_LABEL: Record<ReportType, string> = {
  new_shop: "🆕 새 가게 제보",
  fix_info: "✏️ 정보 수정 요청",
  closed: "🚪 폐업 신고",
  other: "📝 기타",
};

function escapeSlack(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function notifyNewReport(params: {
  id: string;
  report_type: ReportType;
  content: string;
  proposed_shop_name?: string | null;
}): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  const label = REPORT_TYPE_LABEL[params.report_type];
  const preview =
    params.content.length > 0
      ? escapeSlack(params.content.slice(0, 100)) +
        (params.content.length > 100 ? "…" : "")
      : null;

  const baseUrl = process.env.APP_BASE_URL ?? "";
  const adminLink = baseUrl
    ? `<${baseUrl}/ko/admin/reports|어드민에서 확인>`
    : "어드민 > 제보 관리에서 확인";

  const lines = [
    `*${label}*`,
    params.proposed_shop_name
      ? `가게명: ${escapeSlack(params.proposed_shop_name)}`
      : null,
    preview ? `내용: ${preview}` : null,
    adminLink,
  ]
    .filter(Boolean)
    .join("\n");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4_000);

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: lines }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error(`[Slack] webhook non-2xx: ${res.status}`);
    }
  } catch (err) {
    console.error(
      `[Slack] webhook error:`,
      err instanceof Error ? err.message : err,
    );
  } finally {
    clearTimeout(timeout);
  }
}
