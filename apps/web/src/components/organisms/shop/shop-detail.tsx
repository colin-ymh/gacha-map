"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { Shop, ShopDetail as ShopDetailData, ShopSummary } from "@/types";
import type { QuickReportKind } from "@gacha-map/shared";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  toggleWishlistAsync,
  selectWishlistedSet,
} from "@/store/slices/wishlist.slice";
import {
  cacheShop,
  selectCachedShop,
  selectCachedShopAny,
} from "@/store/slices/shop-cache.slice";
import ShopDetailView from "./shop-detail.view";
import type { TabKey } from "@/components/molecules/tab-bar";

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
    phone: null,
    opening_hours: null,
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
  const dispatch = useAppDispatch();
  const wishlistedSet = useAppSelector(selectWishlistedSet);
  const isLoggedIn = useAppSelector((s) => s.auth.isLoggedIn);
  const isWishlisted = wishlistedSet.has(shopId);

  const freshCached = useAppSelector((s) => selectCachedShop(s, shopId));
  const anyCached = useAppSelector((s) => selectCachedShopAny(s, shopId));

  // hadInitialData: SSR provided full data on mount — never re-fetch
  const hadInitialDataRef = useRef(!!initialData);

  const [activeTab, setActiveTab] = useState<TabKey>("products");
  const [visitedTabs, setVisitedTabs] = useState<Set<TabKey>>(
    new Set<TabKey>(["products"]),
  );

  // fetchedData: result from network fetch for current shopId (null = not yet fetched)
  const [fetchedData, setFetchedData] = useState<Shop | null>(() =>
    initialData ? (initialData as unknown as Shop) : null,
  );
  const [hasError, setHasError] = useState(false);
  const [isFetchComplete, setIsFetchComplete] = useState(
    !!initialData || !!freshCached,
  );
  const [userQuickReport, setUserQuickReport] =
    useState<QuickReportKind | null>(null);

  const [prevShopId, setPrevShopId] = useState(shopId);
  if (prevShopId !== shopId) {
    setPrevShopId(shopId);
    setFetchedData(null);
    setHasError(false);
    setIsFetchComplete(!!freshCached);
    setActiveTab("products");
    setVisitedTabs(new Set<TabKey>(["products"]));
  }

  const handleTabChange = useCallback((tab: TabKey) => {
    setActiveTab(tab);
    setVisitedTabs((prev) => new Set([...prev, tab]));
  }, []);

  // Derived display data — no setState needed for cache hits
  const shop = useMemo<Shop | null>(
    () =>
      fetchedData ??
      freshCached ??
      anyCached ??
      (initialSummary ? summaryToShop(initialSummary) : null),
    [fetchedData, freshCached, anyCached, initialSummary],
  );
  const isLoading = !shop;

  useEffect(() => {
    // SSR provided full data — skip client fetch
    if (hadInitialDataRef.current) return;

    // Fresh cache hit captured from latest render closure — skip fetch
    if (freshCached) return;

    let cancelled = false;

    fetch(`/api/shops/${shopId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          setFetchedData(data.shop);
          dispatch(cacheShop({ id: shopId, data: data.shop }));
          setHasError(false);
          setIsFetchComplete(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHasError(true);
          setIsFetchComplete(true);
        }
      });

    return () => {
      cancelled = true;
    };
    // freshCached intentionally omitted: on shopId change the closure captures the new
    // shopId's cache state; adding it as dep would re-run after caching and cancel the fetch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId, dispatch]);

  const handleCopyAddress = useCallback(() => {
    if (shop?.address) {
      navigator.clipboard.writeText(shop.address).catch(() => {});
    }
  }, [shop]);

  const handleWishlistToggle = useCallback(() => {
    if (!isLoggedIn) return;
    const shopSummary: ShopSummary | undefined = shop
      ? {
          id: shop.id,
          name: shop.name,
          address: shop.address,
          lat: shop.lat,
          lng: shop.lng,
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
      activeTab={activeTab}
      visitedTabs={visitedTabs}
      onTabChange={handleTabChange}
      onBack={onBack}
      onReport={onReport}
      onClaim={onClaim}
      onCopyAddress={handleCopyAddress}
      onWishlistToggle={handleWishlistToggle}
      userQuickReport={userQuickReport}
      onUserQuickReportChange={setUserQuickReport}
    />
  );
};

export default ShopDetail;
