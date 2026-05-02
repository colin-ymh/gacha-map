import { View, TouchableOpacity, Text, ActivityIndicator } from "react-native";
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
  isReady: boolean;
  onCameraChanged: (
    params: Camera & { reason: CameraChangeReason; region: Region },
  ) => void;
  onMarkerPress: (id: string) => void;
  onMyLocation: () => void;
}

const NaverMapScreenView = ({
  mapRef,
  initialCamera,
  markers,
  isReady,
  onCameraChanged,
  onMarkerPress,
  onMyLocation,
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

      {!isReady && (
        <View className="absolute inset-0 items-center justify-center bg-gray-100">
          <ActivityIndicator size="large" color="#6C47FF" />
        </View>
      )}

      <TouchableOpacity
        className="absolute right-3.5 bottom-[70px] w-11 h-11 bg-white rounded-full shadow-md items-center justify-center"
        onPress={onMyLocation}
        accessibilityLabel="내 위치"
      >
        <Text className="text-[22px] text-[#6C47FF]">◎</Text>
      </TouchableOpacity>
    </View>
  );
};

export default NaverMapScreenView;
