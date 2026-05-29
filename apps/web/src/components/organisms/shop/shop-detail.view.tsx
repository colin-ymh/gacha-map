"use client";

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
import GachaSection from "@/components/organisms/gacha/gacha-section";
import TabBar, { type TabKey } from "@/components/molecules/tab-bar";
import {
  parseBusinessHours,
  formatBusinessHoursDisplay,
} from "@gacha-map/shared";

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

const NameSection = styled.div`
  padding: 16px 16px 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex-shrink: 0;
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

const TabContent = styled.div<{ $visible: boolean }>`
  visibility: ${({ $visible }) => ($visible ? "visible" : "hidden")};
  height: ${({ $visible }) => ($visible ? "auto" : "0")};
  overflow: ${({ $visible }) => ($visible ? "visible" : "hidden")};
  flex-shrink: 0;
`;

const InfoContent = styled.div`
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
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

const InfoRow = styled.div`
  display: flex;
  gap: 8px;
  align-items: flex-start;
`;

const InfoLabel = styled.span`
  font-size: ${({ theme }) => theme.fontSize.xs};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.gray500};
  white-space: nowrap;
  flex-shrink: 0;
  min-width: 56px;
`;

const InfoValue = styled.span`
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.gray700};
  flex: 1;
  white-space: pre-line;
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

const ClaimButtonWrapper = styled.div`
  padding: 0 16px 12px;
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
  isFetchComplete: boolean;
  hasError: boolean;
  isWishlisted: boolean;
  isLoggedIn: boolean | null;
  activeTab: TabKey;
  visitedTabs: Set<TabKey>;
  onTabChange: (tab: TabKey) => void;
  onBack: () => void;
  onReport: (shopId: string) => void;
  onClaim: (shopId: string) => void;
  onCopyAddress: () => void;
  onWishlistToggle: () => void;
}

const ShopDetailView = ({
  shop,
  isLoading,
  isFetchComplete,
  hasError,
  isWishlisted,
  isLoggedIn,
  activeTab,
  visitedTabs,
  onTabChange,
  onBack,
  onReport,
  onClaim,
  onCopyAddress,
  onWishlistToggle,
}: ShopDetailViewProps) => {
  const t = useTranslations("shopDetail");

  const tabs = [
    { key: "products" as TabKey, label: t("tabProducts") },
    { key: "reviews" as TabKey, label: t("tabReviews") },
  ];

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

  const businessHours = parseBusinessHours(
    (shop as unknown as { opening_hours?: string | null }).opening_hours,
  );
  const hoursText = businessHours
    ? formatBusinessHoursDisplay(businessHours)
    : null;
  const phone = (shop as unknown as { phone?: string | null }).phone ?? null;

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

      <NameSection>
        <NameRow>
          <ShopName>{shop.name}</ShopName>
          {shop.is_authorized && <AuthBadge>{t("authorized")}</AuthBadge>}
          {typeof shop.wishlist_count === "number" && (
            <WishlistCount>
              {t("wishlistCount", { count: shop.wishlist_count })}
            </WishlistCount>
          )}
        </NameRow>
      </NameSection>

      <InfoContent>
        <AddressRow>
          <AddressText>{shop.address ?? t("noAddress")}</AddressText>
          {shop.address && (
            <CopyButton onClick={onCopyAddress}>복사</CopyButton>
          )}
        </AddressRow>

        {phone && (
          <>
            <Divider />
            <InfoRow>
              <InfoLabel>{t("phone")}</InfoLabel>
              <InfoValue>{phone}</InfoValue>
            </InfoRow>
          </>
        )}

        {hoursText && (
          <>
            <Divider />
            <InfoRow>
              <InfoLabel>{t("openingHours")}</InfoLabel>
              <InfoValue>{hoursText}</InfoValue>
            </InfoRow>
          </>
        )}

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

        {isLoggedIn &&
          shop.status === "active" &&
          isFetchComplete &&
          !shop.owner_id && (
            <ClaimButtonWrapper style={{ padding: 0 }}>
              <Button
                variant="secondary"
                size="sm"
                fullWidth
                onClick={() => onClaim(shop.id)}
              >
                {t("claimBtn")}
              </Button>
            </ClaimButtonWrapper>
          )}
      </InfoContent>

      <TabBar tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} />

      {/* 상품 탭 */}
      <TabContent $visible={activeTab === "products"}>
        {visitedTabs.has("products") && <GachaSection shopId={shop.id} />}
      </TabContent>

      {/* 리뷰 탭 */}
      <TabContent $visible={activeTab === "reviews"}>
        {visitedTabs.has("reviews") && <ReviewSection shopId={shop.id} />}
      </TabContent>
    </Container>
  );
};

export default ShopDetailView;
