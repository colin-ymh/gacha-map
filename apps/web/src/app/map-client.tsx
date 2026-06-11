"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import styled, { keyframes } from "styled-components";
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
import ShopCard from "@/components/molecules/common/shop-card";
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
import { TEXT_GRAY } from "@/styles/color";
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
  touch-action: none;

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

const DetailBottomSheet = styled.div<{
  $expanded: boolean;
  $visible: boolean;
}>`
  display: ${({ $visible }) => ($visible ? "flex" : "none")};
  position: fixed;
  bottom: 56px;
  left: 0;
  right: 0;
  height: ${({ $expanded }) => ($expanded ? "calc(100vh - 56px)" : "50vh")};
  background: ${({ theme }) => theme.colors.white};
  border-radius: ${({ theme }) => theme.borderRadius.xl}
    ${({ theme }) => theme.borderRadius.xl} 0 0;
  box-shadow: ${({ theme }) => theme.shadow.md};
  transition: height 0.3s ease;
  flex-direction: column;
  overflow: hidden;
  z-index: 100;

  @media (min-width: 769px) {
    display: none;
  }
`;

/* [LIST_BOTTOMSHEET_DISABLED] BottomSheet — 재활성화 시 주석 해제
const BottomSheet = styled.div<{ $expanded: boolean }>`
  position: fixed;
  bottom: 56px;
  left: 0;
  right: 0;
  background: ${({ theme }) => theme.colors.white};
  border-radius: ${({ theme }) => theme.borderRadius.xl}
    ${({ theme }) => theme.borderRadius.xl} 0 0;
  box-shadow: ${({ theme }) => theme.shadow.md};
  height: ${({ $expanded }) => ($expanded ? "calc(100vh - 56px)" : "160px")};
  transition: height 0.25s ease;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 50;

  @media (min-width: 769px) {
    display: none;
  }
`;
*/

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
  touch-action: none;
`;

const HandleBar = styled.div`
  width: 40px;
  height: 4px;
  background: ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.full};
`;

/* [LIST_BOTTOMSHEET_DISABLED] BottomSheetContent — 재활성화 시 주석 해제
const BottomSheetContent = styled.div`
  flex: 1;
  overflow-y: auto;
`;
*/

const DetailSheetContent = styled.div`
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
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
    padding: 14px 16px;
    font-size: ${({ theme }) => theme.fontSize.base};
    height: 40px;

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
  bottom: 72px;
  z-index: 60;
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

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const OverlaySpinner = styled.div`
  width: 24px;
  height: 24px;
  border: 2px solid ${({ theme }) => theme.colors.border};
  border-top-color: ${({ theme }) => theme.colors.primary};
  border-radius: 50%;
  animation: ${spin} 0.8s linear infinite;
`;

const SearchResultsOverlay = styled.div<{ $visible: boolean }>`
  display: none;

  @media (max-width: 768px) {
    display: ${({ $visible }) => ($visible ? "flex" : "none")};
    position: fixed;
    inset: 0;
    padding-bottom: 56px;
    background: ${({ theme }) => theme.colors.white};
    flex-direction: column;
    z-index: 160;
    overflow: hidden;
  }
`;

const SearchOverlayHeader = styled.div`
  display: flex;
  flex-direction: column;
  padding: 12px 16px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  flex-shrink: 0;
`;

const SearchOverlayTitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  height: 44px;
`;

const SearchOverlayBackButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  color: ${({ theme }) => theme.colors.textDark};
`;

const SearchOverlayTitle = styled.h2`
  flex: 1;
  font-size: ${({ theme }) => theme.fontSize.lg};
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textDark};
  margin: 0;
`;

const SearchOverlayQueryRow = styled.div`
  display: flex;
  align-items: center;
  margin-top: 8px;
  height: 36px;
  background: ${({ theme }) => theme.colors.gray100};
  border-radius: 18px;
  padding: 0 12px;
  gap: 8px;
`;

const SearchOverlayQueryText = styled.span`
  flex: 1;
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.textDark};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const SearchOverlayClearButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px;
  display: flex;
  align-items: center;
  color: ${({ theme }) => theme.colors.textGray};
`;

const SearchOverlayCount = styled.div`
  padding: 10px 16px;
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ theme }) => theme.colors.textGray};
  flex-shrink: 0;
`;

const SearchOverlayList = styled.div`
  flex: 1;
  overflow-y: auto;
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

async function fetchShopSummaries(
  params: URLSearchParams,
  signal?: AbortSignal,
): Promise<{ shops: ShopSummary[]; total: number }> {
  const res = await fetch(`/api/shops?${params}`, { signal });
  if (!res.ok) {
    throw new Error(`Failed to fetch shops: ${res.status}`);
  }
  const data = (await res.json()) as {
    shops?: ShopSummary[];
    total?: number;
  };
  return {
    shops: data.shops ?? [],
    total: data.total ?? 0,
  };
}

const WEB_CACHE_SIZE = 8;
const WEB_CACHE_TTL_MS = 5 * 60 * 1000;

function boundsContains(outer: Bounds, inner: Bounds): boolean {
  return (
    outer.swLat <= inner.swLat &&
    outer.swLng <= inner.swLng &&
    outer.neLat >= inner.neLat &&
    outer.neLng >= inner.neLng
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

const MapClient = ({
  initialPanelMode = "list",
  initialShopId = null,
  initialShopData,
}: MapClientProps) => {
  const t = useTranslations("shopList");
  const tMap = useTranslations("map");
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const locale = pathname.split("/")[1] || "ko";

  const dispatch = useAppDispatch();
  const isLoggedIn = useAppSelector((s) => s.auth.isLoggedIn);
  const wishlistedIds = useAppSelector(selectWishlistedSet);
  const hasFetched = useAppSelector((s) => s.wishlist.hasFetched);
  const wishedShopIds = useMemo(
    () => Array.from(wishlistedIds),
    [wishlistedIds],
  );

  const [shops, setShops] = useState<ShopSummary[]>([]);
  const shopsRef = useRef<ShopSummary[]>(shops);
  useEffect(() => {
    shopsRef.current = shops;
  }, [shops]);
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
  const [listDragHeight, setListDragHeight] = useState<number | null>(null);
  const [detailDragHeight, setDetailDragHeight] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoginPopupOpen, setIsLoginPopupOpen] = useState(false);

  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [sort, setSort] = useState<SortOption>("recommended");
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boundsRef = useRef<Bounds | null>(null);
  const lastViewportRef = useRef<Bounds | null>(null);
  const boundsCacheRef = useRef<
    Array<{ bounds: Bounds; shops: ShopSummary[]; timestamp: number }>
  >([]);

  useEffect(() => {
    if (isLoggedIn === true && !hasFetched) dispatch(fetchWishlistAsync());
  }, [isLoggedIn, hasFetched, dispatch]);

  const handleWishlistToggle = useCallback(
    async (shopId: string) => {
      if (isLoggedIn === false) {
        setIsLoginPopupOpen(true);
        return;
      }
      const isWishlisted = wishlistedIds.has(shopId);
      const currentShop = shopsRef.current.find((s) => s.id === shopId);
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
    [wishlistedIds, isLoggedIn, dispatch],
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

      debounceTimerRef.current = setTimeout(async () => {
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

        // Cache hit: skip network request
        const now = Date.now();
        const cached = boundsCacheRef.current.find(
          (entry) =>
            now - entry.timestamp < WEB_CACHE_TTL_MS &&
            boundsContains(entry.bounds, fetchBounds),
        );
        if (cached) {
          const filtered = cached.shops.filter(
            (s) =>
              s.lat >= bounds.swLat &&
              s.lat <= bounds.neLat &&
              s.lng >= bounds.swLng &&
              s.lng <= bounds.neLng,
          );
          setShops(filtered);
          return;
        }

        const { swLat, swLng, neLat, neLng } = fetchBounds;
        const baseParams = {
          swLat: String(swLat),
          swLng: String(swLng),
          neLat: String(neLat),
          neLng: String(neLng),
          limit: "100",
          sort,
          ...(sort === "distance" &&
            userLocation && {
              lat: String(userLocation.lat),
              lng: String(userLocation.lng),
            }),
        };

        setIsLoading(true);
        try {
          const { shops: firstBatch, total } = await fetchShopSummaries(
            new URLSearchParams({ ...baseParams, offset: "0" }),
            controller.signal,
          );
          if (controller.signal.aborted) return;

          let allShops = firstBatch;
          let currentOffset = 100;

          while (allShops.length < total && !controller.signal.aborted) {
            const { shops: moreBatch } = await fetchShopSummaries(
              new URLSearchParams({
                ...baseParams,
                offset: String(currentOffset),
              }),
              controller.signal,
            );
            if (controller.signal.aborted) return;
            if (moreBatch.length === 0) break;
            allShops = [...allShops, ...moreBatch];
            currentOffset += 100;
          }

          if (!controller.signal.aborted) {
            setShops(allShops);
            boundsCacheRef.current = [
              { bounds: fetchBounds, shops: allShops, timestamp: Date.now() },
              ...boundsCacheRef.current.slice(0, WEB_CACHE_SIZE - 1),
            ];
          }
        } catch (err) {
          if ((err as Error).name !== "AbortError") setShops([]);
        } finally {
          setIsLoading(false);
        }
      }, 300);
    },
    [sort, userLocation, searchQuery],
  );

  const handleLoadMore = useCallback(() => {
    if (isLoadingMore) return;
    const nextOffset = offset + PAGE_SIZE;

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
    fetchShopSummaries(params)
      .then(({ shops: more, total }) => {
        setShops((prev) => [...prev, ...more]);
        setOffset(nextOffset);
        setHasMore(nextOffset + more.length < total);
      })
      .catch(() => {})
      .finally(() => setIsLoadingMore(false));
  }, [isLoadingMore, offset, sort, userLocation, searchQuery]);

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
      const summary = shopsRef.current.find((s) => s.id === shopId) ?? null;
      setSelectedShopSummary(summary);
      navigatePanel("detail", shopId);
    },
    [navigatePanel],
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

  const handleOpenClaim = useCallback(
    (shopId: string) => {
      window.location.href = `/${locale}/shop-application?shopId=${shopId}`;
    },
    [locale],
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
      boundsCacheRef.current = [];

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
        fetchShopSummaries(params)
          .then(({ shops, total }) => {
            setShops(shops);
            setHasMore(shops.length < total);
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
          limit: "100",
          sort: newSort,
          ...(newSort === "distance" &&
            userLocation && {
              lat: String(userLocation.lat),
              lng: String(userLocation.lng),
            }),
        });

        setIsLoading(true);
        fetchShopSummaries(params)
          .then(({ shops, total }) => {
            setShops(shops);
            setHasMore(shops.length < total);
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
          fetchShopSummaries(params)
            .then(({ shops, total }) => {
              setShops(shops);
              setHasMore(shops.length < total);
            })
            .catch(() => setShops([]))
            .finally(() => setIsLoading(false));
        }
        return;
      }

      const params = new URLSearchParams({ q, offset: "0", sort });
      setIsLoading(true);
      fetchShopSummaries(params)
        .then(({ shops, total }) => {
          setShops(shops);
          setHasMore(shops.length < total);
        })
        .catch(() => setShops([]))
        .finally(() => setIsLoading(false));
    },
    [sort, userLocation],
  );

  const dragStartYRef = useRef<number | null>(null);
  const dragStartHeightRef = useRef(160);
  const currentListHeightRef = useRef<number | null>(null);
  const dragMovedRef = useRef(false);
  const detailDragStartYRef = useRef<number | null>(null);
  const detailDragStartHeightRef = useRef(0);
  const currentDetailHeightRef = useRef<number | null>(null);
  const detailDragMovedRef = useRef(false);
  const listDragHandleRef = useRef<HTMLButtonElement>(null);
  const detailDragHandleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const el = listDragHandleRef.current;
    if (!el) return;
    const onMove = (e: TouchEvent) => {
      if (dragStartYRef.current === null) return;
      e.preventDefault();
      const delta = dragStartYRef.current - e.touches[0].clientY;
      const maxH = window.innerHeight - 56;
      const newH = Math.max(
        160,
        Math.min(maxH, dragStartHeightRef.current + delta),
      );
      currentListHeightRef.current = newH;
      dragMovedRef.current = true;
      setListDragHeight(newH);
    };
    el.addEventListener("touchmove", onMove, { passive: false });
    return () => el.removeEventListener("touchmove", onMove);
  }, []);

  useEffect(() => {
    const el = detailDragHandleRef.current;
    if (!el) return;
    const onMove = (e: TouchEvent) => {
      if (detailDragStartYRef.current === null) return;
      e.preventDefault();
      const delta = detailDragStartYRef.current - e.touches[0].clientY;
      const minH = window.innerHeight * 0.5;
      const maxH = window.innerHeight - 56;
      const newH = Math.max(
        minH,
        Math.min(maxH, detailDragStartHeightRef.current + delta),
      );
      currentDetailHeightRef.current = newH;
      detailDragMovedRef.current = true;
      setDetailDragHeight(newH);
    };
    el.addEventListener("touchmove", onMove, { passive: false });
    return () => el.removeEventListener("touchmove", onMove);
  }, []);

  const handleDragTouchStart = useCallback(
    (e: React.TouchEvent) => {
      dragStartYRef.current = e.touches[0].clientY;
      dragStartHeightRef.current = expanded ? window.innerHeight - 56 : 160;
      currentListHeightRef.current = dragStartHeightRef.current;
      dragMovedRef.current = false;
    },
    [expanded],
  );

  const handleDragTouchEnd = useCallback(() => {
    if (dragStartYRef.current === null) return;
    const h = currentListHeightRef.current ?? dragStartHeightRef.current;
    const maxH = window.innerHeight - 56;
    const threshold = (160 + maxH) / 2;
    setListDragHeight(null);
    setExpanded(h > threshold);
    dragStartYRef.current = null;
    currentListHeightRef.current = null;
  }, []);

  const handleDragClick = useCallback(() => {
    if (dragMovedRef.current) {
      dragMovedRef.current = false;
      return;
    }
    setExpanded((p) => !p);
  }, []);

  const handleDetailDragStart = useCallback(
    (e: React.TouchEvent) => {
      detailDragStartYRef.current = e.touches[0].clientY;
      const minH = window.innerHeight * 0.5;
      detailDragStartHeightRef.current = detailExpanded
        ? window.innerHeight - 56
        : minH;
      currentDetailHeightRef.current = detailDragStartHeightRef.current;
      detailDragMovedRef.current = false;
    },
    [detailExpanded],
  );

  const handleDetailDragEnd = useCallback(() => {
    if (detailDragStartYRef.current === null) return;
    const h =
      currentDetailHeightRef.current ?? detailDragStartHeightRef.current;
    const minH = window.innerHeight * 0.5;
    const maxH = window.innerHeight - 56;
    const threshold = (minH + maxH) / 2;
    setDetailDragHeight(null);
    setDetailExpanded(h > threshold);
    detailDragStartYRef.current = null;
    currentDetailHeightRef.current = null;
  }, []);

  const handleDetailDragClick = useCallback(() => {
    if (detailDragMovedRef.current) {
      detailDragMovedRef.current = false;
      return;
    }
    setDetailExpanded((p) => !p);
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
        onClaim={handleOpenClaim}
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

  // [LIST_BOTTOMSHEET_DISABLED] const showBottomSheet =
  //   panelMode === "list" || panelMode === "wishlist" || panelMode === "detail";

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
            wishedShopIds={wishedShopIds}
            bottomOffset={216}
          />

          <FloatingSearchWrapper>
            <SearchBar
              onSearch={handleSearch}
              defaultValue={searchQuery}
              placeholder={tMap("searchPlaceholder")}
            />
          </FloatingSearchWrapper>
          <ReportFabButton
            onClick={() => navigatePanel("report", null)}
            aria-label={tMap("searchReport")}
          >
            <ClipboardIcon size={20} />
          </ReportFabButton>
        </MapArea>
      </Body>

      <MobilePanel $visible={isMobileOverlay}>
        {panelMode === "report" && panelContent}
      </MobilePanel>

      <SearchResultsOverlay $visible={!!searchQuery}>
        <SearchOverlayHeader>
          <SearchOverlayTitleRow>
            <SearchOverlayBackButton
              onClick={() => handleSearch("")}
              aria-label={tMap("searchClose")}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
            </SearchOverlayBackButton>
            <SearchOverlayTitle>{tMap("searchTitle")}</SearchOverlayTitle>
          </SearchOverlayTitleRow>
          <SearchOverlayQueryRow>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              style={{ flexShrink: 0, color: "inherit", opacity: 0.5 }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <SearchOverlayQueryText>{searchQuery}</SearchOverlayQueryText>
            <SearchOverlayClearButton
              onClick={() => handleSearch("")}
              aria-label={tMap("searchClear")}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </SearchOverlayClearButton>
          </SearchOverlayQueryRow>
        </SearchOverlayHeader>
        {!isLoading && (
          <SearchOverlayCount>
            {tMap("searchCount", { count: shops.length })}
          </SearchOverlayCount>
        )}
        {isLoading ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <OverlaySpinner aria-label={tMap("searchLoading")} />
          </div>
        ) : (
          <SearchOverlayList>
            {shops.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "60px 16px",
                  fontSize: "14px",
                  color: TEXT_GRAY,
                }}
              >
                {tMap("searchEmpty")}
              </div>
            ) : (
              shops.map((shop) => (
                <ShopCard
                  key={shop.id}
                  shop={shop}
                  wishlisted={wishlistedIds.has(shop.id)}
                  onWishlistToggle={handleWishlistToggle}
                  onSelect={handleShopSelect}
                />
              ))
            )}
          </SearchOverlayList>
        )}
      </SearchResultsOverlay>

      <MypageOverlay $visible={activeTab === "mypage"}>
        <MypagePanel />
      </MypageOverlay>

      <DetailBottomSheet
        $expanded={detailExpanded}
        $visible={panelMode === "detail"}
        style={
          detailDragHeight !== null
            ? { height: `${detailDragHeight}px`, transition: "none" }
            : undefined
        }
      >
        <DragHandle
          ref={detailDragHandleRef}
          onClick={handleDetailDragClick}
          onTouchStart={handleDetailDragStart}
          onTouchEnd={handleDetailDragEnd}
          aria-label={tMap("expandDetail")}
        >
          <HandleBar />
        </DragHandle>
        <DetailSheetContent>
          {panelMode === "detail" && selectedShopId && (
            <ShopDetail
              shopId={selectedShopId}
              onBack={handleBackToList}
              onReport={handleOpenReport}
              onClaim={handleOpenClaim}
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
        </DetailSheetContent>
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

      {/* [LIST_BOTTOMSHEET_DISABLED] 목록 바텀시트 — 재활성화 시 주석 해제
      {showBottomSheet && panelMode !== "detail" && (
        <BottomSheet
          $expanded={expanded}
          style={
            listDragHeight !== null
              ? { height: `${listDragHeight}px`, transition: "none" }
              : undefined
          }
        >
          <DragHandle
            ref={listDragHandleRef}
            onClick={handleDragClick}
            onTouchStart={handleDragTouchStart}
            onTouchEnd={handleDragTouchEnd}
            aria-label={tMap("expandList")}
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
      */}

      {panelMode !== "report" && (
        <BottomTabBar activeTab={activeTab} onTabChange={handleTabChange} />
      )}
    </Page>
  );
};

export default MapClient;
