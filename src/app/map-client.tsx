"use client";

import { useState, useCallback, useRef } from "react";
import styled from "styled-components";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import Header from "@/components/organisms/common/header";
import ShopList from "@/components/organisms/common/shop-list";
import type { Shop, Bounds } from "@/types";

const NaverMap = dynamic(() => import("@/components/organisms/map/naver-map"), {
  ssr: false,
});

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

const MapArea = styled.div`
  flex: 1;
  position: relative;
`;

const Sidebar = styled.aside`
  width: ${({ theme }) => theme.layout.sidebarWidth};
  background: ${({ theme }) => theme.colors.white};
  border-left: 1px solid ${({ theme }) => theme.colors.border};
  display: flex;
  flex-direction: column;
  overflow: hidden;

  @media (max-width: 768px) {
    display: none;
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

const MapClient = () => {
  const t = useTranslations("shopList");
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleBoundsChange = useCallback((bounds: Bounds) => {
    // 이전 debounce 타이머 취소
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      // 이전 요청 취소
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
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

  const handleShopClick = useCallback((shop: Shop) => {
    setSelectedShop(shop);
  }, []);

  const handleShopSelect = useCallback(
    (shopId: string) => {
      const shop = shops.find((s) => s.id === shopId);
      if (shop) setSelectedShop(shop);
    },
    [shops],
  );

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  return (
    <Page>
      <Header />
      <Body>
        <MapArea>
          <NaverMap
            shops={shops}
            onShopClick={handleShopClick}
            onBoundsChange={handleBoundsChange}
            selectedShopId={selectedShop?.id}
          />
        </MapArea>
        <Sidebar>
          <ShopList
            shops={shops}
            showCount
            emptyMessage={t("empty")}
            selectedShopId={selectedShop?.id}
            onShopSelect={handleShopSelect}
            isLoading={isLoading}
          />
        </Sidebar>
      </Body>
      <BottomSheet $expanded={expanded}>
        <DragHandle onClick={toggleExpanded} aria-label="목록 펼치기/접기">
          <HandleBar />
        </DragHandle>
        <BottomSheetContent>
          <ShopList
            shops={shops}
            showCount
            emptyMessage={t("empty")}
            selectedShopId={selectedShop?.id}
            onShopSelect={handleShopSelect}
            isLoading={isLoading}
          />
        </BottomSheetContent>
      </BottomSheet>
    </Page>
  );
};

export default MapClient;
