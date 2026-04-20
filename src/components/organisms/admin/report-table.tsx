"use client";

import { useState } from "react";
import type { AdminReportItem } from "@/types";
import ReportTableView from "./report-table.view";

interface ReportTableProps {
  reports: AdminReportItem[];
  isLoading: boolean;
  onApprove: (reportId: string) => Promise<void>;
  onReject: (reportId: string) => Promise<void>;
}

export default function ReportTable({
  reports,
  isLoading,
  onApprove,
  onReject,
}: ReportTableProps) {
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleApprove = async (reportId: string) => {
    setProcessingId(reportId);
    try {
      await onApprove(reportId);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (reportId: string) => {
    setProcessingId(reportId);
    try {
      await onReject(reportId);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <ReportTableView
      reports={reports}
      isLoading={isLoading}
      processingId={processingId}
      onApprove={handleApprove}
      onReject={handleReject}
    />
  );
}
