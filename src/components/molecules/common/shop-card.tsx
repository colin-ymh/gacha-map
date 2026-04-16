"use client";

import styled from "styled-components";
import { useTranslations } from "next-intl";
import Tag from "@/components/atoms/common/tag";
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

const Thumbnail = styled.div<{ $hasImage: boolean }>`
  width: 68px;
  height: 68px;
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  background: ${({ theme }) => theme.colors.thumbnailPlaceholder};
  flex-shrink: 0;
  overflow: hidden;
`;

const ThumbnailImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
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

const WishlistButton = styled.button<{ $wishlisted?: boolean }>`
  background: none;
  border: none;
  font-size: 1.1rem;
  flex-shrink: 0;
  align-self: flex-start;
  cursor: pointer;
  padding: 2px;
  line-height: 1;
  color: ${({ theme }) => theme.colors.textGray};

  &:hover {
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const ShopCard = ({
  shop,
  wishlisted,
  onWishlistToggle,
  isSelected,
  onSelect,
}: ShopCardProps) => {
  const t = useTranslations("shopCard");
  const thumbnail = shop.image_urls[0];

  return (
    <Card $isSelected={isSelected} onClick={() => onSelect?.(shop.id)}>
      <Thumbnail $hasImage={!!thumbnail}>
        {thumbnail && <ThumbnailImg src={thumbnail} alt={shop.name} />}
      </Thumbnail>
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
      <WishlistButton
        onClick={() => onWishlistToggle?.(shop.id)}
        aria-label={wishlisted ? t("unwishlist") : t("wishlist")}
        $wishlisted={wishlisted}
      >
        {wishlisted ? "\u2665" : "\u2661"}
      </WishlistButton>
    </Card>
  );
};

export default ShopCard;
