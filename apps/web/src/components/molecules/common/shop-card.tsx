"use client";

import styled from "styled-components";
import { useTranslations } from "next-intl";
import Tag from "@/components/atoms/common/tag";
import { HeartFilledIcon, HeartOutlineIcon } from "@/components/atoms/icons";
import type { ShopSummary } from "@/types";

interface ShopCardProps {
  shop: ShopSummary;
  wishlisted?: boolean;
  onWishlistToggle?: (shopId: string) => void;
  isSelected?: boolean;
  onSelect?: (shopId: string) => void;
}

const Card = styled.div<{ $isSelected?: boolean }>`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  background: ${({ $isSelected, theme }) =>
    $isSelected ? theme.colors.gray100 : "transparent"};
  border-left: 3px solid
    ${({ $isSelected, theme }) =>
      $isSelected ? theme.colors.primary : "transparent"};
`;

const Body = styled.div`
  flex: 1;
  min-width: 0;
`;

const CardBody = styled.div`
  display: block;
`;

const Name = styled.h3`
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textDark};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 0;

  ${Card}:hover & {
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const Address = styled.p`
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ theme }) => theme.colors.textGray};
  margin: 2px 0 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Tags = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
`;

const WishlistArea = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
  align-self: flex-start;
  gap: 2px;
`;

const WishlistButton = styled.button<{ $wishlisted?: boolean }>`
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ $wishlisted, theme }) =>
    $wishlisted ? theme.colors.primary : theme.colors.textGray};

  &:hover {
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const WishlistCount = styled.span`
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textGray};
  line-height: 1;
`;

const ShopCard = ({
  shop,
  wishlisted,
  onWishlistToggle,
  isSelected,
  onSelect,
}: ShopCardProps) => {
  const t = useTranslations("shopCard");

  return (
    <Card $isSelected={isSelected} onClick={() => onSelect?.(shop.id)}>
      <Body>
        <CardBody>
          <Name>{shop.name}</Name>
          <Address>{shop.address}</Address>
        </CardBody>
        {shop.tags.length > 0 && (
          <Tags>
            {shop.tags.map((tag) => (
              <Tag key={tag} label={tag} />
            ))}
          </Tags>
        )}
      </Body>
      <WishlistArea>
        <WishlistButton
          onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
            e.stopPropagation();
            onWishlistToggle?.(shop.id);
          }}
          aria-label={wishlisted ? t("unwishlist") : t("wishlist")}
          $wishlisted={wishlisted}
        >
          {wishlisted ? (
            <HeartFilledIcon size={20} />
          ) : (
            <HeartOutlineIcon size={20} />
          )}
        </WishlistButton>
        {typeof shop.wishlist_count === "number" && (
          <WishlistCount>{shop.wishlist_count}</WishlistCount>
        )}
      </WishlistArea>
    </Card>
  );
};

export default ShopCard;
