"use client";

import { useState, useEffect, useCallback } from "react";
import styled from "styled-components";
import { useTranslations } from "next-intl";
import Button from "@/components/atoms/common/button";
import Tag from "@/components/atoms/common/tag";
import type { Shop } from "@/types";

interface ShopDetailProps {
  shopId: string;
  onBack: () => void;
  onReport: (shopId: string) => void;
}

// ── Layout ──────────────────────────────────────────────────────────────────

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
`;

const TopBar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  flex-shrink: 0;
`;

const BackButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.gray600};
  font-size: ${({ theme }) => theme.fontSize.sm};
  padding: 4px;
  display: flex;
  align-items: center;
  gap: 4px;

  &:hover {
    color: ${({ theme }) => theme.colors.gray900};
  }
`;

const TopBarTitle = styled.span`
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.gray800};
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

// ── Image slider ─────────────────────────────────────────────────────────────

const ImageSlider = styled.div`
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: ${({ theme }) => theme.colors.gray100};
  flex-shrink: 0;
`;

const SliderImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const ImagePlaceholder = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.gray400};
  font-size: ${({ theme }) => theme.fontSize.sm};
`;

// ── Content ───────────────────────────────────────────────────────────────────

const Content = styled.div`
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
`;

const NameRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`;

const ShopName = styled.h1`
  font-size: ${({ theme }) => theme.fontSize.xl};
  font-weight: 700;
  color: ${({ theme }) => theme.colors.gray900};
  margin: 0;
`;

const AuthBadge = styled.span`
  font-size: ${({ theme }) => theme.fontSize.xs};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.primary};
  background: ${({ theme }) => theme.colors.primaryBg};
  border-radius: ${({ theme }) => theme.borderRadius.full};
  padding: 2px 8px;
  white-space: nowrap;
`;

const Divider = styled.hr`
  border: none;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  margin: 0;
`;

const AddressRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;

const AddressText = styled.p`
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.gray700};
  margin: 0;
  flex: 1;
`;

const CopyButton = styled.button`
  background: none;
  border: 1px solid ${({ theme }) => theme.colors.gray300};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: 4px 8px;
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ theme }) => theme.colors.gray600};
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;

  &:hover {
    background: ${({ theme }) => theme.colors.gray50};
  }
`;

const TagsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const Description = styled.p`
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.gray700};
  line-height: 1.6;
  margin: 0;
  white-space: pre-wrap;
`;

const Footer = styled.div`
  padding: 16px;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  flex-shrink: 0;
`;

// ── State views ───────────────────────────────────────────────────────────────

const StateContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: 12px;
  padding: 40px 16px;
  text-align: center;
`;

const StateText = styled.p`
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.gray500};
  margin: 0;
`;

// ── Component ─────────────────────────────────────────────────────────────────

const ShopDetail = ({ shopId, onBack, onReport }: ShopDetailProps) => {
  const t = useTranslations("shopDetail");
  const [shop, setShop] = useState<Shop | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/shops/${shopId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          setShop(data.shop);
          setHasError(false);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHasError(true);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [shopId]);

  const handleCopyAddress = useCallback(() => {
    if (shop?.address) {
      navigator.clipboard.writeText(shop.address).catch(() => {});
    }
  }, [shop]);

  if (isLoading) {
    return (
      <Container>
        <TopBar>
          <BackButton onClick={onBack}>← {t("back")}</BackButton>
        </TopBar>
        <StateContainer>
          <StateText>{t("back")}</StateText>
        </StateContainer>
      </Container>
    );
  }

  if (hasError || !shop) {
    return (
      <Container>
        <TopBar>
          <BackButton onClick={onBack}>← {t("back")}</BackButton>
        </TopBar>
        <StateContainer>
          <StateText>{t("notFound")}</StateText>
          <Button variant="secondary" size="sm" onClick={onBack}>
            {t("back")}
          </Button>
        </StateContainer>
      </Container>
    );
  }

  const firstImage = shop.image_urls[0] ?? null;

  return (
    <Container>
      <TopBar>
        <BackButton onClick={onBack}>←</BackButton>
        <TopBarTitle>{shop.name}</TopBarTitle>
      </TopBar>

      <ImageSlider>
        {firstImage ? (
          <SliderImage src={firstImage} alt={shop.name} loading="lazy" />
        ) : (
          <ImagePlaceholder>📷</ImagePlaceholder>
        )}
      </ImageSlider>

      <Content>
        <NameRow>
          <ShopName>{shop.name}</ShopName>
          {shop.is_authorized && <AuthBadge>{t("authorized")}</AuthBadge>}
        </NameRow>

        <Divider />

        <AddressRow>
          <AddressText>{shop.address ?? t("noAddress")}</AddressText>
          {shop.address && (
            <CopyButton onClick={handleCopyAddress}>복사</CopyButton>
          )}
        </AddressRow>

        {shop.tags.length > 0 && (
          <>
            <Divider />
            <TagsRow>
              {shop.tags.map((tag) => (
                <Tag key={tag} label={tag} />
              ))}
            </TagsRow>
          </>
        )}

        {shop.description && (
          <>
            <Divider />
            <Description>{shop.description}</Description>
          </>
        )}
      </Content>

      <Footer>
        <Button variant="secondary" fullWidth onClick={() => onReport(shop.id)}>
          {t("reportBtn")}
        </Button>
      </Footer>
    </Container>
  );
};

export default ShopDetail;
