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
import type { ShopSummary, Bounds } from "@/types";

const NaverMap = dynamic(() => import("@/components/organisms/map/naver-map"), {
  ssr: false,
});

type PanelMode = "list" | "detail" | "report";

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

  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const handleBoundsChange = useCallback((bounds: Bounds) => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(() => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const { swLat, swLng, neLat, neLng } = bounds;
      const params = new URLSearchParams({
        swLat: String(swLat),
        swLng: String(swLng),
        neLat: String(neLat),
        neLng: String(neLng),
      });

      setIsLoading(true);
      fetch(`/api/shops?${params}`, { signal: controller.signal })
        .then((res) => res.json())
        .then((data) => setShops(data.shops ?? []))
        .catch((err) => {
          if (err.name !== "AbortError") setShops([]);
        })
        .finally(() => setIsLoading(false));
    }, 300);
  }, []);

  const handleShopClick = useCallback(
    ( shop: ShopSummary) => navigatePanel("detail", shop.id),
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
    ) : (
      <ShopList
        shops={shops}
        showCount
        emptyMessage={t("empty")}
        selectedShopId={selectedShopId ?? undefined}
        onShopSelect={handleShopSelect}
        isLoading={isLoading}
      />
    );

  return (
    <Page>
      <Header />
      <Body>
        <Sidebar>{panelContent}</Sidebar>
        <MapArea $hidden={isMobileOverlay}>
          <NaverMap
            shops={shops}
            onShopClick={handleShopClick}
            onBoundsChange={handleBoundsChange}
            selectedShopId={selectedShopId ?? undefined}
          />
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
              showCount
              emptyMessage={t("empty")}
              selectedShopId={selectedShopId ?? undefined}
              onShopSelect={handleShopSelect}
              isLoading={isLoading}
            />
          </BottomSheetContent>
        </BottomSheet>
      )}
    </Page>
  );
};

export default MapClient;
