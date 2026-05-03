import { useRef, useCallback } from "react";
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
  onSearchPress?: () => void;
  onReportPress?: () => void;
}

const INITIAL_CAMERA: Camera = {
  latitude: 37.5666,
  longitude: 126.9784,
  zoom: 14,
};

const NaverMap = ({
  shops,
  selectedShopId,
  wishedShopIds = [],
  onShopPress,
  onBoundsChange,
  onSearchPress,
  onReportPress,
}: NaverMapProps) => {
  const mapRef = useRef<NaverMapViewRef>(null);

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
      const { region } = params;
      onBoundsChange?.({
        swLat: region.latitude - region.latitudeDelta / 2,
        swLng: region.longitude - region.longitudeDelta / 2,
        neLat: region.latitude + region.latitudeDelta / 2,
        neLng: region.longitude + region.longitudeDelta / 2,
      });
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

  const handleMyLocation = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return;
    const location = await Location.getCurrentPositionAsync({});
    mapRef.current?.animateCameraTo({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      zoom: 16,
    });
  }, []);

  return (
    <NaverMapScreenView
      mapRef={mapRef}
      initialCamera={INITIAL_CAMERA}
      markers={markers}
      onCameraChanged={handleCameraChanged}
      onMarkerPress={handleMarkerPress}
      onMyLocation={handleMyLocation}
      onSearchPress={onSearchPress}
      onReportPress={onReportPress}
    />
  );
};

export default NaverMap;
