import { Image, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import GachaPlaceholder from "@/components/ui/GachaPlaceholder";
import { useTranslation } from "react-i18next";
import { PressableScale } from "@/components/ui/PressableScale";
import { GRAY_100, TEXT_DARK, TEXT_GRAY } from "@/constants/colors";
import type { RecentItem } from "@/hooks/useRecentHistory";

interface Props {
  items: RecentItem[];
  onQueryPress: (q: string) => void;
  onShopPress: (id: string) => void;
  onGachaPress: (id: string) => void;
  onRemove: (item: RecentItem) => void;
  onClearAll: () => void;
  bottomPadding?: number;
  /**
   * 기록 아래에 이어 붙일 내용. 가챠 탭의 둘러보기 섹션이 여기로 들어온다.
   * 스크롤을 중첩시키지 않으려고 별도 컨테이너 대신 이 ScrollView 안에서 렌더한다.
   */
  footer?: React.ReactNode;
}

export default function SearchHistoryOverlay({
  items,
  onQueryPress,
  onShopPress,
  onGachaPress,
  onRemove,
  onClearAll,
  bottomPadding = 0,
  footer,
}: Props) {
  const { t } = useTranslation();

  if (items.length === 0) {
    // footer 가 없으면 기존 그대로 안내 문구만 띄운다.
    if (!footer) {
      return (
        <View style={{ flex: 1, alignItems: "center", paddingTop: 60 }}>
          <Text style={{ fontSize: 14, color: TEXT_GRAY }}>
            {t("map.noRecentData")}
          </Text>
        </View>
      );
    }

    // 기록이 없으면 안내 문구를 빼고 footer 가 화면을 채우게 둔다.
    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: bottomPadding }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {footer}
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: bottomPadding }}
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
        <Text
          style={{ flex: 1, fontSize: 13, fontWeight: "700", color: TEXT_DARK }}
        >
          {t("map.recentHistory", { defaultValue: "최근 기록" })}
        </Text>
        <PressableScale onPress={onClearAll} hitSlop={8}>
          <Text style={{ fontSize: 12, color: TEXT_GRAY }}>
            {t("map.clearAll")}
          </Text>
        </PressableScale>
      </View>

      {/* 통합 목록 */}
      {items.map((item, idx) => (
        <View key={idx}>
          {item.type === "query" && (
            <PressableScale
              onPress={() => onQueryPress(item.q)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                height: 64,
                paddingHorizontal: 16,
                gap: 12,
              }}
            >
              <Ionicons name="time-outline" size={18} color={TEXT_GRAY} />
              <Text
                style={{ flex: 1, fontSize: 15, color: TEXT_DARK }}
                numberOfLines={1}
              >
                {item.q}
              </Text>
              <PressableScale onPress={() => onRemove(item)} hitSlop={8}>
                <Ionicons name="close" size={18} color={TEXT_GRAY} />
              </PressableScale>
            </PressableScale>
          )}

          {item.type === "shop" && (
            <PressableScale
              onPress={() => onShopPress(item.id)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                height: 64,
                paddingHorizontal: 16,
                gap: 12,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{ fontSize: 15, fontWeight: "600", color: TEXT_DARK }}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
                {item.address ? (
                  <Text
                    style={{ fontSize: 12, color: TEXT_GRAY, marginTop: 3 }}
                    numberOfLines={1}
                  >
                    {item.address}
                  </Text>
                ) : null}
              </View>
              <PressableScale onPress={() => onRemove(item)} hitSlop={8}>
                <Ionicons name="close" size={18} color={TEXT_GRAY} />
              </PressableScale>
            </PressableScale>
          )}

          {item.type === "gacha" && (
            <PressableScale
              onPress={() => onGachaPress(item.id)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                height: 64,
                paddingHorizontal: 16,
                gap: 12,
              }}
            >
              {item.imageUrl ? (
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 8,
                    overflow: "hidden",
                    flexShrink: 0,
                  }}
                >
                  <Image
                    source={{ uri: item.imageUrl }}
                    style={{ width: 44, height: 44 }}
                    resizeMode="cover"
                  />
                </View>
              ) : (
                <GachaPlaceholder size={44} borderRadius={8} />
              )}
              <Text
                style={{ flex: 1, fontSize: 15, color: TEXT_DARK }}
                numberOfLines={1}
              >
                {item.name}
              </Text>
              <PressableScale onPress={() => onRemove(item)} hitSlop={8}>
                <Ionicons name="close" size={18} color={TEXT_GRAY} />
              </PressableScale>
            </PressableScale>
          )}

          {idx < items.length - 1 && (
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

      {footer}

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}
