import { Image, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import GachaPlaceholder from "@/components/ui/GachaPlaceholder";
import { useTranslation } from "react-i18next";
import {
  GRAY_100,
  PRIMARY,
  TEXT_DARK,
  TEXT_GRAY,
} from "@/constants/colors";
import type { RecentItem } from "@/hooks/useRecentHistory";

interface Props {
  items: RecentItem[];
  onQueryPress: (q: string) => void;
  onShopPress: (id: string) => void;
  onGachaPress: (id: string) => void;
  onRemove: (item: RecentItem) => void;
  onClearAll: () => void;
}

export default function SearchHistoryOverlay({
  items,
  onQueryPress,
  onShopPress,
  onGachaPress,
  onRemove,
  onClearAll,
}: Props) {
  const { t } = useTranslation();

  if (items.length === 0) {
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
      {/* 헤더 */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 8,
        }}
      >
        <Text style={{ flex: 1, fontSize: 13, fontWeight: "700", color: TEXT_DARK }}>
          {t("map.recentHistory", { defaultValue: "최근 기록" })}
        </Text>
        <TouchableOpacity onPress={onClearAll} hitSlop={8}>
          <Text style={{ fontSize: 12, color: TEXT_GRAY }}>{t("map.clearAll")}</Text>
        </TouchableOpacity>
      </View>

      {/* 통합 목록 */}
      {items.map((item, idx) => (
        <View key={idx}>
          {item.type === "query" && (
            <TouchableOpacity
              onPress={() => onQueryPress(item.q)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 16,
                paddingVertical: 12,
                gap: 10,
              }}
            >
              <Ionicons name="time-outline" size={16} color={TEXT_GRAY} />
              <Text style={{ flex: 1, fontSize: 14, color: TEXT_DARK }} numberOfLines={1}>
                {item.q}
              </Text>
              <TouchableOpacity onPress={() => onRemove(item)} hitSlop={8}>
                <Ionicons name="close" size={16} color={TEXT_GRAY} />
              </TouchableOpacity>
            </TouchableOpacity>
          )}

          {item.type === "shop" && (
            <TouchableOpacity
              onPress={() => onShopPress(item.id)}
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
                <Text style={{ fontSize: 14, fontWeight: "600", color: TEXT_DARK }} numberOfLines={1}>
                  {item.name}
                </Text>
                {item.address ? (
                  <Text style={{ fontSize: 11, color: TEXT_GRAY, marginTop: 2 }} numberOfLines={1}>
                    {item.address}
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity onPress={() => onRemove(item)} hitSlop={8}>
                <Ionicons name="close" size={16} color={TEXT_GRAY} />
              </TouchableOpacity>
            </TouchableOpacity>
          )}

          {item.type === "gacha" && (
            <TouchableOpacity
              onPress={() => onGachaPress(item.id)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 16,
                paddingVertical: 10,
                gap: 10,
              }}
            >
              {item.imageUrl ? (
                <View style={{ width: 36, height: 36, borderRadius: 6, overflow: "hidden", flexShrink: 0 }}>
                  <Image source={{ uri: item.imageUrl }} style={{ width: 36, height: 36 }} resizeMode="cover" />
                </View>
              ) : (
                <GachaPlaceholder size={36} borderRadius={6} />
              )}
              <Text style={{ flex: 1, fontSize: 14, color: TEXT_DARK }} numberOfLines={1}>
                {item.name}
              </Text>
              <TouchableOpacity onPress={() => onRemove(item)} hitSlop={8}>
                <Ionicons name="close" size={16} color={TEXT_GRAY} />
              </TouchableOpacity>
            </TouchableOpacity>
          )}

          {idx < items.length - 1 && (
            <View style={{ height: 1, backgroundColor: GRAY_100, marginHorizontal: 16 }} />
          )}
        </View>
      ))}

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}
