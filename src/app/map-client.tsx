"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import styled from "styled-components";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { usePathname, useSearchParams } from "next/navigation";
import Header from "@/components/organisms/common/header";
import ShopList from "@/components/organisms/common/shop-list";
import ShopDetail from "@/components/organisms/shop/shop-detail";
import ReportForm from "@/components/organisms/report/report-form";
import WishlistList from "@/components/organisms/wishlist/wishlist-list";
import { createClient } from "@/lib/supabase/client";
import type { ShopSummary, Bounds } from "@/types";
import type { SortOption } from "@/components/molecules/common/sort-bar";

const NaverMap = dynamic(() => import("@/components/organisms/map/naver-map"), {
  ssr: false,
});

type PanelMode = "list" | "detail" | "report" | "wishlist";

const PAGE_SIZE = 20;

interface MapClientProps {
  initialPanelMode?: PanelMode;
  initialShopId?: string | null;
}

// ── Styled components ────────────────────────────────────────────────────────

const Page = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
`;

const Body = styled.div`
  display: flex;
  flex: 1;
  overflow: hidden;
`;

const MapArea = styled.div<{ $hidden: boolean }>`
  flex: 1;
  position: relative;

  @media (max-width: 768px) {
    display: ${({ $hidden }) => ($hidden ? "none" : "block")};
  }
`;

const Sidebar = styled.aside`
  width: ${({ theme }) => theme.layout.sidebarWidth};
  background: ${({ theme }) => theme.colors.white};
  border-right: 1px solid ${({ theme }) => theme.colors.border};
  display: flex;
  flex-direction: column;
  overflow: hidden;

  @media (max-width: 768px) {
    display: none;
  }
`;

const MobilePanel = styled.div<{ $visible: boolean }>`
  display: none;

  @media (max-width: 768px) {
    display: ${({ $visible }) => ($visible ? "flex" : "none")};
    position: fixed;
    inset: 0;
    background: ${({ theme }) => theme.colors.white};
    flex-direction: column;
    z-index: 100;
    overflow-y: auto;
  }
`;

const BottomSheet = styled.div<{ $expanded: boolean }>`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: ${({ theme }) => theme.colors.white};
  border-radius: ${({ theme }) => theme.borderRadius.xl}
    ${({ theme }) => theme.borderRadius.xl} 0 0;
  box-shadow: ${({ theme }) => theme.shadow.md};
  height: ${({ $expanded }) => ($expanded ? "70vh" : "160px")};
  transition: height 0.25s ease;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  @media (min-width: 769px) {
    display: none;
  }
`;

const DragHandle = styled.button`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 10px 0 6px;
  background: none;
  border: none;
  cursor: pointer;
  flex-shrink: 0;
  width: 100%;
`;

const HandleBar = styled.div`
  width: 40px;
  height: 4px;
  background: ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.full};
`;

const BottomSheetContent = styled.div`
  flex: 1;
  overflow-y: auto;
`;

const LoadMoreFab = styled.button`
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: ${({ theme }) => theme.colors.white};
  color: ${({ theme }) => theme.colors.textDark};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.full};
  box-shadow: ${({ theme }) => theme.shadow.md};
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    background: ${({ theme }) => theme.colors.gray50};
  }

  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
`;

// ── URL helpers ───────────────────────────────────────────────────────────────

function panelToPath(
  mode: PanelMode,
  shopId: string | null,
  locale: string,
): string {
  const base = `/${locale}`;
  if (mode === "detail" && shopId) return `${base}/shop/${shopId}`;
  if (mode === "report")
    return shopId ? `${base}/report?shopId=${shopId}` : `${base}/report`;
  if (mode === "wishlist") return base;
  return base;
}

// ── Component ─────────────────────────────────────────────────────────────────

const MapClient = ({
  initialPanelMode = "list",
  initialShopId = null,
}: MapClientProps) => {
  const t = useTranslations("shopList");
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const locale = pathname.split("/")[1] || "ko";

  const [shops, setShops] = useState<ShopSummary[]>([]);
  const [panelMode, setPanelMode] = useState<PanelMode>(initialPanelMode);
  const [selectedShopId, setSelectedShopId] = useState<string | null>(
    initialShopId,
  );
  const [expanded, setExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [wishlistedIds, setWishlistedIds] = useState<Set<string>>(new Set());

  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [sort, setSort] = useState<SortOption>("name");
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boundsRef = useRef<Bounds | null>(null);
  const lastViewportRef = useRef<Bounds | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      fetch("/api/wishlist")
        .then((res) => res.json())
        .then((data) => {
          const ids = (data.shops ?? []).map((s: ShopSummary) => s.id);
          setWishlistedIds(new Set(ids));
        })
        .catch(() => {});
    });
  }, []);

  const handleWishlistToggle = useCallback(
    async (shopId: string) => {
      const isWishlisted = wishlistedIds.has(shopId);
      setWishlistedIds((prev) => {
        const next = new Set(prev);
        if (isWishlisted) next.delete(shopId);
        else next.add(shopId);
        return next;
      });
      if (isWishlisted) {
        await fetch(`/api/wishlist/${shopId}`, { method: "DELETE" });
      } else {
        await fetch("/api/wishlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shopId }),
        });
      }
    },
    [wishlistedIds],
  );

  // Sync panel mode from URL on mount for direct link access
  useEffect(() => {
    if (initialPanelMode !== "list") return;
    const segments = pathname.split("/").filter(Boolean);
    if (segments[1] === "shop" && segments[2]) {
      setPanelMode("detail");
      setSelectedShopId(segments[2]);
    } else if (segments[1] === "report") {
      setPanelMode("report");
      const sid = searchParams.get("shopId");
      if (sid) setSelectedShopId(sid);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const navigatePanel = useCallback(
    (mode: PanelMode, shopId: string | null = selectedShopId) => {
      setPanelMode(mode);
      setSelectedShopId(shopId);
      window.history.pushState(null, "", panelToPath(mode, shopId, locale));
    },
    [locale, selectedShopId],
  );

  const handleBoundsChange = useCallback(
    (bounds: Bounds) => {
      if (lastViewportRef.current) {
        const prev = lastViewportRef.current;
        const prevLatSpan = prev.neLat - prev.swLat;
        const prevLngSpan = prev.neLng - prev.swLng;
        const newLatSpan = bounds.neLat - bounds.swLat;

        // 줌이 15% 이상 변했으면 리로드
        const zoomChanged =
          Math.abs(newLatSpan - prevLatSpan) / prevLatSpan > 0.15;

        if (!zoomChanged) {
          // 중심 이동이 뷰포트 크기의 15% 미만이면 스킵
          const prevCenterLat = (prev.swLat + prev.neLat) / 2;
          const prevCenterLng = (prev.swLng + prev.neLng) / 2;
          const newCenterLat = (bounds.swLat + bounds.neLat) / 2;
          const newCenterLng = (bounds.swLng + bounds.neLng) / 2;
          const panLat = Math.abs(newCenterLat - prevCenterLat) / prevLatSpan;
          const panLng = Math.abs(newCenterLng - prevCenterLng) / prevLngSpan;
          if (panLat < 0.15 && panLng < 0.15) return;
        }
      }

      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

      debounceTimerRef.current = setTimeout(() => {
        if (abortControllerRef.current) abortControllerRef.current.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;

        lastViewportRef.current = bounds;

        // API 호출은 뷰포트 30% 확장 영역으로 — 무한스크롤 데이터 충분히 확보
        const latPad = (bounds.neLat - bounds.swLat) * 0.3;
        const lngPad = (bounds.neLng - bounds.swLng) * 0.3;
        const fetchBounds: Bounds = {
          swLat: bounds.swLat - latPad,
          swLng: bounds.swLng - lngPad,
          neLat: bounds.neLat + latPad,
          neLng: bounds.neLng + lngPad,
        };
        boundsRef.current = fetchBounds;
        setOffset(0);
        setHasMore(false);

        const { swLat, swLng, neLat, neLng } = fetchBounds;
        const params = new URLSearchParams({
          swLat: String(swLat),
          swLng: String(swLng),
          neLat: String(neLat),
          neLng: String(neLng),
          offset: "0",
          sort,
          ...(sort === "distance" &&
            userLocation && {
              lat: String(userLocation.lat),
              lng: String(userLocation.lng),
            }),
        });

        setIsLoading(true);
        fetch(`/api/shops?${params}`, { signal: controller.signal })
          .then((res) => res.json())
          .then((data) => {
            const shops = data.shops ?? [];
            setShops(shops);
            setHasMore(shops.length >= PAGE_SIZE);
          })
          .catch((err) => {
            if (err.name !== "AbortError") setShops([]);
          })
          .finally(() => setIsLoading(false));
      }, 300);
    },
    [sort, userLocation],
  );

  const handleLoadMore = useCallback(() => {
    if (!boundsRef.current || isLoadingMore) return;
    const nextOffset = offset + 20;
    const { swLat, swLng, neLat, neLng } = boundsRef.current;
    const params = new URLSearchParams({
      swLat: String(swLat),
      swLng: String(swLng),
      neLat: String(neLat),
      neLng: String(neLng),
      offset: String(nextOffset),
      sort,
      ...(sort === "distance" &&
        userLocation && {
          lat: String(userLocation.lat),
          lng: String(userLocation.lng),
        }),
    });
    setIsLoadingMore(true);
    fetch(`/api/shops?${params}`)
      .then((res) => res.json())
      .then((data) => {
        const more = data.shops ?? [];
        setShops((prev) => [...prev, ...more]);
        setOffset(nextOffset);
        setHasMore(more.length >= PAGE_SIZE);
      })
      .catch(() => {})
      .finally(() => setIsLoadingMore(false));
  }, [isLoadingMore, offset, sort, userLocation]);

  const handleShopClick = useCallback(
    (shop: ShopSummary) => navigatePanel("detail", shop.id),
    [navigatePanel],
  );

  const handleShopSelect = useCallback(
    (shopId: string) => navigatePanel("detail", shopId),
    [navigatePanel],
  );

  const handleBackToList = useCallback(
    () => navigatePanel("list", null),
    [navigatePanel],
  );

  const handleOpenReport = useCallback(
    (shopId: string) => navigatePanel("report", shopId),
    [navigatePanel],
  );

  const handleReportBack = useCallback(() => {
    if (selectedShopId) {
      navigatePanel("detail", selectedShopId);
    } else {
      navigatePanel("list", null);
    }
  }, [navigatePanel, selectedShopId]);

  const handleSortChange = useCallback(
    (newSort: SortOption) => {
      setSort(newSort);

      // Request geolocation if distance sort is selected
      if (newSort === "distance" && !userLocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setUserLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            });
          },
          () => {
            // Geolocation denied, but still allow distance sort with null location
            // The API will handle it appropriately
          },
        );
      }

      // Reset to first page when sort changes
      if (boundsRef.current) {
        setOffset(0);
        setHasMore(false);

        const { swLat, swLng, neLat, neLng } = boundsRef.current;
        const params = new URLSearchParams({
          swLat: String(swLat),
          swLng: String(swLng),
          neLat: String(neLat),
          neLng: String(neLng),
          offset: "0",
          sort: newSort,
          ...(newSort === "distance" &&
            userLocation && {
              lat: String(userLocation.lat),
              lng: String(userLocation.lng),
            }),
        });

        setIsLoading(true);
        fetch(`/api/shops?${params}`)
          .then((res) => res.json())
          .then((data) => {
            const shops = data.shops ?? [];
            setShops(shops);
            setHasMore(shops.length >= PAGE_SIZE);
          })
          .catch(() => setShops([]))
          .finally(() => setIsLoading(false));
      }
    },
    [userLocation],
  );

  const toggleExpanded = useCallback(() => setExpanded((p) => !p), []);

  const isMobileOverlay = panelMode !== "list";

  const panelContent =
    panelMode === "detail" && selectedShopId ? (
      <ShopDetail
        shopId={selectedShopId}
        onBack={handleBackToList}
        onReport={handleOpenReport}
      />
    ) : panelMode === "report" ? (
      <ReportForm
        shopId={selectedShopId ?? undefined}
        onBack={handleReportBack}
      />
    ) : panelMode === "wishlist" ? (
      <WishlistList
        onBack={() => navigatePanel("list", null)}
        onShopSelect={(id) => navigatePanel("detail", id)}
      />
    ) : (
      <ShopList
        shops={shops}
        emptyMessage={t("empty")}
        wishlisted={wishlistedIds}
        onWishlistToggle={handleWishlistToggle}
        selectedShopId={selectedShopId ?? undefined}
        onShopSelect={handleShopSelect}
        isLoading={isLoading}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        onLoadMore={handleLoadMore}
        sort={sort}
        onSortChange={handleSortChange}
      />
    );

  return (
    <Page>
      <Header onWishlistClick={() => navigatePanel("wishlist", null)} />
      <Body>
        <Sidebar>{panelContent}</Sidebar>
        <MapArea $hidden={isMobileOverlay}>
          <NaverMap
            shops={shops}
            onShopClick={handleShopClick}
            onBoundsChange={handleBoundsChange}
            selectedShopId={selectedShopId ?? undefined}
          />
          {hasMore && (
            <LoadMoreFab onClick={handleLoadMore} disabled={isLoadingMore}>
              {isLoadingMore ? t("loadingMore") : t("loadMoreFab")}
            </LoadMoreFab>
          )}
        </MapArea>
      </Body>

      {/* Mobile: full-screen overlay for detail / report */}
      <MobilePanel $visible={isMobileOverlay}>{panelContent}</MobilePanel>

      {/* Mobile: bottom sheet list */}
      {panelMode === "list" && (
        <BottomSheet $expanded={expanded}>
          <DragHandle onClick={toggleExpanded} aria-label="목록 펼치기/접기">
            <HandleBar />
          </DragHandle>
          <BottomSheetContent>
            <ShopList
              shops={shops}
              emptyMessage={t("empty")}
              wishlisted={wishlistedIds}
              onWishlistToggle={handleWishlistToggle}
              selectedShopId={selectedShopId ?? undefined}
              onShopSelect={handleShopSelect}
              isLoading={isLoading}
              hasMore={hasMore}
              isLoadingMore={isLoadingMore}
              onLoadMore={handleLoadMore}
              sort={sort}
              onSortChange={handleSortChange}
            />
          </BottomSheetContent>
        </BottomSheet>
      )}
    </Page>
  );
};

export default MapClient;
