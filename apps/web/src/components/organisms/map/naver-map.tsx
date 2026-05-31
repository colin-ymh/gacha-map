"use client";

import { useEffect, useRef, useState } from "react";
import type { ShopSummary, Bounds } from "@/types";
import {
  PRIMARY,
  PRIMARY_BG,
  PRIMARY_HOVER,
  MAP_LOCATION,
  TEXT_DARK,
} from "@/styles/color";
import NaverMapView from "./naver-map.view";

interface NaverMapProps {
  shops: ShopSummary[];
  onShopClick?: (shop: ShopSummary) => void;
  onBoundsChange?: (bounds: Bounds) => void;
  center?: { lat: number; lng: number };
  zoom?: number;
  selectedShopId?: string;
  wishedShopIds?: string[];
  bottomOffset?: number;
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    naver: any;
  }
}

const buildMarkerContent = (
  isActive: boolean,
  isWished: boolean,
  name?: string,
) => {
  const w = isActive ? 36 : 28;
  const h = isActive ? 46 : 36;
  const fill = isWished ? PRIMARY : PRIMARY_BG;
  const stroke = isWished ? PRIMARY_HOVER : PRIMARY;
  const svg = `<svg width="${w}" height="${h}" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 0C6.268 0 0 6.268 0 14c0 9.8 14 22 14 22S28 23.8 28 14C28 6.268 21.732 0 14 0z" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/><circle cx="14" cy="13" r="5" fill="white"/></svg>`;
  if (isActive && name) {
    return `<div style="position:relative;width:${w}px;height:${h}px;"><div style="position:absolute;bottom:calc(100% + 4px);left:50%;transform:translateX(-50%);background:white;border-radius:8px;padding:4px 10px;font-size:12px;font-weight:700;color:${TEXT_DARK};box-shadow:0 2px 10px rgba(0,0,0,0.25);border:1px solid rgba(0,0,0,0.08);white-space:nowrap;line-height:1.4;font-family:-apple-system,BlinkMacSystemFont,sans-serif;">${name}</div>${svg}</div>`;
  }
  return `<div style="width:${w}px;height:${h}px;">${svg}</div>`;
};

const buildMyLocationContent = () =>
  `<div style="width:20px;height:20px;background:${MAP_LOCATION};border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`;

const NaverMap = ({
  shops,
  onShopClick,
  onBoundsChange,
  center = { lat: 37.5665, lng: 126.978 },
  zoom = 15,
  selectedShopId,
  wishedShopIds = [],
  bottomOffset = 0,
}: NaverMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<Map<string, any>>(new Map());
  const markerStateRef = useRef<
    Map<string, { isActive: boolean; isWished: boolean }>
  >(new Map());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const myLocationMarkerRef = useRef<any>(null);
  const onBoundsChangeRef = useRef(onBoundsChange);
  const onShopClickRef = useRef(onShopClick);
  const selectedShopIdRef = useRef(selectedShopId);
  const wishedShopIdsRef = useRef(wishedShopIds);
  const shopsRef = useRef(shops);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    onBoundsChangeRef.current = onBoundsChange;
  }, [onBoundsChange]);

  useEffect(() => {
    onShopClickRef.current = onShopClick;
  }, [onShopClick]);

  useEffect(() => {
    selectedShopIdRef.current = selectedShopId;
  }, [selectedShopId, bottomOffset]);

  useEffect(() => {
    wishedShopIdsRef.current = wishedShopIds;
  }, [wishedShopIds]);

  useEffect(() => {
    shopsRef.current = shops;
  }, [shops]);

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

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          const position = new window.naver.maps.LatLng(latitude, longitude);
          map.setCenter(position);

          myLocationMarkerRef.current = new window.naver.maps.Marker({
            position,
            map,
            icon: {
              content: buildMyLocationContent(),
              anchor: new window.naver.maps.Point(10, 10),
            },
          });
        },
        () => {},
      );
    }
  }, [ready, center.lat, center.lng, zoom]);

  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const currentSelectedId = selectedShopIdRef.current;
    const currentWishedIds = wishedShopIdsRef.current;
    const shopSet = new Set(shops.map((s) => s.id));

    // Remove markers no longer in view
    markersRef.current.forEach((m, id) => {
      if (!shopSet.has(id)) {
        m.setMap(null);
        markersRef.current.delete(id);
      }
    });

    // Add markers for new shops only
    shops.forEach((shop) => {
      if (markersRef.current.has(shop.id)) return;

      const isActive = shop.id === currentSelectedId;
      const isWished = currentWishedIds.includes(shop.id);
      const pinW = isActive ? 36 : 28;
      const pinH = isActive ? 46 : 36;

      const marker = new window.naver.maps.Marker({
        position: new window.naver.maps.LatLng(shop.lat, shop.lng),
        map: mapInstanceRef.current,
        icon: {
          content: buildMarkerContent(
            isActive,
            isWished,
            isActive ? shop.name : undefined,
          ),
          anchor: new window.naver.maps.Point(pinW / 2, pinH),
        },
      });

      window.naver.maps.Event.addListener(marker, "click", () =>
        onShopClickRef.current?.(shop),
      );

      markersRef.current.set(shop.id, marker);
      markerStateRef.current.set(shop.id, { isActive, isWished });
    });
  }, [shops, ready]);

  useEffect(() => {
    if (!mapInstanceRef.current || !selectedShopId) return;
    const shop = shopsRef.current.find((s) => s.id === selectedShopId);
    if (!shop) return;
    const TARGET_ZOOM = 17;
    const isMobile = window.innerWidth < 769;

    let adjustedLat = shop.lat;
    if (isMobile && bottomOffset > 0) {
      const metersPerPixel =
        (156543.03392 * Math.cos((shop.lat * Math.PI) / 180)) /
        Math.pow(2, TARGET_ZOOM);
      const latOffsetDegrees = ((bottomOffset / 2) * metersPerPixel) / 111000;
      adjustedLat = shop.lat - latOffsetDegrees;
    }

    const adjustedLatLng = new window.naver.maps.LatLng(adjustedLat, shop.lng);
    mapInstanceRef.current.morph(adjustedLatLng, TARGET_ZOOM);
  }, [selectedShopId, bottomOffset]);

  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const markers = markersRef.current;
    if (markers.size === 0) return;

    markers.forEach((marker, shopId) => {
      const isActive = shopId === selectedShopId;
      const isWished = wishedShopIds.includes(shopId);
      const prev = markerStateRef.current.get(shopId);
      if (prev && prev.isActive === isActive && prev.isWished === isWished)
        return;

      const pinW = isActive ? 36 : 28;
      const pinH = isActive ? 46 : 36;
      const shop = isActive
        ? shopsRef.current.find((s) => s.id === shopId)
        : undefined;
      marker.setIcon({
        content: buildMarkerContent(isActive, isWished, shop?.name),
        anchor: new window.naver.maps.Point(pinW / 2, pinH),
      });
      markerStateRef.current.set(shopId, { isActive, isWished });
    });
  }, [selectedShopId, wishedShopIds]);

  const handleMyLocation = () => {
    if (!mapInstanceRef.current || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude, longitude } = pos.coords;
      const position = new window.naver.maps.LatLng(latitude, longitude);
      mapInstanceRef.current.setCenter(position);

      if (myLocationMarkerRef.current) {
        myLocationMarkerRef.current.setMap(null);
      }
      myLocationMarkerRef.current = new window.naver.maps.Marker({
        position,
        map: mapInstanceRef.current,
        icon: {
          content: buildMyLocationContent(),
          anchor: new window.naver.maps.Point(10, 10),
        },
      });
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
