"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import styled from "styled-components";
import { useTranslations } from "next-intl";
import ShopTable from "@/components/organisms/admin/shop-table";
import { createClient } from "@/lib/supabase/client";
import type { AdminShopItem } from "@/types";

// ── Styled Components ───────────────────────────────────────────────────────

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
`;

const Header = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Title = styled.h1`
  font-size: ${({ theme }) => theme.fontSize.xl};
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textDark};
`;

const TabContainer = styled.div`
  display: flex;
  gap: 0;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

interface TabProps {
  $active: boolean;
}

const Tab = styled.button<TabProps>`
  padding: 12px 16px;
  background-color: transparent;
  border: none;
  border-bottom: 2px solid
    ${({ theme, $active }) => ($active ? theme.colors.primary : "transparent")};
  color: ${({ theme, $active }) =>
    $active ? theme.colors.primary : theme.colors.textGray};
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: ${({ $active }) => ($active ? "600" : "500")};
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    color: ${({ theme }) => theme.colors.textDark};
  }
`;

const ErrorMessage = styled.div`
  padding: 12px 16px;
  background-color: ${({ theme }) => theme.colors.dangerBg};
  border: 1px solid ${({ theme }) => theme.colors.dangerText};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  color: ${({ theme }) => theme.colors.dangerText};
  font-size: ${({ theme }) => theme.fontSize.sm};
`;

// ── Component ───────────────────────────────────────────────────────────────

type TabStatus = "active" | "hidden";

export default function AdminShopsPage() {
  const t = useTranslations("admin.shops");
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabStatus>("active");
  const [shops, setShops] = useState<AdminShopItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch shops
  const fetchShops = async (status: TabStatus) => {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/");
        return;
      }

      const response = await fetch(
        `/api/admin/shops?status=${status}&offset=0&limit=50`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        },
      );

      if (response.status === 401 || response.status === 403) {
        router.push("/");
        return;
      }

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      setShops(data.shops || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch shops");
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchShops(activeTab);
  }, [activeTab]);

  // Handle status change
  const handleStatusChange = async (
    shopId: string,
    newStatus: "active" | "hidden",
  ) => {
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/");
        return;
      }

      const response = await fetch(`/api/admin/shops/${shopId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.status === 401 || response.status === 403) {
        router.push("/");
        return;
      }

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      // Optimistic update: remove from current tab
      setShops((prev) => prev.filter((shop) => shop.id !== shopId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update shop");
    }
  };

  return (
    <Container>
      <Header>
        <Title>{t("title")}</Title>
      </Header>

      {error && <ErrorMessage>{error}</ErrorMessage>}

      <TabContainer>
        <Tab
          $active={activeTab === "active"}
          onClick={() => setActiveTab("active")}
        >
          {t("tabAll")}
        </Tab>
        <Tab
          $active={activeTab === "hidden"}
          onClick={() => setActiveTab("hidden")}
        >
          {t("tabHidden")}
        </Tab>
      </TabContainer>

      <ShopTable
        shops={shops}
        isLoading={isLoading}
        onStatusChange={handleStatusChange}
        hideAction={activeTab === "hidden"}
      />
    </Container>
  );
}
