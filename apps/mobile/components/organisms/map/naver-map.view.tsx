import { View, Text } from "react-native";
import {
  NaverMapView,
  NaverMapMarkerOverlay,
} from "@mj-studio/react-native-naver-map";
import type {
  NaverMapViewRef,
  Camera,
} from "@mj-studio/react-native-naver-map";
import type { Ref } from "react";
import type { NaverCameraChangedEvent } from "./naver-map";

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
  userLocation?: { lat: number; lng: number } | null;
  onCameraChanged: (params: NaverCameraChangedEvent) => void;
  onMarkerPress: (id: string) => void;
  onMapPress?: () => void;
}

const NaverMapScreenView = ({
  mapRef,
  initialCamera,
  markers,
  userLocation,
  onCameraChanged,
  onMarkerPress,
  onMapPress,
}: NaverMapScreenViewProps) => {
  return (
    <NaverMapView
      ref={mapRef}
      style={{ flex: 1 }}
      initialCamera={initialCamera}
      onCameraChanged={onCameraChanged}
      onTapMap={onMapPress}
      isShowZoomControls={false}
      isShowCompass={false}
      isShowScaleBar={false}
    >
      {userLocation && (
        <NaverMapMarkerOverlay
          latitude={userLocation.lat}
          longitude={userLocation.lng}
          width={20}
          height={20}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: "#4A90E2",
              borderWidth: 2,
              borderColor: "#FFFFFF",
            }}
          />
        </NaverMapMarkerOverlay>
      )}
      {markers.map((marker) => {
        const dotColor = marker.isWished ? "#E63946" : "#E94B8C";
        const h = marker.isActive ? 32 : 26;
        const dotSize = marker.isActive ? 8 : 6;
        const fontSize = marker.isActive ? 12 : 11;
        const displayName = marker.isActive
          ? marker.name
          : marker.name.length > 5
            ? marker.name.slice(0, 4) + "…"
            : marker.name;
        const charW = marker.isActive ? 12 : 11;
        const overhead = 8 + dotSize + 4 + 8;
        const maxW = marker.isActive ? 150 : 90;
        const w = Math.min(
          maxW,
          Math.max(60, displayName.length * charW + overhead),
        );

        return (
          <NaverMapMarkerOverlay
            key={marker.id}
            latitude={marker.lat}
            longitude={marker.lng}
            onTap={() => onMarkerPress(marker.id)}
            width={w}
            height={h}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View
              key={`${displayName}/${h}/${dotColor}`}
              collapsable={false}
              style={{
                width: w,
                height: h,
                backgroundColor: "#ffffff",
                borderRadius: h / 2,
                borderWidth: 1.5,
                borderColor: marker.isActive ? dotColor : "#e0e0e0",
                flexDirection: "row",
                alignItems: "center",
                paddingLeft: 8,
                paddingRight: 8,
                overflow: "hidden",
              }}
            >
              <View
                collapsable={false}
                style={{
                  width: dotSize,
                  height: dotSize,
                  borderRadius: dotSize / 2,
                  backgroundColor: dotColor,
                  flexShrink: 0,
                }}
              />
              <Text
                numberOfLines={1}
                style={{
                  marginLeft: 4,
                  flex: 1,
                  fontSize,
                  fontWeight: "700",
                  color: "#1a1a1a",
                }}
              >
                {displayName}
              </Text>
            </View>
          </NaverMapMarkerOverlay>
        );
      })}
    </NaverMapView>
  );
};

export default NaverMapScreenView;
