"use client";

import { useState } from "react";
import type { AdminShopOwnerApplicationItem } from "@/types";
import ShopApplicationTableView from "./shop-application-table.view";

interface ShopApplicationTableProps {
  applications: AdminShopOwnerApplicationItem[];
  isLoading: boolean;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string, note: string) => Promise<void>;
  onViewDocuments: (id: string) => Promise<void>;
}

export default function ShopApplicationTable({
  applications,
  isLoading,
  onApprove,
  onReject,
  onViewDocuments,
}: ShopApplicationTableProps) {
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleApprove = async (id: string) => {
    setProcessingId(id);
    try {
      await onApprove(id);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string, note: string) => {
    setProcessingId(id);
    try {
      await onReject(id, note);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <ShopApplicationTableView
      applications={applications}
      isLoading={isLoading}
      processingId={processingId}
      onApprove={handleApprove}
      onReject={handleReject}
      onViewDocuments={onViewDocuments}
    />
  );
}
