"use client";

import styled from "styled-components";
import { useTranslations } from "next-intl";
import ShopCard from "@/components/molecules/common/shop-card";
import LoginPopup from "@/components/organisms/auth/login-popup";
import type { ShopSummary } from "@/types";

// ── Styled ────────────────────────────────────────────────────────────────────

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
`;

const BackBar = styled.div`
  padding: 8px 16px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.gray100};
`;

const BackButton = styled.button`
  background: none;
  border: none;
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.primary};
  cursor: pointer;
  padding: 0;
  transition: opacity 0.15s;

  &:hover {
    opacity: 0.75;
  }
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

// ── View ──────────────────────────────────────────────────────────────────────

interface WishlistListViewProps {
  shops: ShopSummary[];
  isLoading: boolean;
  isLoggedIn: boolean | null;
  isLoginPopupOpen: boolean;
  onBack: () => void;
  backLabel: string;
  onShopSelect: (id: string) => void;
  onWishlistToggle: (shopId: string) => void;
  onExplore: () => void;
  onLoginPopupClose: () => void;
  loginReturnUrl: string;
}

const WishlistListView = ({
  shops,
  isLoading,
  isLoggedIn,
  isLoginPopupOpen,
  onBack,
  backLabel,
  onShopSelect,
  onWishlistToggle,
  onExplore,
  onLoginPopupClose,
  loginReturnUrl,
}: WishlistListViewProps) => {
  const t = useTranslations("wishlist");

  if (isLoading) {
    return (
      <Wrapper>
        <BackBar>
          <BackButton onClick={onBack}>
            {backLabel}
          </BackButton>
        </BackBar>
        <Loading>{t("loading")}</Loading>
      </Wrapper>
    );
  }

  if (!isLoggedIn) {
    return (
      <Wrapper>
        {isLoginPopupOpen && (
          <LoginPopup
            onClose={onLoginPopupClose}
            returnUrl={loginReturnUrl}
            title={t("loginRequired")}
          />
        )}
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      <BackBar>
        <BackButton onClick={onBack}>
          {backLabel}
        </BackButton>
      </BackBar>
      <CountBar>{t("count", { count: shops.length })}</CountBar>
      <List>
        {shops.length === 0 ? (
          <li>
            <EmptyBox>
              <EmptyText>{t("empty")}</EmptyText>
              <ExploreButton onClick={onExplore}>
                {t("emptyAction")}
              </ExploreButton>
            </EmptyBox>
          </li>
        ) : (
          shops.map((shop) => (
            <li key={shop.id}>
              <ShopCard
                shop={shop}
                wishlisted
                onWishlistToggle={onWishlistToggle}
                onSelect={onShopSelect}
              />
            </li>
          ))
        )}
      </List>
    </Wrapper>
  );
};

export default WishlistListView;
