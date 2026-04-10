"use client";

import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { useTranslations } from "next-intl";
import type { Shop, Bounds } from "@/types";

interface NaverMapProps {
  shops: Shop[];
  onShopClick?: (shop: Shop) => void;
  onBoundsChange?: (bounds: Bounds) => void;
  center?: { lat: number; lng: number };
  zoom?: number;
  selectedShopId?: string;
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    naver: any;
  }
}

const Container = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
`;

const MapDiv = styled.div`
  width: 100%;
  height: 100%;
`;

const Loading = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({ theme }) => theme.colors.gray100};
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.gray400};
`;

const MyLocationButton = styled.button`
  position: absolute;
  right: 14px;
  bottom: 14px;
  z-index: 10;
  width: 44px;
  height: 44px;
  background: white;
  border: none;
  border-radius: 50%;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  color: #ff6b35;
`;

const buildMarkerContent = (isActive: boolean) => {
  const size = isActive ? 20 : 14;
  const half = size / 2;
  return `<div style="width:${size}px;height:${size}px;background:#FF6B35;border-radius:50%;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3);margin:-${half}px 0 0 -${half}px;"></div>`;
};

const buildTooltipContent = (name: string) =>
  `<div style="background:white;border-radius:13px;padding:5px 12px;font-size:11px;font-weight:700;color:#1A1A1A;box-shadow:0 2px 6px rgba(0,0,0,0.15);white-space:nowrap;">${name}</div>`;

const NaverMap = ({
  shops,
  onShopClick,
  onBoundsChange,
  center = { lat: 37.5665, lng: 126.978 },
  zoom = 13,
  selectedShopId,
}: NaverMapProps) => {
  const t = useTranslations("map");
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<Map<string, any>>(new Map());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const infoWindowRef = useRef<any>(null);
  const onBoundsChangeRef = useRef(onBoundsChange);
  const onShopClickRef = useRef(onShopClick);
  const selectedShopIdRef = useRef(selectedShopId);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    onBoundsChangeRef.current = onBoundsChange;
  }, [onBoundsChange]);

  useEffect(() => {
    onShopClickRef.current = onShopClick;
  }, [onShopClick]);

  useEffect(() => {
    selectedShopIdRef.current = selectedShopId;
  }, [selectedShopId]);

  useEffect(() => {
    if (window.naver?.maps) {
      setReady(true);
      return;
    }
    const interval = setInterval(() => {
      if (window.naver?.maps) {
        setReady(true);
        clearInterval(interval);
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current || mapInstanceRef.current) return;
    const map = new window.naver.maps.Map(mapRef.current, {
      center: new window.naver.maps.LatLng(center.lat, center.lng),
      zoom,
    });
    mapInstanceRef.current = map;

    window.naver.maps.Event.addListener(map, "idle", () => {
      const bounds = map.getBounds();
      const sw = bounds.getSW();
      const ne = bounds.getNE();
      onBoundsChangeRef.current?.({
        swLat: sw.lat(),
        swLng: sw.lng(),
        neLat: ne.lat(),
        neLng: ne.lng(),
      });
    });
  }, [ready, center.lat, center.lng, zoom]);

  // shops가 바뀔 때만 마커 전체 재생성
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = new Map();

    if (infoWindowRef.current) {
      infoWindowRef.current.close();
      infoWindowRef.current = null;
    }

    const currentSelectedId = selectedShopIdRef.current;

    shops.forEach((shop) => {
      const isActive = shop.id === currentSelectedId;
      const anchorSize = isActive ? 10 : 7;

      const marker = new window.naver.maps.Marker({
        position: new window.naver.maps.LatLng(shop.lat, shop.lng),
        map: mapInstanceRef.current,
        title: shop.name,
        icon: {
          content: buildMarkerContent(isActive),
          anchor: new window.naver.maps.Point(anchorSize, anchorSize),
        },
      });

      window.naver.maps.Event.addListener(marker, "click", () =>
        onShopClickRef.current?.(shop),
      );

      if (isActive) {
        const infoWindow = new window.naver.maps.InfoWindow({
          content: buildTooltipContent(shop.name),
          borderWidth: 0,
          backgroundColor: "transparent",
          disableAnchor: true,
          pixelOffset: new window.naver.maps.Point(0, -28),
        });
        infoWindow.open(mapInstanceRef.current, marker);
        infoWindowRef.current = infoWindow;
      }

      markersRef.current.set(shop.id, marker);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shops, ready]);

  // selectedShopId만 바뀐 경우: 마커 아이콘만 교체
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const markers = markersRef.current;
    if (markers.size === 0) return;

    if (infoWindowRef.current) {
      infoWindowRef.current.close();
      infoWindowRef.current = null;
    }

    markers.forEach((marker, shopId) => {
      const isActive = shopId === selectedShopId;
      const anchorSize = isActive ? 10 : 7;
      marker.setIcon({
        content: buildMarkerContent(isActive),
        anchor: new window.naver.maps.Point(anchorSize, anchorSize),
      });

      if (isActive) {
        const shop = shops.find((s) => s.id === shopId);
        if (shop) {
          const infoWindow = new window.naver.maps.InfoWindow({
            content: buildTooltipContent(shop.name),
            borderWidth: 0,
            backgroundColor: "transparent",
            disableAnchor: true,
            pixelOffset: new window.naver.maps.Point(0, -28),
          });
          infoWindow.open(mapInstanceRef.current, marker);
          infoWindowRef.current = infoWindow;
        }
      }
    });
    // shops는 의존성에 포함하되, 마커 재생성 effect와 실행 순서가 보장됨
  }, [selectedShopId, shops]);

  const handleMyLocation = () => {
    if (!mapInstanceRef.current || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude, longitude } = pos.coords;
      mapInstanceRef.current.setCenter(
        new window.naver.maps.LatLng(latitude, longitude),
      );
    });
  };

  return (
    <Container>
      <MapDiv ref={mapRef} />
      {!ready && <Loading>{t("loading")}</Loading>}
      <MyLocationButton onClick={handleMyLocation} aria-label={t("myLocation")}>
        ◎
      </MyLocationButton>
    </Container>
  );
};

export default NaverMap;
