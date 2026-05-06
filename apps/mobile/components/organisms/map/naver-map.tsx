import {
  useRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  forwardRef,
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
}

export interface NaverMapHandle {
  goToMyLocation: () => Promise<void>;
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

// 바운드 변화 최소 기준 (이보다 작으면 동일 위치로 간주)
const BOUNDS_EPS = 0.0005;

const NaverMap = forwardRef<NaverMapHandle, NaverMapProps>(function NaverMap(
  { shops, selectedShopId, wishedShopIds = [], onShopPress, onBoundsChange },
  ref,
) {
  const mapRef = useRef<NaverMapViewRef>(null);
  const initializedRef = useRef(false);
  const boundsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastBoundsRef = useRef<Bounds | null>(null);

  const markers = shops.map((shop) => ({
    id: shop.id,
    lat: shop.lat,
    lng: shop.lng,
    name: shop.name,
    isActive: shop.id === selectedShopId,
    isWished: wishedShopIds.includes(shop.id),
  }));

  const handleCameraChanged = useCallback(
    (params: Camera & { reason: CameraChangeReason; region: Region }) => {
      if (boundsTimerRef.current) clearTimeout(boundsTimerRef.current);
      const { region } = params;

      boundsTimerRef.current = setTimeout(() => {
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
    [onBoundsChange],
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
    mapRef.current?.animateCameraTo({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      zoom: 16,
    });
  }, []);

  useImperativeHandle(ref, () => ({ goToMyLocation }), [goToMyLocation]);

  useEffect(() => {
    if (!initializedRef.current && onBoundsChange) {
      initializedRef.current = true;
      onBoundsChange(INITIAL_BOUNDS);
    }
  }, [onBoundsChange]);

  useEffect(() => {
    return () => {
      if (boundsTimerRef.current) clearTimeout(boundsTimerRef.current);
    };
  }, []);

  return (
    <NaverMapScreenView
      mapRef={mapRef}
      initialCamera={INITIAL_CAMERA}
      markers={markers}
      onCameraChanged={handleCameraChanged}
      onMarkerPress={handleMarkerPress}
    />
  );
});

export default NaverMap;
