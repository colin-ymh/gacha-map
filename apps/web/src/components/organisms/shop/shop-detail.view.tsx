"use client";

import Image from "next/image";
import styled from "styled-components";
import { useTranslations } from "next-intl";
import Button from "@/components/atoms/common/button";
import Tag from "@/components/atoms/common/tag";
import {
  ArrowLeftIcon,
  HeartFilledIcon,
  HeartOutlineIcon,
} from "@/components/atoms/icons";
import type { Shop } from "@/types";
import ReviewSection from "@/components/organisms/review/review-section";

// ── Styled ────────────────────────────────────────────────────────────────────

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

const Spacer = styled.div`
  flex: 1;
`;

const WishlistButton = styled.button<{ $isWishlisted: boolean }>`
  background: none;
  border: none;
  cursor: pointer;
  color: ${({ $isWishlisted, theme }) =>
    $isWishlisted ? theme.colors.primary : theme.colors.gray400};
  padding: 4px;
  display: flex;
  align-items: center;

  &:hover {
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const ReportButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.gray500};
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: 500;
  padding: 4px 8px;
  display: flex;
  align-items: center;

  &:hover {
    color: ${({ theme }) => theme.colors.gray900};
  }
`;

const ImageSlider = styled.div`
  width: 100%;
  height: 180px;
  overflow: hidden;
  background: ${({ theme }) => theme.colors.gray100};
  flex-shrink: 0;
  position: relative;
`;

const ImagePlaceholder = styled.div`
  width: 100%;
  height: 100%;
  position: relative;
`;

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
  flex-wrap: nowrap;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  &::-webkit-scrollbar {
    display: none;
  }
`;

const ShopName = styled.h1`
  font-size: ${({ theme }) => theme.fontSize.xl};
  font-weight: 700;
  color: ${({ theme }) => theme.colors.gray900};
  margin: 0;
  white-space: nowrap;
  flex-shrink: 0;
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

const WishlistCount = styled.span`
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ theme }) => theme.colors.primary};
  margin-left: auto;
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
  min-width: 0;
  white-space: nowrap;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  &::-webkit-scrollbar {
    display: none;
  }
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

// ── View ──────────────────────────────────────────────────────────────────────

interface ShopDetailViewProps {
  shop: Shop | null;
  isLoading: boolean;
  hasError: boolean;
  isWishlisted: boolean;
  onBack: () => void;
  onReport: (shopId: string) => void;
  onCopyAddress: () => void;
  onWishlistToggle: () => void;
}

const ShopDetailView = ({
  shop,
  isLoading,
  hasError,
  isWishlisted,
  onBack,
  onReport,
  onCopyAddress,
  onWishlistToggle,
}: ShopDetailViewProps) => {
  const t = useTranslations("shopDetail");

  if (isLoading) {
    return (
      <Container>
        <TopBar>
          <BackButton onClick={onBack}>
            <ArrowLeftIcon size={18} /> {t("back")}
          </BackButton>
        </TopBar>
        <StateContainer>
          <StateText>{t("loading")}</StateText>
        </StateContainer>
      </Container>
    );
  }

  if (hasError || !shop) {
    return (
      <Container>
        <TopBar>
          <BackButton onClick={onBack}>
            <ArrowLeftIcon size={18} /> {t("back")}
          </BackButton>
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
        <BackButton onClick={onBack}>
          <ArrowLeftIcon size={18} />
        </BackButton>
        <Spacer />
        <WishlistButton
          $isWishlisted={isWishlisted}
          onClick={onWishlistToggle}
          aria-label={isWishlisted ? "찜 해제" : "찜하기"}
        >
          {isWishlisted ? (
            <HeartFilledIcon size={20} />
          ) : (
            <HeartOutlineIcon size={20} />
          )}
        </WishlistButton>
        <ReportButton onClick={() => onReport(shop.id)}>
          {t("reportBtn")}
        </ReportButton>
      </TopBar>

      <ImageSlider>
        {firstImage ? (
          <Image
            src={firstImage}
            alt={shop.name}
            fill
            style={{ objectFit: "cover" }}
            sizes="(max-width: 768px) 100vw, 360px"
            priority
          />
        ) : (
          <ImagePlaceholder>
            <Image
              src="/images/shop-placeholder.svg"
              alt=""
              fill
              style={{ objectFit: "contain" }}
            />
          </ImagePlaceholder>
        )}
      </ImageSlider>

      <Content>
        <NameRow>
          <ShopName>{shop.name}</ShopName>
          {shop.is_authorized && <AuthBadge>{t("authorized")}</AuthBadge>}
          {typeof shop.wishlist_count === "number" && (
            <WishlistCount>
              {t("wishlistCount", { count: shop.wishlist_count })}
            </WishlistCount>
          )}
        </NameRow>

        <Divider />

        <AddressRow>
          <AddressText>{shop.address ?? t("noAddress")}</AddressText>
          {shop.address && (
            <CopyButton onClick={onCopyAddress}>복사</CopyButton>
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

      <ReviewSection shopId={shop.id} />
    </Container>
  );
};

export default ShopDetailView;
