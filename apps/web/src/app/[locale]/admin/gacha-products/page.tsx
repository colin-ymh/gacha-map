"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import styled from "styled-components";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import type { AdminGachaProductItem, GachaProductNameCandidate } from "@/types";
import GachaProductTableView from "@/components/organisms/admin/gacha-product-table.view";

// ── Styled ─────────────────────────────────────────────────────────────────────

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

const Controls = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
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
  padding: 8px 12px;
  font-size: ${({ theme }) => theme.fontSize.sm};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  outline: none;
  width: 240px;

  &:focus {
    border-color: ${({ theme }) => theme.colors.primary};
  }

  @media (max-width: 768px) {
    width: 100%;
  }
`;

const CountText = styled.p`
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.textGray};
  margin: 0;
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

// ── Constants ──────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

type ActiveTab = "all" | "unnamed";

// ── Component ──────────────────────────────────────────────────────────────────

export default function GachaProductsPage() {
  const t = useTranslations("admin.gachaProducts");
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<ActiveTab>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [products, setProducts] = useState<AdminGachaProductItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);

  const [expandedProductId, setExpandedProductId] = useState<string | null>(
    null,
  );
  const [candidatesMap, setCandidatesMap] = useState<
    Record<string, GachaProductNameCandidate[]>
  >({});
  const [loadingCandidatesId, setLoadingCandidatesId] = useState<string | null>(
    null,
  );
  const [processingCandidateId, setProcessingCandidateId] = useState<
    string | null
  >(null);
  const [addingCandidateId, setAddingCandidateId] = useState<string | null>(
    null,
  );

  const sentinelRef = useRef<HTMLDivElement>(null);

  const getSession = async () => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session;
  };

  const fetchProducts = useCallback(
    async (
      tab: ActiveTab,
      q: string,
      currentOffset: number,
      append: boolean,
    ) => {
      if (append) {
        setIsLoadingMore(true);
      } else {
        setProducts([]);
        setOffset(0);
        setHasMore(false);
        setIsLoading(true);
      }

      try {
        const session = await getSession();
        if (!session) {
          router.push("/");
          return;
        }

        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String(currentOffset),
        });
        if (tab === "unnamed") params.set("name_missing", "true");
        if (q) params.set("q", q);

        const res = await fetch(`/api/admin/gacha-products?${params}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (res.status === 401 || res.status === 403) {
          router.push("/");
          return;
        }

        const data = await res.json();
        const newProducts: AdminGachaProductItem[] = data.products ?? [];
        const newTotal: number = data.total ?? 0;

        if (append) {
          setProducts((prev) => [...prev, ...newProducts]);
        } else {
          setProducts(newProducts);
        }

        const nextOffset = currentOffset + newProducts.length;
        setOffset(nextOffset);
        setTotal(newTotal);
        setHasMore(nextOffset < newTotal);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [router],
  );

  useEffect(() => {
    queueMicrotask(() => {
      setExpandedProductId(null);
      fetchProducts(activeTab, search, 0, false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, search]);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const scrollRoot = document.getElementById("admin-content");
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          fetchProducts(activeTab, search, offset, true);
        }
      },
      { threshold: 0.1, root: scrollRoot },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, offset, activeTab, search, fetchProducts]);

  const handleToggleCandidates = useCallback(
    async (productId: string) => {
      if (expandedProductId === productId) {
        setExpandedProductId(null);
        return;
      }
      setExpandedProductId(productId);

      if (candidatesMap[productId] !== undefined) return;

      setLoadingCandidatesId(productId);
      try {
        const session = await getSession();
        if (!session) return;

        const res = await fetch(
          `/api/admin/gacha-products/${productId}/name-candidates`,
          { headers: { Authorization: `Bearer ${session.access_token}` } },
        );
        const data = await res.json();
        setCandidatesMap((prev) => ({
          ...prev,
          [productId]: data.candidates ?? [],
        }));
      } finally {
        setLoadingCandidatesId(null);
      }
    },
    [expandedProductId, candidatesMap],
  );

  const handleApproveCandidate = useCallback(
    async (productId: string, candidateId: string) => {
      setProcessingCandidateId(candidateId);
      try {
        const session = await getSession();
        if (!session) return;

        const res = await fetch(
          `/api/admin/gacha-products/${productId}/name-candidates/${candidateId}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ status: "approved", is_primary: true }),
          },
        );
        if (!res.ok) return;

        const data = await res.json();
        const approvedCandidate: GachaProductNameCandidate | undefined =
          data.candidate;

        setCandidatesMap((prev) => ({
          ...prev,
          [productId]: (prev[productId] ?? []).map((c) =>
            c.id === candidateId
              ? { ...c, status: "approved" as const, is_primary: true }
              : { ...c, is_primary: false },
          ),
        }));

        if (approvedCandidate) {
          setProducts((prev) =>
            prev.map((p) =>
              p.id === productId
                ? { ...p, name_ko: approvedCandidate.name }
                : p,
            ),
          );
        }
      } finally {
        setProcessingCandidateId(null);
      }
    },
    [],
  );

  const handleRejectCandidate = useCallback(
    async (productId: string, candidateId: string) => {
      setProcessingCandidateId(candidateId);
      try {
        const session = await getSession();
        if (!session) return;

        const res = await fetch(
          `/api/admin/gacha-products/${productId}/name-candidates/${candidateId}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ status: "rejected" }),
          },
        );
        if (!res.ok) return;

        setCandidatesMap((prev) => ({
          ...prev,
          [productId]: (prev[productId] ?? []).map((c) =>
            c.id === candidateId
              ? { ...c, status: "rejected" as const, is_primary: false }
              : c,
          ),
        }));

        setProducts((prev) =>
          prev.map((p) => {
            if (p.id !== productId || p.pending_candidate?.id !== candidateId)
              return p;
            return {
              ...p,
              pending_candidate: {
                ...p.pending_candidate!,
                status: "rejected" as const,
              },
            };
          }),
        );
      } finally {
        setProcessingCandidateId(null);
      }
    },
    [],
  );

  const handleAddCandidate = useCallback(
    async (productId: string, name: string) => {
      setAddingCandidateId(productId);
      try {
        const session = await getSession();
        if (!session) return;

        const res = await fetch(
          `/api/admin/gacha-products/${productId}/name-candidates`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              name,
              locale: "ko",
              source_type: "admin",
              source_name: "admin",
            }),
          },
        );
        if (!res.ok) return;

        const data = await res.json();
        if (data.candidate) {
          setCandidatesMap((prev) => ({
            ...prev,
            [productId]: [...(prev[productId] ?? []), data.candidate],
          }));
        }
      } finally {
        setAddingCandidateId(null);
      }
    },
    [],
  );

  const handleEditCandidate = useCallback(
    async (
      productId: string,
      candidateId: string,
      name: string,
    ): Promise<string | null> => {
      const session = await getSession();
      if (!session) return null;

      const res = await fetch(
        `/api/admin/gacha-products/${productId}/name-candidates/${candidateId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ name }),
        },
      );

      if (res.status === 409) return "duplicate";
      if (!res.ok) return "error";

      const data = await res.json();
      const updated: GachaProductNameCandidate | undefined = data.candidate;
      if (!updated) return "error";

      setCandidatesMap((prev) => ({
        ...prev,
        [productId]: (prev[productId] ?? []).map((c) =>
          c.id === candidateId ? updated : c,
        ),
      }));

      setProducts((prev) =>
        prev.map((p) => {
          if (p.id !== productId) return p;
          const updates: Partial<typeof p> = {};
          if (updated.is_primary) updates.name_ko = updated.name;
          if (p.pending_candidate?.id === candidateId) {
            updates.pending_candidate = {
              ...p.pending_candidate!,
              name: updated.name,
            };
          }
          return Object.keys(updates).length > 0 ? { ...p, ...updates } : p;
        }),
      );

      return null;
    },
    [],
  );

  const handleUpdateNameKo = useCallback(
    async (productId: string, nameKo: string): Promise<boolean> => {
      const session = await getSession();
      if (!session) return false;

      const res = await fetch(`/api/admin/gacha-products/${productId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ name_ko: nameKo }),
      });
      if (!res.ok) return false;

      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, name_ko: nameKo } : p)),
      );
      return true;
    },
    [],
  );

  const handleClearNameKo = useCallback(
    async (productId: string): Promise<boolean> => {
      const session = await getSession();
      if (!session) return false;

      const res = await fetch(`/api/admin/gacha-products/${productId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ name_ko: null }),
      });
      if (!res.ok) return false;

      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, name_ko: null } : p)),
      );
      setCandidatesMap((prev) => {
        if (!prev[productId]) return prev;
        return {
          ...prev,
          [productId]: prev[productId].map((c) => ({
            ...c,
            is_primary: false,
          })),
        };
      });
      return true;
    },
    [],
  );

  return (
    <Container>
      <Header>
        <Title>{t("title")}</Title>
        <Controls>
          <SearchInput
            placeholder={t("searchPlaceholder")}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </Controls>
      </Header>

      <TabContainer>
        <Tab $active={activeTab === "all"} onClick={() => setActiveTab("all")}>
          {t("tabAll")}
        </Tab>
        <Tab
          $active={activeTab === "unnamed"}
          onClick={() => setActiveTab("unnamed")}
        >
          {t("tabUnnamed")}
        </Tab>
      </TabContainer>

      {!isLoading && <CountText>{t("totalCount", { count: total })}</CountText>}

      <GachaProductTableView
        products={products}
        isLoading={isLoading}
        activeTab={activeTab}
        expandedProductId={expandedProductId}
        candidatesMap={candidatesMap}
        loadingCandidatesId={loadingCandidatesId}
        processingCandidateId={processingCandidateId}
        addingCandidateId={addingCandidateId}
        onToggleCandidates={handleToggleCandidates}
        onApproveCandidate={handleApproveCandidate}
        onRejectCandidate={handleRejectCandidate}
        onAddCandidate={handleAddCandidate}
        onEditCandidate={handleEditCandidate}
        onUpdateNameKo={handleUpdateNameKo}
        onClearNameKo={handleClearNameKo}
      />

      <Sentinel ref={sentinelRef} />
      {isLoadingMore && <LoadingMore>{t("loadingMore")}</LoadingMore>}
    </Container>
  );
}
