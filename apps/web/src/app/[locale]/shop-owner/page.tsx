"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import styled from "styled-components";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ShopOwnerShop } from "@/types";
import {
  parseBusinessHours,
  formatBusinessHoursDisplay,
} from "@gacha-map/shared";

// ── Styled Components ────────────────────────────────────────────────────────

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
`;

const Title = styled.h1`
  font-size: ${({ theme }) => theme.fontSize.xl};
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textDark};
  padding-bottom: 16px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const Cards = styled.div`
  display: flex;
  gap: 16px;
  align-items: flex-start;
  flex-wrap: wrap;
`;

const Card = styled.div`
  background-color: ${({ theme }) => theme.colors.white};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: 24px;
`;

const InfoCard = styled(Card)`
  flex: 1;
  min-width: 320px;
`;

const CardLabel = styled.h2`
  font-size: ${({ theme }) => theme.fontSize.base};
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textDark};
  margin-bottom: 16px;
`;

const InfoRow = styled.div`
  display: flex;
  gap: 16px;
  padding: 10px 0;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};

  &:last-child {
    border-bottom: none;
  }
`;

const InfoKey = styled.span`
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.textGray};
  width: 80px;
  flex-shrink: 0;
`;

const InfoValue = styled.span`
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.textDark};
`;

interface BadgeProps {
  $variant: "success" | "info" | "warning";
}

const Badge = styled.span<BadgeProps>`
  display: inline-block;
  padding: 4px 12px;
  border-radius: ${({ theme }) => theme.borderRadius.full};
  font-size: ${({ theme }) => theme.fontSize.xs};
  font-weight: 600;
  background-color: ${({ theme, $variant }) => {
    if ($variant === "success") return theme.colors.successBg;
    if ($variant === "info") return theme.colors.primaryBg;
    return theme.colors.warningBg;
  }};
  color: ${({ theme, $variant }) => {
    if ($variant === "success") return theme.colors.successText;
    if ($variant === "info") return theme.colors.primary;
    return theme.colors.warningText;
  }};
`;

const Actions = styled.div`
  display: flex;
  gap: 12px;
`;

const PrimaryBtn = styled(Link)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 24px;
  background-color: ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.white};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: 600;
  text-decoration: none;
  transition: opacity 0.15s;

  &:hover {
    opacity: 0.85;
  }
`;

const SecondaryBtn = styled(Link)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 24px;
  background-color: ${({ theme }) => theme.colors.white};
  color: ${({ theme }) => theme.colors.textDark};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-size: ${({ theme }) => theme.fontSize.sm};
  text-decoration: none;
  transition: background-color 0.15s;

  &:hover {
    background-color: ${({ theme }) => theme.colors.gray50};
  }
`;

const LoadingText = styled.p`
  color: ${({ theme }) => theme.colors.textGray};
  font-size: ${({ theme }) => theme.fontSize.sm};
`;

const ErrorText = styled.p`
  color: ${({ theme }) => theme.colors.dangerText};
  font-size: ${({ theme }) => theme.fontSize.sm};
`;

// ── Component ────────────────────────────────────────────────────────────────

export default function ShopOwnerOverviewPage() {
  const t = useTranslations("shopOwner");
  const router = useRouter();
  const [shop, setShop] = useState<ShopOwnerShop | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchShop = async () => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/");
        return;
      }

      try {
        const res = await fetch("/api/shop-owner/shop", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (!res.ok) {
          throw new Error(`API error: ${res.status}`);
        }

        const data = await res.json();
        setShop(data.shop);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setIsLoading(false);
      }
    };

    fetchShop();
  }, [router]);

  const tO = (key: string) => t(`overview.${key}` as Parameters<typeof t>[0]);

  if (isLoading) return <LoadingText>{tO("loading")}</LoadingText>;
  if (error) return <ErrorText>{error}</ErrorText>;
  if (!shop) return <LoadingText>{tO("noShop")}</LoadingText>;

  return (
    <Container>
      <Title>{tO("title")}</Title>

      <Cards>
        <InfoCard>
          <CardLabel>{tO("shopInfo")}</CardLabel>
          <InfoRow>
            <InfoKey>{tO("name")}</InfoKey>
            <InfoValue>{shop.name}</InfoValue>
          </InfoRow>
          <InfoRow>
            <InfoKey>{tO("address")}</InfoKey>
            <InfoValue>{shop.address ?? tO("noAddress")}</InfoValue>
          </InfoRow>
          <InfoRow>
            <InfoKey>{tO("phone")}</InfoKey>
            <InfoValue>{shop.phone ?? tO("noPhone")}</InfoValue>
          </InfoRow>
          <InfoRow>
            <InfoKey>{tO("openingHours")}</InfoKey>
            <InfoValue>
              {formatBusinessHoursDisplay(
                parseBusinessHours(shop.opening_hours),
              ) || tO("noHours")}
            </InfoValue>
          </InfoRow>
          <InfoRow>
            <InfoKey>{tO("shopStatus")}</InfoKey>
            <Badge $variant={shop.status === "active" ? "success" : "warning"}>
              {shop.status === "active"
                ? tO("statusActive")
                : tO("statusHidden")}
            </Badge>
          </InfoRow>
        </InfoCard>
      </Cards>

      <Actions>
        <PrimaryBtn href="/shop-owner/profile">{tO("editBtn")}</PrimaryBtn>
        <SecondaryBtn href="/shop-owner/reviews">
          {tO("reviewsBtn")}
        </SecondaryBtn>
        <SecondaryBtn href={`/shop/${shop.id}`}>
          {tO("viewShopBtn")}
        </SecondaryBtn>
        <SecondaryBtn href="/shop-owner/gacha">{tO("gachaBtn")}</SecondaryBtn>
      </Actions>
    </Container>
  );
}
