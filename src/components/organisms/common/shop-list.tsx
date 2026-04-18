"use client";

import { useEffect, useRef } from "react";
import styled from "styled-components";
import { useTranslations } from "next-intl";
import ShopCard from "@/components/molecules/common/shop-card";
import SortBar, {
  type SortOption,
} from "@/components/molecules/common/sort-bar";
import type { ShopSummary } from "@/types";

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
}

const List = styled.ul`
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  list-style: none;
`;

const Empty = styled.li`
  text-align: center;
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.gray400};
  padding: 40px 0;
`;

const LoadingItem = styled.li`
  text-align: center;
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.gray400};
  padding: 40px 0;
`;

const LoadingMore = styled.li`
  text-align: center;
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.gray400};
  padding: 12px 0;
`;

const Sentinel = styled.li`
  height: 4px;
  flex-shrink: 0;
`;

const LOAD_COOLDOWN_MS = 500;

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`;

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
}: ShopListProps) => {
  const t = useTranslations("shopList");

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
    <Wrapper>
      {onSortChange && <SortBar value={sort} onChange={onSortChange} />}
      <List>
        {isLoading && <LoadingItem>{t("loading")}</LoadingItem>}
        {!isLoading &&
          shops.map((shop) => (
            <li key={shop.id}>
              <ShopCard
                shop={shop}
                wishlisted={wishlisted?.has(shop.id)}
                onWishlistToggle={onWishlistToggle}
                isSelected={shop.id === selectedShopId}
                onSelect={onShopSelect}
              />
            </li>
          ))}
        {!isLoading && shops.length === 0 && (
          <Empty>{emptyMessage ?? t("empty")}</Empty>
        )}
        {!isLoading && isLoadingMore && (
          <LoadingMore>{t("loadingMore")}</LoadingMore>
        )}
        {!isLoading && <Sentinel ref={sentinelRef} aria-hidden="true" />}
      </List>
    </Wrapper>
  );
};

export default ShopList;
