"use client";

import { useState, useEffect, useCallback } from "react";
import type { Shop, ShopDetail as ShopDetailData, ShopSummary } from "@/types";
import ShopDetailView from "./shop-detail.view";

interface ShopDetailProps {
  shopId: string;
  onBack: () => void;
  onReport: (shopId: string) => void;
  initialData?: ShopDetailData;
  initialSummary?: ShopSummary;
}

function summaryToShop(summary: ShopSummary): Shop {
  return {
    ...summary,
    status: "active",
    description: null,
    place_id: null,
    candidate_group_id: null,
    reported_by: null,
    created_at: "",
    updated_at: "",
  };
}

const ShopDetail = ({
  shopId,
  onBack,
  onReport,
  initialData,
  initialSummary,
}: ShopDetailProps) => {
  const [shop, setShop] = useState<Shop | null>(() => {
    if (initialData) return initialData as unknown as Shop;
    if (initialSummary) return summaryToShop(initialSummary);
    return null;
  });
  const [isLoading, setIsLoading] = useState(!initialData && !initialSummary);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/shops/${shopId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          setShop(data.shop);
          setHasError(false);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHasError(true);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [shopId]);

  const handleCopyAddress = useCallback(() => {
    if (shop?.address) {
      navigator.clipboard.writeText(shop.address).catch(() => {});
    }
  }, [shop]);

  return (
    <ShopDetailView
      shop={shop}
      isLoading={isLoading}
      hasError={hasError}
      onBack={onBack}
      onReport={onReport}
      onCopyAddress={handleCopyAddress}
    />
  );
};

export default ShopDetail;
