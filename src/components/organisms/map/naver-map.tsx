"use client";

import { useEffect, useRef, useState } from "react";
import type { ShopSummary, Bounds } from "@/types";
import NaverMapView from "./naver-map.view";

interface NaverMapProps {
  shops: ShopSummary[];
  onShopClick?: (shop: ShopSummary) => void;
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

const buildMarkerContent = (isActive: boolean) => {
  const size = isActive ? 20 : 14;
  const half = size / 2;
  return `<div style="width:${size}px;height:${size}px;background:#E63946;border-radius:50%;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3);margin:-${half}px 0 0 -${half}px;"></div>`;
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
      queueMicrotask(() => setReady(true));
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

    const initialBounds = map.getBounds();
    if (initialBounds) {
      const sw = initialBounds.getSW();
      const ne = initialBounds.getNE();
      onBoundsChangeRef.current?.({
        swLat: sw.lat(),
        swLng: sw.lng(),
        neLat: ne.lat(),
        neLng: ne.lng(),
      });
    }
  }, [ready, center.lat, center.lng, zoom]);

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
    <NaverMapView
      mapRef={mapRef}
      ready={ready}
      onMyLocation={handleMyLocation}
    />
  );
};

export default NaverMap;
