"use client";

import type { AdminReportItem } from "@/types";
import ReportTableView from "./report-table.view";

interface ReportTableProps {
  reports: AdminReportItem[];
  isLoading: boolean;
  selectedReportId: string | null;
  onSelectReport: (report: AdminReportItem) => void;
}

export default function ReportTable({
  reports,
  isLoading,
  selectedReportId,
  onSelectReport,
}: ReportTableProps) {
  return (
    <ReportTableView
      reports={reports}
      isLoading={isLoading}
      selectedReportId={selectedReportId}
      onSelectReport={onSelectReport}
    />
  );
}
