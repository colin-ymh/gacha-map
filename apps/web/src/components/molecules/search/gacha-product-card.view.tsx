"use client";

import styled from "styled-components";
import {
  PRIMARY,
  TEXT_DARK,
  TEXT_GRAY,
  TEXT_PLACEHOLDER,
  THUMBNAIL_PLACEHOLDER,
  CARD_BG,
  SHIMMER_BASE,
} from "@/styles/color";

interface GachaProductCardViewProps {
  name: string;
  manufacturer: string;
  priceJpy: number | null;
  imageUrl: string | null;
  minPriceKrw: number | null;
  availableShopsLabel: string;
  minPriceLabel: string;
  noPriceLabel: string;
  onClick: () => void;
}

const CardContainer = styled.div`
  display: flex;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  background: ${CARD_BG};
  cursor: pointer;
  transition: background 0.2s ease;

  &:hover {
    background: ${SHIMMER_BASE};
  }
`;

const ImageWrapper = styled.div`
  flex-shrink: 0;
  width: 64px;
  height: 64px;
  border-radius: 6px;
  overflow: hidden;
  background: ${THUMBNAIL_PLACEHOLDER};
  display: flex;
  align-items: center;
  justify-content: center;
`;

const Image = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const ContentWrapper = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
`;

const ProductName = styled.h3`
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: ${TEXT_DARK};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Manufacturer = styled.p`
  margin: 0;
  font-size: 12px;
  color: ${TEXT_GRAY};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const PriceWrapper = styled.div`
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: ${TEXT_GRAY};
  margin-top: 2px;
`;

const PriceItem = styled.span`
  white-space: nowrap;
`;

const ShopsInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
`;

const ShopsCount = styled.span`
  font-size: 12px;
  color: ${PRIMARY};
  font-weight: 500;
`;

export default function GachaProductCardView({
  name,
  manufacturer,
  priceJpy,
  imageUrl,
  minPriceKrw,
  availableShopsLabel,
  minPriceLabel,
  noPriceLabel,
  onClick,
}: GachaProductCardViewProps) {
  return (
    <CardContainer onClick={onClick}>
      <ImageWrapper>
        {imageUrl ? (
          <Image src={imageUrl} alt={name} />
        ) : (
          <span style={{ color: TEXT_PLACEHOLDER, fontSize: "24px" }}>🎰</span>
        )}
      </ImageWrapper>
      <ContentWrapper>
        <ProductName>{name}</ProductName>
        <Manufacturer>{manufacturer}</Manufacturer>
        {priceJpy && (
          <PriceWrapper>
            <PriceItem>¥{priceJpy.toLocaleString()}</PriceItem>
          </PriceWrapper>
        )}
        <ShopsInfo>
          <ShopsCount>{availableShopsLabel}</ShopsCount>
          {minPriceKrw ? (
            <ShopsCount>{minPriceLabel}</ShopsCount>
          ) : (
            <PriceItem>{noPriceLabel}</PriceItem>
          )}
        </ShopsInfo>
      </ContentWrapper>
    </CardContainer>
  );
}
