import { useRef, useState, useCallback, useEffect } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { NaverMapView } from "@mj-studio/react-native-naver-map";
import type {
  NaverMapViewRef,
  Camera,
  CameraChangeReason,
} from "@mj-studio/react-native-naver-map";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import {
  PRIMARY,
  TEXT_DARK,
  TEXT_GRAY,
  WHITE,
} from "@/constants/colors";
import { setLocationPickerResult } from "@/lib/locationPickerResult";
import { getCurrentPositionSafe } from "@/lib/location";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

const INITIAL_CAMERA: Camera = {
  latitude: 37.5666,
  longitude: 126.9784,
  zoom: 14,
};

export default function ReportLocationPickerScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const mapRef = useRef<NaverMapViewRef>(null);

  const latRef = useRef(INITIAL_CAMERA.latitude);
  const lngRef = useRef(INITIAL_CAMERA.longitude);
  const [address, setAddress] = useState<string | null>(null);
  const [loadingAddress, setLoadingAddress] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchAddress = useCallback(async (lat: number, lng: number) => {
    if (!API_BASE) return;
    setLoadingAddress(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/geocode/reverse?lat=${lat}&lng=${lng}`,
      );
      if (res.ok) {
        const data = (await res.json()) as { address: string | null };
        setAddress(data.address);
      } else {
        setAddress(null);
      }
    } catch {
      setAddress(null);
    } finally {
      setLoadingAddress(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const loc = await getCurrentPositionSafe();
      if (!loc.ok || !loc.coords) {
        fetchAddress(INITIAL_CAMERA.latitude, INITIAL_CAMERA.longitude);
        return;
      }
      const { latitude, longitude } = loc.coords;
      latRef.current = latitude;
      lngRef.current = longitude;
      mapRef.current?.animateCameraTo({ latitude, longitude, zoom: 15 });
      fetchAddress(latitude, longitude);
    })();
  }, [fetchAddress]);

  const handleCameraChanged = useCallback(
    (params: Camera & { reason?: CameraChangeReason }) => {
      const { latitude, longitude, reason } = params;
      latRef.current = latitude;
      lngRef.current = longitude;

      if (reason === "Developer" || reason === "Location") return;

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        fetchAddress(latitude, longitude);
      }, 400);
    },
    [fetchAddress],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleSelect = useCallback(() => {
    setLocationPickerResult({
      lat: latRef.current,
      lng: lngRef.current,
      address,
    });
    router.back();
  }, [address, router]);

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: WHITE }}>
      <View
        style={{
          height: 52,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            paddingHorizontal: 16,
            height: "100%",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="chevron-back" size={24} color={TEXT_DARK} />
        </TouchableOpacity>
        <Text
          style={{
            flex: 1,
            textAlign: "center",
            fontSize: 16,
            fontWeight: "700",
            color: TEXT_DARK,
          }}
        >
          {t("report.locationLabel")}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={{ flex: 1 }}>
        <NaverMapView
          ref={mapRef}
          style={{ flex: 1 }}
          initialCamera={INITIAL_CAMERA}
          onCameraChanged={handleCameraChanged}
          isShowZoomControls={false}
          isShowCompass={false}
          isShowScaleBar={false}
        />

        {/* Crosshair overlay */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View
            style={{
              position: "absolute",
              width: 2,
              height: 28,
              backgroundColor: PRIMARY,
              borderRadius: 1,
            }}
          />
          <View
            style={{
              position: "absolute",
              width: 28,
              height: 2,
              backgroundColor: PRIMARY,
              borderRadius: 1,
            }}
          />
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: WHITE,
              borderWidth: 2,
              borderColor: PRIMARY,
            }}
          />
        </View>
      </View>

      <SafeAreaView edges={["bottom"]} style={{ backgroundColor: WHITE }}>
        <View
          style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}
        >
          <View
            style={{
              minHeight: 36,
              justifyContent: "center",
              marginBottom: 12,
            }}
          >
            {loadingAddress ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ActivityIndicator size="small" color={PRIMARY} />
                <Text style={{ marginLeft: 8, fontSize: 13, color: TEXT_GRAY }}>
                  {t("report.loadingAddress")}
                </Text>
              </View>
            ) : (
              <Text
                style={{
                  fontSize: 13,
                  color: address ? TEXT_DARK : TEXT_GRAY,
                  textAlign: "center",
                }}
                numberOfLines={2}
              >
                {address ?? t("report.unknownAddress")}
              </Text>
            )}
          </View>
          <TouchableOpacity
            onPress={handleSelect}
            style={{
              height: 48,
              borderRadius: 24,
              backgroundColor: PRIMARY,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "600", color: WHITE }}>
              {t("report.selectThisLocation")}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </SafeAreaView>
  );
}
