import { View } from "react-native";
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
}

const NaverMapScreenView = ({
  mapRef,
  initialCamera,
  markers,
  onCameraChanged,
  onMarkerPress,
}: NaverMapScreenViewProps) => {
  return (
    <NaverMapView
      ref={mapRef}
      style={{ flex: 1 }}
      initialCamera={initialCamera}
      onCameraChanged={onCameraChanged}
      isShowZoomControls={false}
      isShowCompass={false}
      isShowScaleBar={false}
    >
      {markers.map((marker) => {
        const size = marker.isActive ? 24 : 18;
        const color = marker.isWished ? "#E63946" : "#E94B8C";
        return (
          <NaverMapMarkerOverlay
            key={marker.id}
            latitude={marker.lat}
            longitude={marker.lng}
            onTap={() => onMarkerPress(marker.id)}
            width={size}
            height={size}
            anchor={{ x: 0.5, y: 0.5 }}
            caption={
              marker.isActive
                ? {
                    text: marker.name,
                    textSize: 11,
                    color: "#1A1A1A",
                    haloColor: "#FFFFFF",
                  }
                : undefined
            }
          >
            <View
              style={{
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: color,
                borderWidth: 2,
                borderColor: "#FFFFFF",
                shadowColor: "#000",
                shadowOpacity: 0.25,
                shadowRadius: 4,
                shadowOffset: { width: 0, height: 2 },
                elevation: 4,
              }}
            />
          </NaverMapMarkerOverlay>
        );
      })}
    </NaverMapView>
  );
};

export default NaverMapScreenView;
