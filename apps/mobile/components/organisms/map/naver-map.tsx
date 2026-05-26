import {
  useRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useMemo,
  useState,
} from "react";

import * as Location from "expo-location";
import type {
  NaverMapViewRef,
  Camera,
  CameraChangeReason,
  Region,
} from "@mj-studio/react-native-naver-map";
import type { Bounds, ShopSummary } from "@gacha-map/shared";
import NaverMapScreenView from "./naver-map.view";

type LatLng = {
  latitude: number;
  longitude: number;
};

export type NaverCameraChangedEvent = Camera & {
  reason: CameraChangeReason;
  contentBounds?: {
    southWest: LatLng;
    northEast: LatLng;
  };
  region?: Region;
};

interface NaverMapProps {
  shops: ShopSummary[];
  selectedShopId?: string;
  wishedShopIds?: string[];
  onShopPress?: (shop: ShopSummary) => void;
  onMapInteraction?: () => void;
  onUserLocation?: (loc: { lat: number; lng: number }) => void;
  onLocationPermission?: (permission: "granted" | "denied") => void;
}

export interface NaverMapHandle {
  goToMyLocation: () => Promise<"granted" | "denied">;
  centerOnShop: (lat: number, lng: number) => void;
  getCurrentBounds: () => Bounds | null;
  fitBoundsToShops: (shops: ShopSummary[]) => void;
}

const INITIAL_CAMERA: Camera = {
  latitude: 37.5666,
  longitude: 126.9784,
  zoom: 14,
};

const NaverMap = forwardRef<NaverMapHandle, NaverMapProps>(function NaverMap(
  {
    shops,
    selectedShopId,
    wishedShopIds = [],
    onShopPress,
    onMapInteraction,
    onUserLocation,
    onLocationPermission,
  },
  ref,
) {
  const mapRef = useRef<NaverMapViewRef>(null);
  const currentBoundsRef = useRef<Bounds | null>(null);
  const currentZoomRef = useRef(14);
  const isProgrammaticMoveRef = useRef(false);
  const suppressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markerJustPressedRef = useRef(false);
  const markerPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [bearing, setBearing] = useState(0);

  const locationOverlay = useMemo(() => ({ isVisible: false }), []);

  const markers = useMemo(
    () =>
      shops.map((shop) => ({
        id: shop.id,
        lat: shop.lat,
        lng: shop.lng,
        name: shop.name,
        isActive: shop.id === selectedShopId,
        isWished: wishedShopIds.includes(shop.id),
      })),
    [shops, selectedShopId, wishedShopIds],
  );

  const handleCameraChanged = useCallback(
    (params: NaverCameraChangedEvent) => {
      if (params.zoom != null) {
        currentZoomRef.current = params.zoom;
      }

      if (params.contentBounds) {
        currentBoundsRef.current = {
          swLat: params.contentBounds.southWest.latitude,
          swLng: params.contentBounds.southWest.longitude,
          neLat: params.contentBounds.northEast.latitude,
          neLng: params.contentBounds.northEast.longitude,
        };
      } else if (params.region) {
        currentBoundsRef.current = {
          swLat: params.region.latitude,
          swLng: params.region.longitude,
          neLat: params.region.latitude + params.region.latitudeDelta,
          neLng: params.region.longitude + params.region.longitudeDelta,
        };
      }

      const isUserGesture =
        params.reason === "Gesture" || params.reason === "Control";
      if (isUserGesture) {
        // 사용자 제스처 시 프로그래매틱 억제 즉시 해제
        if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
        isProgrammaticMoveRef.current = false;
        if (!markerJustPressedRef.current) {
          onMapInteraction?.();
        }
      }
    },
    [onMapInteraction],
  );

  const handleMarkerPress = useCallback(
    (id: string) => {
      markerJustPressedRef.current = true;
      if (markerPressTimerRef.current)
        clearTimeout(markerPressTimerRef.current);
      markerPressTimerRef.current = setTimeout(() => {
        markerJustPressedRef.current = false;
      }, 400);
      const shop = shops.find((s) => s.id === id);
      if (shop) onShopPress?.(shop);
    },
    [shops, onShopPress],
  );

  const goToMyLocation = useCallback(async (): Promise<
    "granted" | "denied"
  > => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    const permission = status === "granted" ? "granted" : "denied";
    onLocationPermission?.(permission);
    if (status !== "granted") return "denied";

    const location = await Location.getCurrentPositionAsync({});
    const { latitude, longitude } = location.coords;
    setUserLocation({ lat: latitude, lng: longitude });
    onUserLocation?.({ lat: latitude, lng: longitude });
    mapRef.current?.animateCameraTo({ latitude, longitude, zoom: 16 });
    return "granted";
  }, [onUserLocation, onLocationPermission]);

  const centerOnShop = useCallback((lat: number, lng: number) => {
    if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
    isProgrammaticMoveRef.current = true;
    suppressTimerRef.current = setTimeout(() => {
      isProgrammaticMoveRef.current = false;
    }, 1100); // 300ms animation + 600ms debounce buffer + 200ms slack

    mapRef.current?.animateCameraTo({
      latitude: lat,
      longitude: lng,
      zoom: Math.max(14, currentZoomRef.current),
      duration: 300,
    });
  }, []);

  const getCurrentBounds = useCallback(
    (): Bounds | null => currentBoundsRef.current,
    [],
  );

  const fitBoundsToShops = useCallback((shops: ShopSummary[]) => {
    if (shops.length === 0) return;

    if (shops.length === 1) {
      const shop = shops[0];
      if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
      isProgrammaticMoveRef.current = true;
      suppressTimerRef.current = setTimeout(() => {
        isProgrammaticMoveRef.current = false;
      }, 1100);
      mapRef.current?.animateCameraTo({
        latitude: shop.lat,
        longitude: shop.lng,
        zoom: 16,
        duration: 300,
      });
      return;
    }

    let minLat = shops[0].lat,
      maxLat = shops[0].lat;
    let minLng = shops[0].lng,
      maxLng = shops[0].lng;
    for (const shop of shops) {
      if (shop.lat < minLat) minLat = shop.lat;
      if (shop.lat > maxLat) maxLat = shop.lat;
      if (shop.lng < minLng) minLng = shop.lng;
      if (shop.lng > maxLng) maxLng = shop.lng;
    }

    const latDelta = maxLat - minLat;
    const lngDelta = maxLng - minLng;
    const latPadding = latDelta * 0.15 || 0.01;
    const lngPadding = lngDelta * 0.15 || 0.01;

    if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
    isProgrammaticMoveRef.current = true;
    suppressTimerRef.current = setTimeout(() => {
      isProgrammaticMoveRef.current = false;
    }, 1100);

    mapRef.current?.animateRegionTo({
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: latDelta + latPadding * 2,
      longitudeDelta: lngDelta + lngPadding * 2,
      duration: 300,
    });
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      goToMyLocation,
      centerOnShop,
      getCurrentBounds,
      fitBoundsToShops,
    }),
    [goToMyLocation, centerOnShop, getCurrentBounds, fitBoundsToShops],
  );

  useEffect(() => {
    return () => {
      if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
    };
  }, []);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;
      setUserLocation({ lat: latitude, lng: longitude });
      onUserLocation?.({ lat: latitude, lng: longitude });
      mapRef.current?.animateCameraTo({ latitude, longitude, zoom: 14 });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lastBearingRef = useRef(0);
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      sub = await Location.watchHeadingAsync((h) => {
        const next = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
        if (Math.abs(next - lastBearingRef.current) >= 5) {
          lastBearingRef.current = next;
          setBearing(next);
        }
      });
    })();
    return () => {
      sub?.remove();
    };
  }, []);

  return (
    <NaverMapScreenView
      mapRef={mapRef}
      initialCamera={INITIAL_CAMERA}
      markers={markers}
      locationOverlay={locationOverlay}
      userLocation={userLocation}
      bearing={bearing}
      onCameraChanged={handleCameraChanged}
      onMarkerPress={handleMarkerPress}
    />
  );
});

export default NaverMap;
