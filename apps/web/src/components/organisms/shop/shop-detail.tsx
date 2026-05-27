"use client";

import { useState, useEffect, useCallback } from "react";
import type { Shop, ShopDetail as ShopDetailData, ShopSummary } from "@/types";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  toggleWishlistAsync,
  selectWishlistedSet,
} from "@/store/slices/wishlist.slice";
import ShopDetailView from "./shop-detail.view";

interface ShopDetailProps {
  shopId: string;
  onBack: () => void;
  onReport: (shopId: string) => void;
  onClaim: (shopId: string) => void;
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
  onClaim,
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
  const [isFetchComplete, setIsFetchComplete] = useState(!!initialData);

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
          setIsFetchComplete(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHasError(true);
          setIsLoading(false);
          setIsFetchComplete(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [shopId]);

  const dispatch = useAppDispatch();
  const wishlistedSet = useAppSelector(selectWishlistedSet);
  const isLoggedIn = useAppSelector((s) => s.auth.isLoggedIn);
  const isWishlisted = wishlistedSet.has(shopId);

  const handleCopyAddress = useCallback(() => {
    if (shop?.address) {
      navigator.clipboard.writeText(shop.address).catch(() => {});
    }
  }, [shop]);

  const handleWishlistToggle = useCallback(() => {
    if (!isLoggedIn) return;
    const shopSummary = shop
      ? {
          id: shop.id,
          name: shop.name,
          address: shop.address,
          lat: shop.lat,
          lng: shop.lng,
          tags: shop.tags,
          image_urls: shop.image_urls,
          is_authorized: shop.is_authorized,
          wishlist_count: shop.wishlist_count,
        }
      : undefined;
    dispatch(toggleWishlistAsync({ shopId, shop: shopSummary }));
  }, [dispatch, isLoggedIn, shop, shopId]);

  return (
    <ShopDetailView
      shop={shop}
      isLoading={isLoading}
      isFetchComplete={isFetchComplete}
      hasError={hasError}
      isWishlisted={isWishlisted}
      isLoggedIn={isLoggedIn}
      onBack={onBack}
      onReport={onReport}
      onClaim={onClaim}
      onCopyAddress={handleCopyAddress}
      onWishlistToggle={handleWishlistToggle}
    />
  );
};

export default ShopDetail;
