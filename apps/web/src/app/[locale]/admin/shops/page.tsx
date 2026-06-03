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

const SearchInput = styled.input`
  width: 100%;
  max-width: 360px;
  padding: 8px 12px;
  font-size: ${({ theme }) => theme.fontSize.sm};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  outline: none;
  color: ${({ theme }) => theme.colors.textDark};
  background-color: ${({ theme }) => theme.colors.white};

  &:focus {
    border-color: ${({ theme }) => theme.colors.primary};
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
  const [searchQuery, setSearchQuery] = useState("");
  const sentinelRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getSession = async () => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session;
  };

  const fetchShops = useCallback(
    async (
      status: TabStatus,
      currentOffset: number,
      append: boolean,
      q: string,
    ) => {
      if (append) {
        setIsLoadingMore(true);
      } else {
        setShops([]);
        setOffset(0);
        setHasMore(false);
        setIsLoading(true);
      }
      setError(null);

      try {
        const session = await getSession();
        if (!session) {
          router.push("/");
          return;
        }

        const params = new URLSearchParams({
          status,
          offset: String(currentOffset),
          limit: String(PAGE_SIZE),
        });
        if (q) params.set("q", q);

        const response = await fetch(`/api/admin/shops?${params.toString()}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

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
    },
    [router],
  );

  useEffect(() => {
    queueMicrotask(() => fetchShops(activeTab, 0, false, searchQuery));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setSearchQuery(q);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      fetchShops(activeTab, 0, false, q);
    }, 300);
  };

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const scrollRoot = document.getElementById("admin-content");

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          fetchShops(activeTab, offset, true, searchQuery);
        }
      },
      { threshold: 0.1, root: scrollRoot },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, offset, activeTab, searchQuery, fetchShops]);

  const handleStatusChange = async (
    shopId: string,
    newStatus: "active" | "hidden",
  ) => {
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

  const handleDisconnectOwner = async (shopId: string) => {
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
        body: JSON.stringify({ disconnect_owner: true }),
      });

      if (response.status === 401 || response.status === 403) {
        router.push("/");
        return;
      }

      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const { shop: updated } = await response.json();
      setShops((prev) =>
        prev.map((s) => (s.id === shopId ? { ...s, owner_id: updated.owner_id } : s)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect owner");
    }
  };

  return (
    <Container>
      <Header>
        <Title>{t("title")}</Title>
      </Header>

      {error && <ErrorMessage>{error}</ErrorMessage>}

      <SearchInput
        type="text"
        value={searchQuery}
        onChange={handleSearchChange}
        placeholder={t("searchPlaceholder")}
      />

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
        onDisconnectOwner={handleDisconnectOwner}
        hideAction={activeTab === "hidden"}
      />

      <Sentinel ref={sentinelRef} />
      {isLoadingMore && <LoadingMore>{t("loading")}</LoadingMore>}
    </Container>
  );
}
