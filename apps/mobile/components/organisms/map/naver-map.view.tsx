import { View, Text } from "react-native";
import {
  NaverMapView,
  NaverMapMarkerOverlay,
} from "@mj-studio/react-native-naver-map";
import {
  PRIMARY,
  GRAY_300,
  WHITE,
  BORDER_MARKER,
  TEXT_DARK,
  MAP_LOCATION,
  MAP_LOCATION_CONE,
} from "@/constants/colors";
import type {
  NaverMapViewRef,
  NaverMapViewProps,
  Camera,
} from "@mj-studio/react-native-naver-map";
import type { Ref } from "react";
import type { NaverCameraChangedEvent } from "./naver-map";

type LocationOverlay = NonNullable<NaverMapViewProps["locationOverlay"]>;

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
  locationOverlay: LocationOverlay;
  userLocation: { lat: number; lng: number } | null;
  bearing: number;
  onCameraChanged: (params: NaverCameraChangedEvent) => void;
  onMarkerPress: (id: string) => void;
  onMapPress?: () => void;
}

const NaverMapScreenView = ({
  mapRef,
  initialCamera,
  markers,
  locationOverlay,
  userLocation,
  bearing,
  onCameraChanged,
  onMarkerPress,
  onMapPress,
}: NaverMapScreenViewProps) => {
  return (
    <NaverMapView
      ref={mapRef}
      style={{ flex: 1 }}
      initialCamera={initialCamera}
      locationOverlay={locationOverlay}
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
          width={40}
          height={40}
          anchor={{ x: 0.5, y: 0.5 }}
          zIndex={500}
        >
          <View key={bearing} collapsable={false} style={{ width: 40, height: 40 }}>
            <View
              collapsable={false}
              style={{
                position: "absolute",
                width: 40,
                height: 40,
                alignItems: "center",
                transform: [{ rotate: `${bearing}deg` }],
              }}
            >
              <View
                collapsable={false}
                style={{
                  marginTop: 2,
                  width: 0,
                  height: 0,
                  borderLeftWidth: 6,
                  borderRightWidth: 6,
                  borderBottomWidth: 12,
                  borderStyle: "solid",
                  borderLeftColor: "transparent",
                  borderRightColor: "transparent",
                  borderBottomColor: MAP_LOCATION_CONE,
                }}
              />
            </View>
            <View
              collapsable={false}
              style={{
                position: "absolute",
                top: 12,
                left: 12,
                width: 16,
                height: 16,
                borderRadius: 8,
                backgroundColor: MAP_LOCATION,
                borderWidth: 2,
                borderColor: WHITE,
              }}
            />
          </View>
        </NaverMapMarkerOverlay>
      )}
      {markers.map((marker) => {
        const dotColor = marker.isWished ? PRIMARY : GRAY_300;
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
                backgroundColor: WHITE,
                borderRadius: h / 2,
                borderWidth: 1.5,
                borderColor: marker.isActive ? dotColor : BORDER_MARKER,
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
                  color: TEXT_DARK,
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
