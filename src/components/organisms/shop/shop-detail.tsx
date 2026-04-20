"use client";

import { useState, useEffect, useCallback } from "react";
import type { Shop } from "@/types";
import ShopDetailView from "./shop-detail.view";

interface ShopDetailProps {
  shopId: string;
  onBack: () => void;
  onReport: (shopId: string) => void;
}

const ShopDetail = ({ shopId, onBack, onReport }: ShopDetailProps) => {
  const [shop, setShop] = useState<Shop | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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
