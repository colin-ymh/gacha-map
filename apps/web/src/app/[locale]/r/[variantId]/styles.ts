"use client";

import styled from "styled-components";

export const Page = styled.main`
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 28px;
  padding: 40px 20px 56px;
  background: linear-gradient(
    180deg,
    ${({ theme }) => theme.colors.white} 0%,
    ${({ theme }) => theme.colors.primaryBg} 100%
  );
`;

export const Lead = styled.h1`
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  text-align: center;
  color: ${({ theme }) => theme.colors.textDark};
`;

export const Card = styled.section`
  width: 100%;
  max-width: 340px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 28px 24px;
  border-radius: 24px;
  background-color: ${({ theme }) => theme.colors.white};
  border: 1px solid ${({ theme }) => theme.colors.border};
  box-shadow: ${({ theme }) => theme.shadow.md};
`;

export const ProductImage = styled.img`
  width: 100%;
  max-width: 240px;
  aspect-ratio: 1;
  object-fit: contain;
`;

export const ImageFallback = styled.div`
  width: 100%;
  max-width: 240px;
  aspect-ratio: 1;
  border-radius: 16px;
  background-color: ${({ theme }) => theme.colors.primaryBg};
`;

export const BegLogoImage = styled.img`
  width: 100%;
  max-width: 160px;
  aspect-ratio: 1;
  object-fit: contain;
`;

export const VariantName = styled.h2`
  margin: 0;
  font-size: 22px;
  font-weight: 800;
  text-align: center;
  color: ${({ theme }) => theme.colors.textDark};
`;

export const VariantSubName = styled.p`
  margin: 0;
  font-size: 13px;
  text-align: center;
  color: ${({ theme }) => theme.colors.textGray};
`;

export const CtaGroup = styled.div`
  width: 100%;
  max-width: 340px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
`;

export const CtaCaption = styled.p`
  margin: 0;
  font-size: 14px;
  text-align: center;
  color: ${({ theme }) => theme.colors.textGray};
`;

export const StoreButton = styled.a`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 52px;
  padding: 0 20px;
  border-radius: ${({ theme }) => theme.borderRadius.xl};
  background-color: ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.white};
  font-size: 16px;
  font-weight: 700;
  text-decoration: none;

  &:hover {
    background-color: ${({ theme }) => theme.colors.primaryHover};
  }
`;

export const StoreButtonDisabled = styled.span`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 52px;
  padding: 0 20px;
  border-radius: ${({ theme }) => theme.borderRadius.xl};
  background-color: ${({ theme }) => theme.colors.gray100};
  color: ${({ theme }) => theme.colors.textGray};
  font-size: 16px;
  font-weight: 600;
`;
