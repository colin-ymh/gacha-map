"use client";

import { useEffect, useRef } from "react";
import type { SortOption } from "@/components/molecules/common/sort-bar";
import type { ShopSummary } from "@/types";
import ShopListView from "./shop-list.view";

interface ShopListProps {
  shops: ShopSummary[];
  emptyMessage?: string;
  wishlisted?: Set<string>;
  onWishlistToggle?: (shopId: string) => void;
  selectedShopId?: string;
  onShopSelect?: (shopId: string) => void;
  isLoading?: boolean;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  sort?: SortOption;
  onSortChange?: (sort: SortOption) => void;
  searchQuery?: string;
  onSearch?: (q: string) => void;
}

const LOAD_COOLDOWN_MS = 500;

const ShopList = ({
  shops,
  emptyMessage,
  wishlisted,
  onWishlistToggle,
  selectedShopId,
  onShopSelect,
  isLoading = false,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  sort = "name",
  onSortChange,
  searchQuery,
  onSearch,
}: ShopListProps) => {
  const sentinelRef = useRef<HTMLLIElement | null>(null);
  const isLoadingMoreRef = useRef(isLoadingMore);
  const onLoadMoreRef = useRef(onLoadMore);
  const lastLoadAtRef = useRef(0);

  useEffect(() => {
    isLoadingMoreRef.current = isLoadingMore;
  }, [isLoadingMore]);

  useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
  }, [onLoadMore]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        if (isLoadingMoreRef.current) return;
        const now = Date.now();
        if (now - lastLoadAtRef.current < LOAD_COOLDOWN_MS) return;
        lastLoadAtRef.current = now;
        onLoadMoreRef.current?.();
      },
      { threshold: 0 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore]);

  return (
    <ShopListView
      shops={shops}
      emptyMessage={emptyMessage}
      wishlisted={wishlisted}
      onWishlistToggle={onWishlistToggle}
      selectedShopId={selectedShopId}
      onShopSelect={onShopSelect}
      isLoading={isLoading}
      hasMore={hasMore}
      isLoadingMore={isLoadingMore}
      sort={sort}
      onSortChange={onSortChange}
      sentinelRef={sentinelRef}
      searchQuery={searchQuery}
      onSearch={onSearch}
    />
  );
};

export default ShopList;
