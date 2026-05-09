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
import type { ShopSummary, Bounds } from "@gacha-map/shared";
import NaverMapScreenView from "./naver-map.view";

interface NaverMapProps {
  shops: ShopSummary[];
  selectedShopId?: string;
  wishedShopIds?: string[];
  onShopPress?: (shop: ShopSummary) => void;
  onBoundsChange?: (bounds: Bounds) => void;
  onMapInteraction?: () => void;
  onUserLocation?: (loc: { lat: number; lng: number }) => void;
  mapLatOffset?: number;
}

export interface NaverMapHandle {
  goToMyLocation: () => Promise<void>;
  centerOnShop: (lat: number, lng: number) => void;
}

const INITIAL_CAMERA: Camera = {
  latitude: 37.5666,
  longitude: 126.9784,
  zoom: 14,
};

const INITIAL_BOUNDS: Bounds = {
  swLat: INITIAL_CAMERA.latitude - 0.04,
  swLng: INITIAL_CAMERA.longitude - 0.06,
  neLat: INITIAL_CAMERA.latitude + 0.04,
  neLng: INITIAL_CAMERA.longitude + 0.06,
};

const BOUNDS_EPS = 0.0005;
// centerOnShop animation(300ms) + bounds debounce(600ms) + buffer(200ms)
const SUPPRESS_DURATION_MS = 1100;

const NaverMap = forwardRef<NaverMapHandle, NaverMapProps>(function NaverMap(
  {
    shops,
    selectedShopId,
    wishedShopIds = [],
    onShopPress,
    onBoundsChange,
    onMapInteraction,
    onUserLocation,
    mapLatOffset = 0,
  },
  ref,
) {
  const mapRef = useRef<NaverMapViewRef>(null);
  const initializedRef = useRef(false);
  const boundsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastBoundsRef = useRef<Bounds | null>(null);
  const isProgrammaticMoveRef = useRef(false);
  const currentZoomRef = useRef<number>(14);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

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
    (params: Camera & { reason: CameraChangeReason; region: Region }) => {
      currentZoomRef.current = params.zoom ?? currentZoomRef.current;

      if (params.reason === "Gesture") {
        // 사용자 제스처 → 즉시 suppressTimer 해제 및 programmatic 플래그 리셋
        if (suppressTimerRef.current) {
          clearTimeout(suppressTimerRef.current);
          suppressTimerRef.current = null;
        }
        isProgrammaticMoveRef.current = false;
        onMapInteraction?.();
      }

      if (boundsTimerRef.current) clearTimeout(boundsTimerRef.current);
      const { region } = params;

      boundsTimerRef.current = setTimeout(() => {
        // programmatic 이동 중이면 bounds 변경 이벤트 억제
        if (isProgrammaticMoveRef.current) return;

        const newBounds: Bounds = {
          swLat: region.latitude - region.latitudeDelta / 2,
          swLng: region.longitude - region.longitudeDelta / 2,
          neLat: region.latitude + region.latitudeDelta / 2,
          neLng: region.longitude + region.longitudeDelta / 2,
        };

        const prev = lastBoundsRef.current;
        if (
          prev &&
          Math.abs(prev.swLat - newBounds.swLat) < BOUNDS_EPS &&
          Math.abs(prev.swLng - newBounds.swLng) < BOUNDS_EPS &&
          Math.abs(prev.neLat - newBounds.neLat) < BOUNDS_EPS &&
          Math.abs(prev.neLng - newBounds.neLng) < BOUNDS_EPS
        ) {
          return;
        }

        lastBoundsRef.current = newBounds;
        onBoundsChange?.(newBounds);
      }, 600);
    },
    [onBoundsChange, onMapInteraction],
  );

  const handleMarkerPress = useCallback(
    (id: string) => {
      const shop = shops.find((s) => s.id === id);
      if (shop) onShopPress?.(shop);
    },
    [shops, onShopPress],
  );

  const goToMyLocation = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return;
    const location = await Location.getCurrentPositionAsync({});
    const { latitude, longitude } = location.coords;
    setUserLocation({ lat: latitude, lng: longitude });
    onUserLocation?.({ lat: latitude, lng: longitude });
    mapRef.current?.animateCameraTo({
      latitude,
      longitude,
      zoom: 16,
    });
  }, [onUserLocation]);

  const centerOnShop = useCallback(
    (lat: number, lng: number) => {
      isProgrammaticMoveRef.current = true;

      if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
      suppressTimerRef.current = setTimeout(() => {
        isProgrammaticMoveRef.current = false;
        suppressTimerRef.current = null;
      }, SUPPRESS_DURATION_MS);

      mapRef.current?.animateCameraTo({
        latitude: lat - mapLatOffset,
        longitude: lng,
        zoom: Math.max(14, currentZoomRef.current),
        duration: 300,
      });
    },
    [mapLatOffset],
  );

  useImperativeHandle(ref, () => ({ goToMyLocation, centerOnShop }), [
    goToMyLocation,
    centerOnShop,
  ]);

  useEffect(() => {
    if (!initializedRef.current && onBoundsChange) {
      initializedRef.current = true;
      onBoundsChange(INITIAL_BOUNDS);
    }
  }, [onBoundsChange]);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;
      setUserLocation({ lat: latitude, lng: longitude });
      onUserLocation?.({ lat: latitude, lng: longitude });
      mapRef.current?.animateCameraTo({
        latitude,
        longitude,
        zoom: 14,
      });
    })();
    // onUserLocation은 의도적으로 deps 제외 — 초기화 effect는 마운트 시 1회만 실행
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (boundsTimerRef.current) clearTimeout(boundsTimerRef.current);
      if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
    };
  }, []);

  return (
    <NaverMapScreenView
      mapRef={mapRef}
      initialCamera={INITIAL_CAMERA}
      markers={markers}
      userLocation={userLocation}
      onCameraChanged={handleCameraChanged}
      onMarkerPress={handleMarkerPress}
      onMapPress={onMapInteraction}
    />
  );
});

export default NaverMap;
