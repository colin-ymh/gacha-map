import { useRef, useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Animated,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { NaverMapView } from "@mj-studio/react-native-naver-map";
import type {
  NaverMapViewRef,
  Camera,
  CameraChangeReason,
} from "@mj-studio/react-native-naver-map";
import { useTranslation } from "react-i18next";
import { GlassBackButton } from "@/components/ui/GlassBackButton";
import { GlassSubmitButton } from "@/components/ui/GlassSubmitButton";
import { LiquidGlass } from "@/components/ui/LiquidGlass";
import { useLiquidGlassPress } from "@/hooks/useLiquidGlassPress";
import { Ionicons } from "@expo/vector-icons";
import { PRIMARY, TEXT_DARK, TEXT_GRAY, WHITE } from "@/constants/colors";
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
  const insets = useSafeAreaInsets();
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

  const handleGoToMyLocation = useCallback(async () => {
    const loc = await getCurrentPositionSafe();
    if (!loc.ok || !loc.coords) return;
    const { latitude, longitude } = loc.coords;
    latRef.current = latitude;
    lngRef.current = longitude;
    mapRef.current?.animateCameraTo({ latitude, longitude, zoom: 15 });
    fetchAddress(latitude, longitude);
  }, [fetchAddress]);

  const handleSelect = useCallback(() => {
    setLocationPickerResult({
      lat: latRef.current,
      lng: lngRef.current,
      address,
    });
    router.back();
  }, [address, router]);

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      {/* 플로팅 버튼 */}
      <View
        style={[styles.floatRow, { top: insets.top + 8 }]}
        pointerEvents="box-none"
      >
        <GlassBackButton onPress={() => router.back()} />
        <GlassSubmitButton
          onPress={handleSelect}
          accessibilityLabel={t("report.selectThisLocation")}
        />
      </View>

      {/* 지도 + 오버레이 */}
      <View style={{ flex: 1 }}>
        <NaverMapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          initialCamera={INITIAL_CAMERA}
          onCameraChanged={handleCameraChanged}
          isShowZoomControls={false}
          isShowCompass={false}
          isShowScaleBar={false}
        />

        {/* 크로스헤어 */}
        <View pointerEvents="none" style={styles.crosshair}>
          <View style={styles.crossV} />
          <View style={styles.crossH} />
          <View style={styles.crossDot} />
        </View>

        {/* 하단 LiquidGlass 패널 */}
        <View
          style={[styles.bottomPanel, { paddingBottom: insets.bottom + 12 }]}
          pointerEvents="box-none"
        >
          {/* 내 위치 FAB */}
          <LocationFAB onPress={handleGoToMyLocation} />

          {/* 주소 카드 */}
          <LiquidGlass borderRadius={28}>
            <View style={styles.addressCard}>
              {loadingAddress ? (
                <View style={styles.addressLoading}>
                  <ActivityIndicator size="small" color={PRIMARY} />
                  <Text style={styles.addressLoadingText}>
                    {t("report.loadingAddress")}
                  </Text>
                </View>
              ) : (
                <Text
                  style={[
                    styles.addressText,
                    { color: address ? TEXT_DARK : TEXT_GRAY },
                  ]}
                  numberOfLines={2}
                >
                  {address ?? t("report.unknownAddress")}
                </Text>
              )}
            </View>
          </LiquidGlass>
        </View>
      </View>
    </SafeAreaView>
  );
}

function LocationFAB({ onPress }: { onPress: () => void }) {
  const { onPressIn, animatedStyle, brightnessValue } = useLiquidGlassPress();
  return (
    <LiquidGlass
      borderRadius={28}
      style={[animatedStyle, { alignSelf: "flex-end" }]}
      brightnessOpacity={brightnessValue}
    >
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onPressIn}
        activeOpacity={1}
        style={{
          width: 56,
          height: 56,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="locate" size={28} color={TEXT_DARK} />
      </TouchableOpacity>
    </LiquidGlass>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  floatRow: {
    position: "absolute",
    left: 12,
    right: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 10,
  },
  crosshair: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  crossV: {
    position: "absolute",
    width: 2,
    height: 28,
    backgroundColor: PRIMARY,
    borderRadius: 1,
  },
  crossH: {
    position: "absolute",
    width: 28,
    height: 2,
    backgroundColor: PRIMARY,
    borderRadius: 1,
  },
  crossDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: WHITE,
    borderWidth: 2,
    borderColor: PRIMARY,
  },
  bottomPanel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
  },
  addressCard: {
    paddingHorizontal: 16,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  addressLoading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  addressLoadingText: {
    fontSize: 13,
    color: TEXT_GRAY,
  },
  addressText: {
    fontSize: 16,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 22,
  },
});
