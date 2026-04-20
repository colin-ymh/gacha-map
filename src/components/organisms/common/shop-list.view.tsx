"use client";

import styled from "styled-components";
import { useTranslations } from "next-intl";
import ShopCard from "@/components/molecules/common/shop-card";
import SortBar, {
  type SortOption,
} from "@/components/molecules/common/sort-bar";
import type { ShopSummary } from "@/types";

// ── Styled ────────────────────────────────────────────────────────────────────

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`;

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

export const Sentinel = styled.li`
  height: 4px;
  flex-shrink: 0;
`;

// ── View ──────────────────────────────────────────────────────────────────────

interface ShopListViewProps {
  shops: ShopSummary[];
  emptyMessage?: string;
  wishlisted?: Set<string>;
  onWishlistToggle?: (shopId: string) => void;
  selectedShopId?: string;
  onShopSelect?: (shopId: string) => void;
  isLoading?: boolean;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  sort?: SortOption;
  onSortChange?: (sort: SortOption) => void;
  sentinelRef: React.RefObject<HTMLLIElement | null>;
}

const ShopListView = ({
  shops,
  emptyMessage,
  wishlisted,
  onWishlistToggle,
  selectedShopId,
  onShopSelect,
  isLoading = false,
  isLoadingMore = false,
  sort = "name",
  onSortChange,
  sentinelRef,
}: ShopListViewProps) => {
  const t = useTranslations("shopList");

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

export default ShopListView;
