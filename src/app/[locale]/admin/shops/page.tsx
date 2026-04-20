"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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

const LoadingMore = styled.div`
  padding: 16px;
  text-align: center;
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.textGray};
`;

const Sentinel = styled.div`
  height: 1px;
`;

// ── Constants ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

// ── Component ───────────────────────────────────────────────────────────────

type TabStatus = "active" | "hidden";

export default function AdminShopsPage() {
  const t = useTranslations("admin.shops");
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabStatus>("active");
  const [shops, setShops] = useState<AdminShopItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const getSession = async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  };

  const fetchShops = useCallback(async (status: TabStatus, currentOffset: number, append: boolean) => {
    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const session = await getSession();
      if (!session) {
        router.push("/");
        return;
      }

      const response = await fetch(
        `/api/admin/shops?status=${status}&offset=${currentOffset}&limit=${PAGE_SIZE}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } },
      );

      if (response.status === 401 || response.status === 403) {
        router.push("/");
        return;
      }

      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const data = await response.json();
      const newShops: AdminShopItem[] = data.shops || [];
      const total: number = data.total ?? 0;

      if (append) {
        setShops((prev) => [...prev, ...newShops]);
      } else {
        setShops(newShops);
      }

      const nextOffset = currentOffset + newShops.length;
      setOffset(nextOffset);
      setHasMore(nextOffset < total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch shops");
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [router]);

  // Tab 변경 시 초기화 후 재로딩
  useEffect(() => {
    setShops([]);
    setOffset(0);
    setHasMore(false);
    fetchShops(activeTab, 0, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // 센티넬 IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          fetchShops(activeTab, offset, true);
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, offset, activeTab, fetchShops]);

  const handleStatusChange = async (shopId: string, newStatus: "active" | "hidden") => {
    try {
      const session = await getSession();
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

      if (!response.ok) throw new Error(`API error: ${response.status}`);

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
        <Tab $active={activeTab === "active"} onClick={() => setActiveTab("active")}>
          {t("tabAll")}
        </Tab>
        <Tab $active={activeTab === "hidden"} onClick={() => setActiveTab("hidden")}>
          {t("tabHidden")}
        </Tab>
      </TabContainer>

      <ShopTable
        shops={shops}
        isLoading={isLoading}
        onStatusChange={handleStatusChange}
        hideAction={activeTab === "hidden"}
      />

      <Sentinel ref={sentinelRef} />
      {isLoadingMore && <LoadingMore>{t("loading")}</LoadingMore>}
    </Container>
  );
}
