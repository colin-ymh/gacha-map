import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { getAuthHeaders } from "@/lib/supabase";
import {
  parseBusinessHours,
  formatBusinessHoursDisplay,
} from "@gacha-map/shared";
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

  const [shop, setShop] = useState<ShopOwnerShop | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/shop-owner/shop`, {
        headers: authHeaders,
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setShop(data.shop);
    } catch {
      setHasError(true);
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
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: WHITE }}>
      {/* 헤더 */}
      <View
        style={{
          height: 52,
          flexDirection: "row",
          alignItems: "center",
          borderBottomWidth: 1,
          borderBottomColor: GRAY_200,
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
          <Text style={{ fontSize: 24, color: TEXT_DARK }}>‹</Text>
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
          {tO("title")}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator color={PRIMARY} />
        </View>
      ) : hasError || !shop ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
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
                재시도
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          <View style={{ padding: 16, gap: 12 }}>
            {/* 샵 정보 카드 */}
            <View
              style={{
                backgroundColor: WHITE,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: GRAY_200,
                padding: 16,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "700",
                  color: TEXT_DARK,
                  marginBottom: 12,
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
                    formatBusinessHoursDisplay(
                      parseBusinessHours(shop.opening_hours),
                    ) || tO("noHours"),
                },
              ].map((row, i) => (
                <View
                  key={row.label}
                  style={{
                    flexDirection: "row",
                    paddingVertical: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: GRAY_100,
                    gap: 12,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      color: TEXT_GRAY,
                      width: 72,
                      flexShrink: 0,
                    }}
                  >
                    {row.label}
                  </Text>
                  <Text
                    style={{ fontSize: 13, color: TEXT_DARK, flex: 1 }}
                    numberOfLines={2}
                  >
                    {row.value}
                  </Text>
                </View>
              ))}

              {/* 샵 상태 */}
              <View
                style={{
                  flexDirection: "row",
                  paddingVertical: 10,
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    color: TEXT_GRAY,
                    width: 72,
                    flexShrink: 0,
                  }}
                >
                  {tO("shopStatus")}
                </Text>
                <View
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 4,
                    borderRadius: 99,
                    backgroundColor:
                      shop.status === "active" ? SUCCESS_BG : WARNING_BG,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
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
            <TouchableOpacity
              onPress={() => router.push("/shop-owner/edit" as never)}
              style={{
                backgroundColor: PRIMARY,
                borderRadius: 10,
                paddingVertical: 14,
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: "700", color: WHITE }}>
                {tO("editBtn")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push("/shop-owner/reviews" as never)}
              style={{
                backgroundColor: WHITE,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: GRAY_200,
                paddingVertical: 14,
                alignItems: "center",
              }}
            >
              <Text
                style={{ fontSize: 15, fontWeight: "600", color: TEXT_DARK }}
              >
                {tO("reviewsBtn")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push(`/shop/${shop.id}` as never)}
              style={{
                backgroundColor: WHITE,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: GRAY_200,
                paddingVertical: 14,
                alignItems: "center",
              }}
            >
              <Text
                style={{ fontSize: 15, fontWeight: "600", color: TEXT_DARK }}
              >
                {tO("viewShopBtn")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push("/shop-owner/gacha" as never)}
              style={{
                backgroundColor: WHITE,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: GRAY_200,
                paddingVertical: 14,
                alignItems: "center",
              }}
            >
              <Text
                style={{ fontSize: 15, fontWeight: "600", color: TEXT_DARK }}
              >
                {tO("gachaBtn")}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
