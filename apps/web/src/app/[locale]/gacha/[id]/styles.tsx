"use client";

import styled from "styled-components";
import {
  TEXT_DARK,
  TEXT_GRAY,
  TEXT_PLACEHOLDER,
  PRIMARY,
  THUMBNAIL_PLACEHOLDER,
  BORDER,
  LIGHT_GRAY,
} from "@/styles/color";

export const BackLink = styled.a`
  display: inline-block;
  font-size: 13px;
  color: ${TEXT_GRAY};
  margin-bottom: 16px;
  text-decoration: none;
  cursor: pointer;
  &:hover {
    color: ${TEXT_DARK};
  }
`;

export const ProductSection = styled.div`
  display: flex;
  gap: 16px;
  padding: 16px;
  background: #fff;
  border-radius: 12px;
  margin-bottom: 8px;
`;

export const ProductImageWrapper = styled.div`
  flex-shrink: 0;
  width: 120px;
  height: 120px;
  border-radius: 10px;
  overflow: hidden;
  background: ${THUMBNAIL_PLACEHOLDER};
  display: flex;
  align-items: center;
  justify-content: center;
`;

export const ProductImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

export const ProductImagePlaceholder = styled.span`
  font-size: 40px;
  color: ${TEXT_PLACEHOLDER};
`;

export const ProductInfo = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
`;

export const ProductName = styled.h1`
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: ${TEXT_DARK};
  line-height: 1.3;
`;

export const ProductMeta = styled.p`
  margin: 0;
  font-size: 13px;
  color: ${TEXT_GRAY};
`;

export const ProductPrice = styled.p`
  margin: 0;
  font-size: 12px;
  color: ${TEXT_GRAY};
`;

export const ShopsSection = styled.div`
  margin-top: 8px;
`;

export const ShopsTitle = styled.h2`
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 700;
  color: ${TEXT_DARK};
  padding: 0 4px;
`;

export const ShopsList = styled.div`
  display: flex;
  flex-direction: column;
`;

export const ShopCard = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 4px;
  border-bottom: 1px solid ${BORDER};
  cursor: pointer;
  &:hover {
    background: ${LIGHT_GRAY};
  }
`;

export const ShopImageWrapper = styled.div`
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  border-radius: 8px;
  overflow: hidden;
  background: ${THUMBNAIL_PLACEHOLDER};
`;

export const ShopImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

export const ShopImagePlaceholder = styled.div`
  width: 100%;
  height: 100%;
  background: ${THUMBNAIL_PLACEHOLDER};
`;

export const ShopInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

export const ShopName = styled.p`
  margin: 0 0 2px;
  font-size: 13px;
  font-weight: 700;
  color: ${TEXT_DARK};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const ShopAddress = styled.p`
  margin: 0;
  font-size: 11px;
  color: ${TEXT_GRAY};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const ShopPrice = styled.span`
  flex-shrink: 0;
  font-size: 14px;
  font-weight: 700;
  color: ${PRIMARY};
`;

export const ShopPriceUnknown = styled.span`
  flex-shrink: 0;
  font-size: 12px;
  color: ${TEXT_GRAY};
`;

export const EmptyShops = styled.div`
  text-align: center;
  padding: 40px 16px;
  font-size: 14px;
  color: ${TEXT_GRAY};
`;
