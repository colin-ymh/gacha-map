"use client";

import type { AdminReviewReportItem } from "@/types";
import ReviewReportDetailPanelView from "./review-report-detail-panel.view";

interface ReviewReportDetailPanelProps {
  report: AdminReviewReportItem | null;
  processingId: string | null;
  isDeleting: boolean;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
  onDeleteReview: (report: AdminReviewReportItem) => Promise<void>;
}

export default function ReviewReportDetailPanel({
  report,
  processingId,
  isDeleting,
  onApprove,
  onReject,
  onDeleteReview,
}: ReviewReportDetailPanelProps) {
  return (
    <ReviewReportDetailPanelView
      report={report}
      processingId={processingId}
      isDeleting={isDeleting}
      onApprove={onApprove}
      onReject={onReject}
      onDeleteReview={onDeleteReview}
    />
  );
}
