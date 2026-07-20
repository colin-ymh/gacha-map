import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { getAuthHeaders } from "@/lib/supabase";
import { formatOpeningHoursDisplay } from "@gacha-map/shared";
import { SkeletonBone } from "@/components/ui/Skeleton";
import {
  PRIMARY,
  TEXT_DARK,
  TEXT_GRAY,
  GRAY_100,
  GRAY_200,
  WHITE,
  SUCCESS_BG,
  SUCCESS_TEXT,
  WARNING_BG,
  WARNING_TEXT,
} from "@/constants/colors";
import { GlassBackButton } from "@/components/ui/GlassBackButton";
import { LiquidGlass } from "@/components/ui/LiquidGlass";
import { useLiquidGlassPress } from "@/hooks/useLiquidGlassPress";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

interface ShopOwnerShop {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  opening_hours: string | null;
  status: "active" | "hidden";
  is_authorized: boolean;
}

export default function ShopOwnerOverviewScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [shop, setShop] = useState<ShopOwnerShop | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const hasLoadedOnceRef = useRef(false);

  const load = useCallback(async () => {
    // 최초 로드일 때만 스켈레톤을 보여준다. 리뷰 화면 등을 다녀와 재포커스될 때는
    // 백그라운드에서 조용히 갱신해 화면이 매번 리렌더링/깜빡이지 않게 한다.
    if (!hasLoadedOnceRef.current) setIsLoading(true);
    setHasError(false);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/shop-owner/shop`, {
        headers: authHeaders,
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setShop(data.shop);
      hasLoadedOnceRef.current = true;
    } catch {
      if (!hasLoadedOnceRef.current) setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      queueMicrotask(() => load());
    }, [load]),
  );

  const tO = (key: string) => t(`shopOwner.overview.${key}`);

  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: GRAY_100 }}
    >
      <View
        style={[styles.floatRow, { top: insets.top + 8 }]}
        pointerEvents="box-none"
      >
        <GlassBackButton onPress={() => router.back()} />
      </View>

      {isLoading ? (
        <View style={{ flex: 1, padding: 20, paddingTop: 64 }}>
          <SkeletonBone
            width={80}
            height={80}
            borderRadius={40}
            style={{ alignSelf: "center", marginBottom: 12 }}
          />
          <SkeletonBone
            width="45%"
            height={18}
            style={{ alignSelf: "center", marginBottom: 6 }}
          />
          <SkeletonBone
            width="65%"
            height={14}
            style={{ alignSelf: "center", marginBottom: 24 }}
          />
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                paddingVertical: 14,
              }}
            >
              <SkeletonBone width="60%" height={16} />
              <SkeletonBone width={16} height={16} borderRadius={2} />
            </View>
          ))}
        </View>
      ) : hasError || !shop ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            paddingTop: 64,
          }}
        >
          <Text style={{ fontSize: 14, color: TEXT_GRAY, marginBottom: 16 }}>
            {hasError ? tO("loading") : tO("noShop")}
          </Text>
          {hasError && (
            <TouchableOpacity
              onPress={load}
              style={{
                paddingHorizontal: 20,
                paddingVertical: 10,
                borderRadius: 20,
                backgroundColor: PRIMARY,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: "600", color: WHITE }}>
                {tO("retry")}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          <View style={{ padding: 16, paddingTop: 64, gap: 12 }}>
            {/* 샵 정보 카드 */}
            <View
              style={{
                backgroundColor: WHITE,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: GRAY_200,
                padding: 20,
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "700",
                  color: TEXT_DARK,
                  marginBottom: 14,
                }}
              >
                {tO("shopInfo")}
              </Text>

              {[
                { label: tO("name"), value: shop.name },
                {
                  label: tO("address"),
                  value: shop.address ?? tO("noAddress"),
                },
                { label: tO("phone"), value: shop.phone ?? tO("noPhone") },
                {
                  label: tO("openingHours"),
                  value:
                    formatOpeningHoursDisplay(shop.opening_hours) ||
                    tO("noHours"),
                },
              ].map((row, i) => (
                <View
                  key={row.label}
                  style={{
                    flexDirection: "row",
                    paddingVertical: 13,
                    gap: 12,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      color: TEXT_GRAY,
                      width: 80,
                      flexShrink: 0,
                    }}
                  >
                    {row.label}
                  </Text>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "500",
                      color: TEXT_DARK,
                      flex: 1,
                    }}
                  >
                    {row.value}
                  </Text>
                </View>
              ))}

              {/* 샵 상태 */}
              <View
                style={{
                  flexDirection: "row",
                  paddingVertical: 13,
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    color: TEXT_GRAY,
                    width: 80,
                    flexShrink: 0,
                  }}
                >
                  {tO("shopStatus")}
                </Text>
                <View
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 6,
                    borderRadius: 99,
                    backgroundColor:
                      shop.status === "active" ? SUCCESS_BG : WARNING_BG,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "600",
                      color:
                        shop.status === "active" ? SUCCESS_TEXT : WARNING_TEXT,
                    }}
                  >
                    {shop.status === "active"
                      ? tO("statusActive")
                      : tO("statusHidden")}
                  </Text>
                </View>
              </View>
            </View>

            {/* 액션 버튼 */}
            <GlassActionButton
              label={tO("editBtn")}
              variant="primary"
              onPress={() => router.push("/shop-owner/edit" as never)}
            />
            <GlassActionButton
              label={tO("reviewsBtn")}
              onPress={() => router.push("/shop-owner/reviews" as never)}
            />
            <GlassActionButton
              label={tO("viewShopBtn")}
              onPress={() => router.push(`/shop/${shop.id}` as never)}
            />
            <GlassActionButton
              label={tO("gachaBtn")}
              onPress={() => router.push("/shop-owner/gacha" as never)}
            />
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function GlassActionButton({
  label,
  onPress,
  variant = "secondary",
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
}) {
  const { onPressIn, animatedStyle, brightnessValue } = useLiquidGlassPress();
  const isPrimary = variant === "primary";
  return (
    <LiquidGlass
      borderRadius={12}
      style={animatedStyle}
      brightnessOpacity={brightnessValue}
      overlayColor={isPrimary ? "rgba(233,75,140,0.14)" : undefined}
    >
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onPressIn}
        activeOpacity={1}
        style={{ paddingVertical: 15, alignItems: "center" }}
      >
        <Text
          style={{
            fontSize: 15,
            fontWeight: isPrimary ? "700" : "600",
            color: isPrimary ? PRIMARY : TEXT_DARK,
          }}
        >
          {label}
        </Text>
      </TouchableOpacity>
    </LiquidGlass>
  );
}

const styles = StyleSheet.create({
  floatRow: {
    position: "absolute",
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 10,
  },
});
