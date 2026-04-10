"use client";

import styled from "styled-components";
import { useTranslations } from "next-intl";
import ShopCard from "@/components/molecules/common/shop-card";
import type { Shop } from "@/types";

interface ShopListProps {
  shops: Shop[];
  emptyMessage?: string;
  showCount?: boolean;
  wishlisted?: Set<string>;
  onWishlistToggle?: (shopId: string) => void;
  selectedShopId?: string;
  onShopSelect?: (shopId: string) => void;
  isLoading?: boolean;
}

const ListHeader = styled.div`
  padding: 12px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.gray100};
`;

const Count = styled.p`
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.gray500};
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

const ShopList = ({
  shops,
  emptyMessage,
  showCount = false,
  wishlisted,
  onWishlistToggle,
  selectedShopId,
  onShopSelect,
  isLoading = false,
}: ShopListProps) => {
  const t = useTranslations("shopList");

  return (
    <>
      {showCount && (
        <ListHeader>
          <Count>{t("count", { count: shops.length })}</Count>
        </ListHeader>
      )}
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
      </List>
    </>
  );
};

export default ShopList;
