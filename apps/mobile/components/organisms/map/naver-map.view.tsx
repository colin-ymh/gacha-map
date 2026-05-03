import { View, TouchableOpacity, Text } from "react-native";
import {
  NaverMapView,
  NaverMapMarkerOverlay,
} from "@mj-studio/react-native-naver-map";
import type {
  NaverMapViewRef,
  Camera,
  CameraChangeReason,
  Region,
} from "@mj-studio/react-native-naver-map";
import type { Ref } from "react";

interface MarkerData {
  id: string;
  lat: number;
  lng: number;
  name: string;
  isActive: boolean;
  isWished: boolean;
}

interface NaverMapScreenViewProps {
  mapRef: Ref<NaverMapViewRef>;
  initialCamera: Camera;
  markers: MarkerData[];
  onCameraChanged: (
    params: Camera & { reason: CameraChangeReason; region: Region },
  ) => void;
  onMarkerPress: (id: string) => void;
  onMyLocation: () => void;
  onSearchPress?: () => void;
  onReportPress?: () => void;
}

const NaverMapScreenView = ({
  mapRef,
  initialCamera,
  markers,
  onCameraChanged,
  onMarkerPress,
  onMyLocation,
  onSearchPress,
  onReportPress,
}: NaverMapScreenViewProps) => {
  return (
    <View className="flex-1 bg-white">
      <NaverMapView
        ref={mapRef}
        className="flex-1"
        initialCamera={initialCamera}
        onCameraChanged={onCameraChanged}
      >
        {markers.map((marker) => (
          <NaverMapMarkerOverlay
            key={marker.id}
            latitude={marker.lat}
            longitude={marker.lng}
            onTap={() => onMarkerPress(marker.id)}
            width={marker.isActive ? 24 : 18}
            height={marker.isActive ? 24 : 18}
            anchor={{ x: 0.5, y: 0.5 }}
            caption={marker.isActive ? { text: marker.name } : undefined}
            image={{ symbol: marker.isWished ? "pink" : "red" }}
          />
        ))}
      </NaverMapView>

      {/* 플로팅 검색창 */}
      <TouchableOpacity
        className="absolute top-3 left-3 right-3 h-11 bg-white rounded-[22px] flex-row items-center px-4 gap-2"
        style={{
          shadowColor: "#000",
          shadowOpacity: 0.1,
          shadowRadius: 6,
          elevation: 4,
        }}
        onPress={onSearchPress}
        accessibilityLabel="가챠샵 검색"
        activeOpacity={0.8}
      >
        <Text className="text-base text-[#888888]">🔍</Text>
        <Text className="text-sm text-[#888888]">가챠샵 검색</Text>
      </TouchableOpacity>

      {/* FAB 제보 + 내위치 버튼 */}
      <View className="absolute right-3.5 gap-3" style={{ bottom: 280 }}>
        <TouchableOpacity
          className="w-11 h-11 rounded-full items-center justify-center"
          style={{
            backgroundColor: "#e94b8c",
            shadowColor: "#000",
            shadowOpacity: 0.15,
            shadowRadius: 6,
            elevation: 4,
          }}
          onPress={onReportPress}
          accessibilityLabel="제보"
        >
          <Text className="text-white text-lg font-bold">+</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="w-11 h-11 bg-white rounded-full items-center justify-center"
          style={{
            shadowColor: "#000",
            shadowOpacity: 0.1,
            shadowRadius: 6,
            elevation: 3,
          }}
          onPress={onMyLocation}
          accessibilityLabel="내 위치"
        >
          <Text className="text-[22px] text-brand">◎</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default NaverMapScreenView;
