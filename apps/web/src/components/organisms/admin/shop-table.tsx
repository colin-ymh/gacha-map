"use client";

import { useState } from "react";
import type { AdminShopItem } from "@/types";
import ShopTableView from "./shop-table.view";

interface ShopTableProps {
  shops: AdminShopItem[];
  isLoading: boolean;
  onStatusChange: (shopId: string, newStatus: "active" | "hidden") => Promise<void>;
  onDisconnectOwner: (shopId: string) => Promise<void>;
  hideAction?: boolean;
}

export default function ShopTable({
  shops,
  isLoading,
  onStatusChange,
  onDisconnectOwner,
  hideAction = false,
}: ShopTableProps) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  const handleActionClick = async (shopId: string) => {
    setUpdatingId(shopId);
    try {
      const newStatus = hideAction ? "active" : "hidden";
      await onStatusChange(shopId, newStatus);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDisconnectClick = async (shopId: string) => {
    setDisconnectingId(shopId);
    try {
      await onDisconnectOwner(shopId);
    } finally {
      setDisconnectingId(null);
    }
  };

  return (
    <ShopTableView
      shops={shops}
      isLoading={isLoading}
      updatingId={updatingId}
      disconnectingId={disconnectingId}
      hideAction={hideAction}
      onActionClick={handleActionClick}
      onDisconnectClick={handleDisconnectClick}
    />
  );
}
