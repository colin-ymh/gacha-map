"use client";

import styled from "styled-components";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { WishlistedProduct } from "@/store/slices/product-wishlist.slice";

// ── Styled ────────────────────────────────────────────────────────────────────

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
`;

const CountBar = styled.div`
  padding: 12px 16px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.gray100};
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.gray500};
`;

const List = styled.ul`
  flex: 1;
  overflow-y: auto;
  list-style: none;
  padding: 0;
  margin: 0;
`;

const CardItem = styled.li`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.gray100};
  cursor: pointer;
  transition: background 0.1s;

  &:hover {
    background: ${({ theme }) => theme.colors.gray50};
  }
`;

const Thumb = styled.div`
  width: 52px;
  height: 52px;
  border-radius: 8px;
  background: ${({ theme }) => theme.colors.thumbnailPlaceholder};
  overflow: hidden;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
`;

const Info = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const ProductName = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textDark};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Manufacturer = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ theme }) => theme.colors.gray500};
`;

const ShopCount = styled.p<{ $available: boolean }>`
  margin: 0;
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ $available, theme }) =>
    $available ? theme.colors.primary : theme.colors.gray400};
`;

const HeartButton = styled.button<{ $wished: boolean }>`
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  font-size: 20px;
  line-height: 1;
  color: ${({ $wished, theme }) =>
    $wished ? theme.colors.primary : theme.colors.gray400};
  flex-shrink: 0;
  transition: color 0.15s;

  &:disabled {
    cursor: default;
    opacity: 0.5;
  }
`;

const Loading = styled.div`
  padding: 48px 16px;
  text-align: center;
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.gray400};
`;

const EmptyBox = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 64px 24px;
  gap: 16px;
`;

const EmptyText = styled.p`
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.gray400};
  margin: 0;
  text-align: center;
`;

const ExploreButton = styled.button`
  padding: 10px 20px;
  background: ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.white};
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: 600;
  cursor: pointer;

  &:hover {
    opacity: 0.88;
  }
`;

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  products: WishlistedProduct[];
  isLoading: boolean;
  pendingToggleCount: number;
  onProductSelect: (productId: string) => void;
  onWishToggle: (product: WishlistedProduct) => void;
  onExplore: () => void;
}

// ── View ──────────────────────────────────────────────────────────────────────

export default function ProductWishlistListView({
  products,
  isLoading,
  pendingToggleCount,
  onProductSelect,
  onWishToggle,
  onExplore,
}: Props) {
  const t = useTranslations("wishlist");

  if (isLoading) {
    return (
      <Wrapper>
        <Loading>{t("loading")}</Loading>
      </Wrapper>
    );
  }

  if (products.length === 0) {
    return (
      <Wrapper>
        <EmptyBox>
          <EmptyText>{t("productEmpty")}</EmptyText>
          <ExploreButton onClick={onExplore}>
            {t("productEmptyAction")}
          </ExploreButton>
        </EmptyBox>
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      <CountBar>{t("productCount", { count: products.length })}</CountBar>
      <List>
        {products.map((product) => {
          const displayName = product.name_ko ?? product.name ?? "";
          const hasAvailableShops = product.available_shop_count > 0;
          return (
            <CardItem
              key={product.id}
              onClick={() => onProductSelect(product.id)}
            >
              <Thumb>
                {product.official_image_url ? (
                  <Image
                    src={product.official_image_url}
                    alt={displayName}
                    width={52}
                    height={52}
                    style={{ objectFit: "cover" }}
                  />
                ) : (
                  "🎰"
                )}
              </Thumb>
              <Info>
                <ProductName>{displayName}</ProductName>
                {product.manufacturer && (
                  <Manufacturer>{product.manufacturer}</Manufacturer>
                )}
                <ShopCount $available={hasAvailableShops}>
                  {hasAvailableShops
                    ? t("productAvailableShops", {
                        count: product.available_shop_count,
                      })
                    : t("productNoAvailableShops")}
                </ShopCount>
              </Info>
              <HeartButton
                $wished
                disabled={pendingToggleCount > 0}
                onClick={(e) => {
                  e.stopPropagation();
                  onWishToggle(product);
                }}
                aria-label="찜 취소"
              >
                ♥
              </HeartButton>
            </CardItem>
          );
        })}
      </List>
    </Wrapper>
  );
}
