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
import MypagePanel from "@/components/organisms/mypage/mypage-panel";
import LoginPopup from "@/components/organisms/auth/login-popup";
import SearchBar from "@/components/molecules/search/search-bar";
import BottomTabBar from "@/components/organisms/common/bottom-tab-bar";
import type { ActiveTab } from "@/components/organisms/common/bottom-tab-bar";
import { ClipboardIcon } from "@/components/atoms/icons";
import type {
  ShopSummary,
  Bounds,
  ShopDetail as ShopDetailData,
} from "@/types";
import type { SortOption } from "@/components/molecules/common/sort-bar";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchWishlistAsync,
  toggleWishlistAsync,
  selectWishlistedSet,
} from "@/store/slices/wishlist.slice";

const NaverMap = dynamic(() => import("@/components/organisms/map/naver-map"), {
  ssr: false,
});

type PanelMode = "list" | "detail" | "report" | "wishlist";

const PAGE_SIZE = 20;

interface MapClientProps {
  initialPanelMode?: PanelMode;
  initialShopId?: string | null;
  initialShopData?: ShopDetailData;
}

// ── Styled components ────────────────────────────────────────────────────────

const Page = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
`;

const MobileHidden = styled.div`
  @media (max-width: 768px) {
    display: none;
  }
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

const MypageOverlay = styled.div<{ $visible: boolean }>`
  display: none;

  @media (max-width: 768px) {
    display: ${({ $visible }) => ($visible ? "flex" : "none")};
    position: fixed;
    inset: 0;
    padding-bottom: 56px;
    background: ${({ theme }) => theme.colors.white};
    flex-direction: column;
    z-index: 150;
    overflow-y: auto;
  }
`;

const DetailBottomSheet = styled.div<{ $expanded: boolean; $visible: boolean }>`
  display: ${({ $visible }) => ($visible ? "flex" : "none")};
  position: fixed;
  bottom: 56px;
  left: 0;
  right: 0;
  background: ${({ theme }) => theme.colors.white};
  border-radius: ${({ theme }) => theme.borderRadius.xl}
    ${({ theme }) => theme.borderRadius.xl} 0 0;
  box-shadow: ${({ theme }) => theme.shadow.md};
  height: ${({ $expanded }) => ($expanded ? "calc(100vh - 56px)" : "50vh")};
  transition: height 0.3s ease;
  flex-direction: column;
  overflow: hidden;
  z-index: 100;

  @media (min-width: 769px) {
    display: none;
  }
`;

const BottomSheet = styled.div<{ $expanded: boolean }>`
  position: fixed;
  bottom: 56px;
  left: 0;
  right: 0;
  background: ${({ theme }) => theme.colors.white};
  border-radius: ${({ theme }) => theme.borderRadius.xl}
    ${({ theme }) => theme.borderRadius.xl} 0 0;
  box-shadow: ${({ theme }) => theme.shadow.md};
  height: ${({ $expanded }) => ($expanded ? "calc(70vh - 56px)" : "160px")};
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

const FloatingSearchWrapper = styled.div`
  position: absolute;
  top: 12px;
  left: 12px;
  right: 12px;
  z-index: 10;

  input {
    border: none;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);

    &:focus {
      border: none;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.18);
    }
  }

  @media (min-width: 769px) {
    display: none;
  }
`;

const ReportFabButton = styled.button`
  position: absolute;
  right: 14px;
  bottom: 122px;
  z-index: 10;
  width: 44px;
  height: 44px;
  background: ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.white};
  border: none;
  border-radius: 50%;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;

  @media (min-width: 769px) {
    display: none;
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
  initialShopData,
}: MapClientProps) => {
  const t = useTranslations("shopList");
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const locale = pathname.split("/")[1] || "ko";

  const dispatch = useAppDispatch();
  const isLoggedIn = useAppSelector((s) => s.auth.isLoggedIn);
  const wishlistedIds = useAppSelector(selectWishlistedSet);

  const [shops, setShops] = useState<ShopSummary[]>([]);
  const [panelMode, setPanelMode] = useState<PanelMode>(() => {
    if (initialPanelMode !== "list") return initialPanelMode;
    const segments = pathname.split("/").filter(Boolean);
    if (segments[1] === "shop" && segments[2]) return "detail";
    if (segments[1] === "report") return "report";
    return "list";
  });
  const [activeTab, setActiveTab] = useState<ActiveTab>("home");
  const [selectedShopId, setSelectedShopId] = useState<string | null>(() => {
    if (initialShopId) return initialShopId;
    const segments = pathname.split("/").filter(Boolean);
    if (segments[1] === "shop" && segments[2]) return segments[2];
    if (segments[1] === "report") return searchParams.get("shopId");
    return null;
  });
  const [selectedShopSummary, setSelectedShopSummary] =
    useState<ShopSummary | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [detailExpanded, setDetailExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoginPopupOpen, setIsLoginPopupOpen] = useState(false);

  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [sort, setSort] = useState<SortOption>("name");
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boundsRef = useRef<Bounds | null>(null);
  const lastViewportRef = useRef<Bounds | null>(null);

  useEffect(() => {
    if (isLoggedIn === true) dispatch(fetchWishlistAsync());
  }, [isLoggedIn, dispatch]);

  const handleWishlistToggle = useCallback(
    async (shopId: string) => {
      if (isLoggedIn === false) {
        setIsLoginPopupOpen(true);
        return;
      }
      const isWishlisted = wishlistedIds.has(shopId);
      const currentShop = shops.find((s) => s.id === shopId);
      dispatch(toggleWishlistAsync({ shopId, shop: currentShop }));
      setShops((prev) =>
        prev.map((s) =>
          s.id === shopId
            ? {
                ...s,
                wishlist_count:
                  typeof s.wishlist_count === "number"
                    ? s.wishlist_count + (isWishlisted ? -1 : 1)
                    : s.wishlist_count,
              }
            : s,
        ),
      );
    },
    [wishlistedIds, isLoggedIn, dispatch, shops],
  );

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
      if (searchQuery) return;

      if (lastViewportRef.current) {
        const prev = lastViewportRef.current;
        const prevLatSpan = prev.neLat - prev.swLat;
        const prevLngSpan = prev.neLng - prev.swLng;
        const newLatSpan = bounds.neLat - bounds.swLat;

        const zoomChanged =
          Math.abs(newLatSpan - prevLatSpan) / prevLatSpan > 0.15;

        if (!zoomChanged) {
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
    [sort, userLocation, searchQuery],
  );

  const handleLoadMore = useCallback(() => {
    if (isLoadingMore) return;
    const nextOffset = offset + 20;

    let params: URLSearchParams;
    if (searchQuery) {
      params = new URLSearchParams({
        q: searchQuery,
        offset: String(nextOffset),
        sort,
      });
    } else {
      if (!boundsRef.current) return;
      const { swLat, swLng, neLat, neLng } = boundsRef.current;
      params = new URLSearchParams({
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
    }

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
  }, [isLoadingMore, offset, sort, userLocation, searchQuery]);

  const toggleDetailExpanded = useCallback(
    () => setDetailExpanded((p) => !p),
    [],
  );

  const handleShopClick = useCallback(
    (shop: ShopSummary) => {
      setSelectedShopSummary(shop);
      setDetailExpanded(false);
      navigatePanel("detail", shop.id);
    },
    [navigatePanel],
  );

  const handleShopSelect = useCallback(
    (shopId: string) => {
      const summary = shops.find((s) => s.id === shopId) ?? null;
      setSelectedShopSummary(summary);
      navigatePanel("detail", shopId);
    },
    [navigatePanel, shops],
  );

  const handleBackToList = useCallback(() => {
    setSelectedShopSummary(null);
    setDetailExpanded(false);
    if (activeTab === "wishlist") {
      navigatePanel("wishlist", null);
    } else {
      navigatePanel("list", null);
    }
  }, [navigatePanel, activeTab]);

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

      if (newSort === "distance" && !userLocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setUserLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            });
          },
          () => {},
        );
      }

      setOffset(0);
      setHasMore(false);

      if (searchQuery) {
        const params = new URLSearchParams({
          q: searchQuery,
          offset: "0",
          sort: newSort,
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
        return;
      }

      if (boundsRef.current) {
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
    [userLocation, searchQuery],
  );

  const handleSearch = useCallback(
    (q: string) => {
      setSearchQuery(q);
      setOffset(0);
      setHasMore(false);

      if (!q) {
        if (boundsRef.current) {
          const { swLat, swLng, neLat, neLng } = boundsRef.current;
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
        return;
      }

      const params = new URLSearchParams({ q, offset: "0", sort });
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
    },
    [sort, userLocation],
  );

  const toggleExpanded = useCallback(() => setExpanded((p) => !p), []);

  const dragStartYRef = useRef<number | null>(null);
  const dragMovedRef = useRef(false);

  const handleDragTouchStart = useCallback((e: React.TouchEvent) => {
    dragStartYRef.current = e.touches[0].clientY;
    dragMovedRef.current = false;
  }, []);

  const handleDragTouchEnd = useCallback((e: React.TouchEvent) => {
    if (dragStartYRef.current === null) return;
    const delta = dragStartYRef.current - e.changedTouches[0].clientY;
    if (Math.abs(delta) > 30) {
      dragMovedRef.current = true;
      setExpanded(delta > 0);
    }
    dragStartYRef.current = null;
  }, []);

  const handleDragClick = useCallback(() => {
    if (dragMovedRef.current) {
      dragMovedRef.current = false;
      return;
    }
    setExpanded((p) => !p);
  }, []);

  const handleHeaderReportClick = useCallback(() => {
    navigatePanel("report", null);
  }, [navigatePanel]);

  const handleHeaderWishlistClick = useCallback(() => {
    if (isLoggedIn === false) {
      setIsLoginPopupOpen(true);
      return;
    }
    navigatePanel("wishlist", null);
  }, [isLoggedIn, navigatePanel]);

  const handleHeaderMypageClick = useCallback(() => {
    if (isLoggedIn === false) {
      setIsLoginPopupOpen(true);
      return;
    }
    window.location.href = `/${locale}/mypage`;
  }, [isLoggedIn, locale]);

  const handleTabChange = useCallback(
    (tab: ActiveTab) => {
      if ((tab === "wishlist" || tab === "mypage") && isLoggedIn === false) {
        setIsLoginPopupOpen(true);
        return;
      }
      setActiveTab(tab);
      if (tab === "home") {
        navigatePanel("list", null);
        setSelectedShopSummary(null);
        setDetailExpanded(false);
      } else if (tab === "wishlist") {
        navigatePanel("wishlist", null);
        setSelectedShopSummary(null);
        setDetailExpanded(false);
      }
    },
    [isLoggedIn, navigatePanel],
  );

  const isMobileOverlay = panelMode === "report";

  const panelContent =
    panelMode === "detail" && selectedShopId ? (
      <ShopDetail
        shopId={selectedShopId}
        onBack={handleBackToList}
        onReport={handleOpenReport}
        initialData={
          selectedShopId === initialShopId ? initialShopData : undefined
        }
        initialSummary={
          selectedShopSummary?.id === selectedShopId
            ? selectedShopSummary
            : undefined
        }
      />
    ) : panelMode === "report" ? (
      <ReportForm
        shopId={selectedShopId ?? undefined}
        shopName={
          selectedShopId
            ? shops.find((s) => s.id === selectedShopId)?.name
            : undefined
        }
        onBack={handleReportBack}
      />
    ) : panelMode === "wishlist" ? (
      <WishlistList
        onBack={() => navigatePanel("list", null)}
        onShopSelect={(id) => navigatePanel("detail", id)}
        onExplore={() => navigatePanel("list", null)}
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
        searchQuery={searchQuery}
        onSearch={handleSearch}
      />
    );

  const showMap = !isMobileOverlay;
  const showBottomSheet =
    panelMode === "list" || panelMode === "wishlist" || panelMode === "detail";

  return (
    <Page>
      <MobileHidden>
        <Header
          onWishlistClick={handleHeaderWishlistClick}
          onMypageClick={handleHeaderMypageClick}
          onReportClick={handleHeaderReportClick}
        />
      </MobileHidden>
      <Body>
        <Sidebar>{panelContent}</Sidebar>
        <MapArea $hidden={isMobileOverlay}>
          <NaverMap
            shops={shops}
            onShopClick={handleShopClick}
            onBoundsChange={handleBoundsChange}
            selectedShopId={selectedShopId ?? undefined}
            wishedShopIds={Array.from(wishlistedIds)}
            bottomOffset={216}
            searchMode={!!searchQuery}
          />
          {hasMore && (
            <LoadMoreFab onClick={handleLoadMore} disabled={isLoadingMore}>
              {isLoadingMore ? t("loadingMore") : t("loadMoreFab")}
            </LoadMoreFab>
          )}
          <FloatingSearchWrapper>
            <SearchBar
              onSearch={handleSearch}
              defaultValue={searchQuery}
              placeholder="샵 검색..."
            />
          </FloatingSearchWrapper>
          <ReportFabButton
            onClick={() => navigatePanel("report", null)}
            aria-label="새 샵 제보"
          >
            <ClipboardIcon size={20} />
          </ReportFabButton>
        </MapArea>
      </Body>

      <MobilePanel $visible={isMobileOverlay}>
        {panelMode === "report" && panelContent}
      </MobilePanel>

      <MypageOverlay $visible={activeTab === "mypage"}>
        <MypagePanel />
      </MypageOverlay>

      <DetailBottomSheet
        $expanded={detailExpanded}
        $visible={panelMode === "detail"}
      >
        <DragHandle
          onClick={toggleDetailExpanded}
          aria-label="상세 펼치기/접기"
        >
          <HandleBar />
        </DragHandle>
        <BottomSheetContent>
          {panelMode === "detail" && selectedShopId && (
            <ShopDetail
              shopId={selectedShopId}
              onBack={handleBackToList}
              onReport={handleOpenReport}
              initialData={
                selectedShopId === initialShopId ? initialShopData : undefined
              }
              initialSummary={
                selectedShopSummary?.id === selectedShopId
                  ? selectedShopSummary
                  : undefined
              }
            />
          )}
        </BottomSheetContent>
      </DetailBottomSheet>

      {isLoginPopupOpen && (
        <LoginPopup
          onClose={() => setIsLoginPopupOpen(false)}
          returnUrl={
            typeof window !== "undefined"
              ? window.location.pathname + window.location.search
              : "/"
          }
        />
      )}

      {showBottomSheet && panelMode !== "detail" && (
        <BottomSheet $expanded={expanded}>
          <DragHandle
            onClick={handleDragClick}
            onTouchStart={handleDragTouchStart}
            onTouchEnd={handleDragTouchEnd}
            aria-label="목록 펼치기/접기"
          >
            <HandleBar />
          </DragHandle>
          <BottomSheetContent>
            {panelMode === "wishlist" ? (
              <WishlistList
                onBack={() => {
                  setActiveTab("home");
                  navigatePanel("list", null);
                }}
                onShopSelect={handleShopSelect}
                onExplore={() => {
                  setActiveTab("home");
                  navigatePanel("list", null);
                }}
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
            )}
          </BottomSheetContent>
        </BottomSheet>
      )}

      {panelMode !== "report" && (
        <BottomTabBar activeTab={activeTab} onTabChange={handleTabChange} />
      )}
    </Page>
  );
};

export default MapClient;
