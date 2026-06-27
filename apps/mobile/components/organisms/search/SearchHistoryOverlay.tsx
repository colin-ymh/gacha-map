import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import {
  GRAY_100,
  PRIMARY,
  TEXT_DARK,
  TEXT_GRAY,
} from "@/constants/colors";
import type { RecentShop } from "@/hooks/useRecentShops";

interface Props {
  history: string[];
  recentShops: RecentShop[];
  onQueryPress: (q: string) => void;
  onRemoveQuery: (q: string) => void;
  onClearAll: () => void;
  onShopPress: (id: string) => void;
}

export default function SearchHistoryOverlay({
  history,
  recentShops,
  onQueryPress,
  onRemoveQuery,
  onClearAll,
  onShopPress,
}: Props) {
  const { t } = useTranslation();
  const hasHistory = history.length > 0;
  const hasShops = recentShops.length > 0;

  if (!hasHistory && !hasShops) {
    return (
      <View style={{ flex: 1, alignItems: "center", paddingTop: 60 }}>
        <Text style={{ fontSize: 14, color: TEXT_GRAY }}>
          {t("map.noRecentData")}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {hasHistory && (
        <View>
          {/* 최근 검색어 헤더 */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 16,
              paddingTop: 16,
              paddingBottom: 8,
            }}
          >
            <Text
              style={{
                flex: 1,
                fontSize: 13,
                fontWeight: "700",
                color: TEXT_DARK,
              }}
            >
              {t("map.recentSearches")}
            </Text>
            <TouchableOpacity onPress={onClearAll} hitSlop={8}>
              <Text style={{ fontSize: 12, color: TEXT_GRAY }}>
                {t("map.clearAll")}
              </Text>
            </TouchableOpacity>
          </View>

          {/* 검색어 목록 */}
          {history.map((q) => (
            <TouchableOpacity
              key={q}
              onPress={() => onQueryPress(q)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 16,
                paddingVertical: 10,
                gap: 10,
              }}
            >
              <Ionicons name="time-outline" size={16} color={TEXT_GRAY} />
              <Text
                style={{ flex: 1, fontSize: 14, color: TEXT_DARK }}
                numberOfLines={1}
              >
                {q}
              </Text>
              <TouchableOpacity onPress={() => onRemoveQuery(q)} hitSlop={8}>
                <Ionicons name="close" size={16} color={TEXT_GRAY} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {hasShops && (
        <View>
          {/* 구분선 */}
          {hasHistory && (
            <View
              style={{ height: 1, backgroundColor: GRAY_100, marginTop: 8 }}
            />
          )}

          {/* 최근 본 샵 헤더 */}
          <View
            style={{
              paddingHorizontal: 16,
              paddingTop: 16,
              paddingBottom: 8,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: "700", color: TEXT_DARK }}>
              {t("map.recentShops")}
            </Text>
          </View>

          {/* 샵 목록 */}
          {recentShops.map((shop, idx) => (
            <View key={shop.id}>
              <TouchableOpacity
                onPress={() => onShopPress(shop.id)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  gap: 10,
                }}
              >
                <Ionicons name="storefront-outline" size={16} color={PRIMARY} />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "600",
                      color: TEXT_DARK,
                    }}
                    numberOfLines={1}
                  >
                    {shop.name}
                  </Text>
                  {shop.address ? (
                    <Text
                      style={{ fontSize: 11, color: TEXT_GRAY, marginTop: 2 }}
                      numberOfLines={1}
                    >
                      {shop.address}
                    </Text>
                  ) : null}
                </View>
              </TouchableOpacity>
              {idx < recentShops.length - 1 && (
                <View
                  style={{
                    height: 1,
                    backgroundColor: GRAY_100,
                    marginHorizontal: 16,
                  }}
                />
              )}
            </View>
          ))}
        </View>
      )}

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}
