"use client";

import type { AdminReportItem } from "@/types";
import ReportDetailPanelView from "./report-detail-panel.view";

interface ReportDetailPanelProps {
  report: AdminReportItem | null;
  processingId: string | null;
  forceShowShopForm?: boolean;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
  onShopAdded: () => void;
}

export default function ReportDetailPanel({
  report,
  processingId,
  forceShowShopForm = false,
  onApprove,
  onReject,
  onShopAdded,
}: ReportDetailPanelProps) {
  const showShopForm =
    forceShowShopForm ||
    (report !== null &&
      report.report_type === "new_shop" &&
      report.status !== "resolved");

  return (
    <ReportDetailPanelView
      report={report}
      processingId={processingId}
      showShopForm={showShopForm}
      onApprove={onApprove}
      onReject={onReject}
      onShopAdded={onShopAdded}
    />
  );
}
