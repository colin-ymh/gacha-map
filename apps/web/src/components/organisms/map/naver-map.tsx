"use client";

import { useEffect, useRef, useState } from "react";
import type { ShopSummary, Bounds } from "@/types";
import { PRIMARY, GRAY_300, MAP_LOCATION, TEXT_DARK } from "@/styles/color";
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
  searchMode?: boolean;
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    naver: any;
  }
}

const MARKER_COMMON_STYLE =
  "border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.25);";

const buildMarkerContent = (isActive: boolean, isWished: boolean) => {
  const size = isActive ? 24 : 18;
  const half = size / 2;
  const color = isWished ? PRIMARY : GRAY_300;
  return `<div style="width:${size}px;height:${size}px;background:${color};${MARKER_COMMON_STYLE}margin:-${half}px 0 0 -${half}px;"></div>`;
};

const buildMyLocationContent = () =>
  `<div style="width:20px;height:20px;background:${MAP_LOCATION};${MARKER_COMMON_STYLE}"></div>`;

const buildTooltipContent = (name: string) =>
  `<div style="background:white;border-radius:13px;padding:5px 12px;font-size:11px;font-weight:700;color:${TEXT_DARK};box-shadow:0 2px 6px rgba(0,0,0,0.15);white-space:nowrap;">${name}</div>`;

const NaverMap = ({
  shops,
  onShopClick,
  onBoundsChange,
  center = { lat: 37.5665, lng: 126.978 },
  zoom = 15,
  selectedShopId,
  wishedShopIds = [],
  bottomOffset = 0,
  searchMode = false,
}: NaverMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<Map<string, any>>(new Map());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const infoWindowRef = useRef<any>(null);
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

    if (infoWindowRef.current) {
      infoWindowRef.current.close();
      infoWindowRef.current = null;
    }

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
      const anchorSize = isActive ? 12 : 9;

      const marker = new window.naver.maps.Marker({
        position: new window.naver.maps.LatLng(shop.lat, shop.lng),
        map: mapInstanceRef.current,
        title: shop.name,
        icon: {
          content: buildMarkerContent(isActive, isWished),
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
        const bounds = mapInstanceRef.current!.getBounds();
        const sw = bounds.getSW();
        const ne = bounds.getNE();
        const inBounds =
          shop.lat >= sw.lat() &&
          shop.lat <= ne.lat() &&
          shop.lng >= sw.lng() &&
          shop.lng <= ne.lng();
        if (inBounds) {
          infoWindow.open(mapInstanceRef.current, marker);
          infoWindowRef.current = infoWindow;
        }
      }

      markersRef.current.set(shop.id, marker);
    });
  }, [shops, ready]);

  useEffect(() => {
    if (!mapInstanceRef.current || !searchMode || shops.length === 0) return;
    const lats = shops.map((s) => s.lat);
    const lngs = shops.map((s) => s.lng);
    const bounds = new window.naver.maps.LatLngBounds(
      new window.naver.maps.LatLng(Math.min(...lats), Math.min(...lngs)),
      new window.naver.maps.LatLng(Math.max(...lats), Math.max(...lngs)),
    );
    mapInstanceRef.current.fitBounds(bounds, {
      top: 80,
      right: 20,
      bottom: 230,
      left: 20,
    });
  }, [shops, searchMode]);

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

    if (infoWindowRef.current) {
      infoWindowRef.current.close();
      infoWindowRef.current = null;
    }

    markers.forEach((marker, shopId) => {
      const isActive = shopId === selectedShopId;
      const isWished = wishedShopIds.includes(shopId);
      const anchorSize = isActive ? 12 : 9;
      marker.setIcon({
        content: buildMarkerContent(isActive, isWished),
        anchor: new window.naver.maps.Point(anchorSize, anchorSize),
      });

      if (isActive) {
        const shop = shopsRef.current.find((s) => s.id === shopId);
        if (shop) {
          const bounds = mapInstanceRef.current!.getBounds();
          const sw = bounds.getSW();
          const ne = bounds.getNE();
          const inBounds =
            shop.lat >= sw.lat() &&
            shop.lat <= ne.lat() &&
            shop.lng >= sw.lng() &&
            shop.lng <= ne.lng();
          if (inBounds) {
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
      }
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
