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
  onCameraIdle?: (bounds: Bounds) => void;
  onUserLocation?: (loc: { lat: number; lng: number }) => void;
  onLocationPermission?: (permission: "granted" | "denied") => void;
}

export interface NaverMapHandle {
  goToMyLocation: () => Promise<"granted" | "denied">;
  centerOnShop: (lat: number, lng: number) => void;
  getCurrentBounds: () => Bounds | null;
  fitToShops: (shops: Array<{ lat: number; lng: number }>) => void;
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
    onCameraIdle,
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
  const cameraIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
        if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
        isProgrammaticMoveRef.current = false;
        if (!markerJustPressedRef.current) {
          onMapInteraction?.();
        }
      }

      if (cameraIdleTimerRef.current) clearTimeout(cameraIdleTimerRef.current);
      cameraIdleTimerRef.current = setTimeout(() => {
        if (!isProgrammaticMoveRef.current && currentBoundsRef.current) {
          onCameraIdle?.(currentBoundsRef.current);
        }
      }, 500);
    },
    [onMapInteraction, onCameraIdle],
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

  const fitToShops = useCallback(
    (shops: Array<{ lat: number; lng: number }>) => {
      if (shops.length === 0) return;

      if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
      isProgrammaticMoveRef.current = true;
      suppressTimerRef.current = setTimeout(() => {
        isProgrammaticMoveRef.current = false;
      }, 1100);

      if (shops.length === 1) {
        mapRef.current?.animateCameraTo({
          latitude: shops[0].lat,
          longitude: shops[0].lng,
          zoom: 15,
          duration: 300,
        });
        return;
      }

      const lats = shops.map((s) => s.lat);
      const lngs = shops.map((s) => s.lng);
      const swLat = Math.min(...lats);
      const neLat = Math.max(...lats);
      const swLng = Math.min(...lngs);
      const neLng = Math.max(...lngs);
      const minDelta = 0.01;
      const dLat = Math.max((neLat - swLat) * 0.1, minDelta);
      const dLng = Math.max((neLng - swLng) * 0.1, minDelta);
      mapRef.current?.animateCameraWithTwoCoords({
        coord1: { latitude: swLat - dLat, longitude: swLng - dLng },
        coord2: { latitude: neLat + dLat, longitude: neLng + dLng },
        duration: 300,
      });
    },
    [],
  );

  useImperativeHandle(
    ref,
    () => ({
      goToMyLocation,
      centerOnShop,
      getCurrentBounds,
      fitToShops,
    }),
    [goToMyLocation, centerOnShop, getCurrentBounds, fitToShops],
  );

  useEffect(() => {
    return () => {
      if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
      if (cameraIdleTimerRef.current) clearTimeout(cameraIdleTimerRef.current);
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
