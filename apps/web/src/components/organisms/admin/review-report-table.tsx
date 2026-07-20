"use client";

import type { AdminReviewReportItem } from "@/types";
import ReviewReportTableView from "./review-report-table.view";

interface ReviewReportTableProps {
  reports: AdminReviewReportItem[];
  isLoading: boolean;
  selectedReportId: string | null;
  onSelectReport: (report: AdminReviewReportItem) => void;
}

export default function ReviewReportTable({
  reports,
  isLoading,
  selectedReportId,
  onSelectReport,
}: ReviewReportTableProps) {
  return (
    <ReviewReportTableView
      reports={reports}
      isLoading={isLoading}
      selectedReportId={selectedReportId}
      onSelectReport={onSelectReport}
    />
  );
}
