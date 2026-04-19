"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import styled from "styled-components";
import { createClient } from "@/lib/supabase/client";
import ShopCard from "@/components/molecules/common/shop-card";
import LoginPopup from "@/components/organisms/auth/login-popup";
import type { ShopSummary } from "@/types";

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

const Loading = styled.div`
  padding: 48px 16px;
  text-align: center;
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.gray400};
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

// ── Component ─────────────────────────────────────────────────────────────────

interface WishlistListProps {
  onBack?: () => void;
  onShopSelect?: (shopId: string) => void;
}

const WishlistList = ({ onBack, onShopSelect }: WishlistListProps) => {
  const t = useTranslations("wishlist");
  const router = useRouter();
  const [shops, setShops] = useState<ShopSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [isLoginPopupOpen, setIsLoginPopupOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        setIsLoggedIn(false);
        setIsLoginPopupOpen(true);
        setIsLoading(false);
        return;
      }
      setIsLoggedIn(true);
      fetch("/api/wishlist")
        .then((res) => res.json())
        .then((data) => setShops(data.shops ?? []))
        .catch(() => setShops([]))
        .finally(() => setIsLoading(false));
    });
  }, []);

  const handleToggle = useCallback(async (shopId: string) => {
    setShops((prev) => prev.filter((s) => s.id !== shopId));
    await fetch(`/api/wishlist/${shopId}`, { method: "DELETE" });
  }, []);

  if (isLoading) {
    return (
      <Wrapper>
        {onBack && (
          <BackBar>
            <BackButton onClick={onBack}>← {t("backToMap")}</BackButton>
          </BackBar>
        )}
        <Loading>{t("loading")}</Loading>
      </Wrapper>
    );
  }

  if (!isLoggedIn) {
    return (
      <Wrapper>
        {isLoginPopupOpen && (
          <LoginPopup
            onClose={() => (onBack ? onBack() : router.back())}
            returnUrl={
              typeof window !== "undefined" ? window.location.pathname : "/"
            }
            title={t("loginRequired")}
          />
        )}
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      {onBack && (
        <BackBar>
          <BackButton onClick={onBack}>← {t("backToMap")}</BackButton>
        </BackBar>
      )}
      <CountBar>{t("count", { count: shops.length })}</CountBar>
      <List>
        {shops.length === 0 ? (
          <li>
            <EmptyBox>
              <EmptyText>{t("empty")}</EmptyText>
              <ExploreButton onClick={() => router.push("/")}>
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
                onWishlistToggle={handleToggle}
                onSelect={(id) => {
                  if (onShopSelect) {
                    onShopSelect(id);
                  } else {
                    router.push(`/shop/${id}`);
                  }
                }}
              />
            </li>
          ))
        )}
      </List>
    </Wrapper>
  );
};

export default WishlistList;
