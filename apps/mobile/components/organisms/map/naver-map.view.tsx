import { View } from "react-native";

const PIN_WISHED = require("@/assets/images/pin-wished.png");
const PIN_DEFAULT = require("@/assets/images/pin-default.png");
import {
  NaverMapView,
  NaverMapMarkerOverlay,
} from "@mj-studio/react-native-naver-map";
import {
  WHITE,
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
          <View
            key={bearing}
            collapsable={false}
            style={{ width: 40, height: 40 }}
          >
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
        const pinSize = marker.isActive ? 60 : 50;

        return (
          <NaverMapMarkerOverlay
            key={marker.id}
            latitude={marker.lat}
            longitude={marker.lng}
            onTap={() => onMarkerPress(marker.id)}
            width={pinSize}
            height={pinSize}
            anchor={{ x: 0.5, y: 0.75 }}
            image={marker.isWished ? PIN_WISHED : PIN_DEFAULT}
            caption={
              marker.isActive
                ? {
                    text: marker.name,
                    textSize: 12,
                    color: TEXT_DARK,
                    haloColor: WHITE,
                    align: "Top",
                    offset: 4,
                  }
                : undefined
            }
          />
        );
      })}
    </NaverMapView>
  );
};

export default NaverMapScreenView;
