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
  const markerJustPressedRef = useRef(false);
  const markerPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
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
    (params: NaverCameraChangedEvent) => {
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
      if (isUserGesture && !markerJustPressedRef.current) {
        onMapInteraction?.();
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
    mapRef.current?.animateCameraTo({
      latitude: lat,
      longitude: lng,
      zoom: 16,
      duration: 300,
    });
  }, []);

  const getCurrentBounds = useCallback(
    (): Bounds | null => currentBoundsRef.current,
    [],
  );

  useImperativeHandle(
    ref,
    () => ({ goToMyLocation, centerOnShop, getCurrentBounds }),
    [goToMyLocation, centerOnShop, getCurrentBounds],
  );

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

  return (
    <NaverMapScreenView
      mapRef={mapRef}
      initialCamera={INITIAL_CAMERA}
      markers={markers}
      userLocation={userLocation}
      onCameraChanged={handleCameraChanged}
      onMarkerPress={handleMarkerPress}
    />
  );
});

export default NaverMap;
