import {
  View,
  Text,
  TextInput,
  FlatList,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PressableScale } from "@/components/ui/PressableScale";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { GlassBackButton } from "@/components/ui/GlassBackButton";
import { LiquidGlass } from "@/components/ui/LiquidGlass";
import { SkeletonBone } from "@/components/ui/Skeleton";
import GachaItemThumb from "@/components/molecules/GachaItemThumb";
import SearchHistoryOverlay from "./SearchHistoryOverlay";
import {
  WHITE,
  GRAY_100,
  GRAY_200,
  TEXT_DARK,
  TEXT_GRAY,
  PRIMARY,
} from "@/constants/colors";
import type {
  ShopSummary,
  GachaProductWithShops,
  GachaBrowseCategory,
  GachaBrowseSeries,
} from "@gacha-map/shared";
import type { RecentItem } from "@/hooks/useRecentHistory";
import { GachaBrowseSections } from "@/components/organisms/search/GachaBrowseSections";

type TabType = "shop" | "gacha";

interface Props {
  visible: boolean;
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  inputText: string;
  onSearchChange: (text: string) => void;
  onSearchClear: () => void;
  onSubmit: (q: string) => void;
  onClose: () => void;
  shopSearchStatus: string;
  searchShops: ShopSummary[];
  wishedShopIds: string[];
  onShopPress: (id: string) => void;
  onShopWishToggle: (id: string) => void;
  onViewOnMap?: () => void;
  gachaLoading: boolean;
  gachaLoadingMore?: boolean;
  gachaResults: GachaProductWithShops[];
  onGachaEndReached?: () => void;
  wishedProductIds: string[];
  onGachaPress: (id: string) => void;
  onGachaWishToggle: (id: string) => void;
  recentItems: RecentItem[];
  onRecentQueryPress: (q: string) => void;
  onRemoveRecent: (item: RecentItem) => void;
  onClearRecent: () => void;
  // 둘러보기(가챠 탭 빈 상태). 핸들러를 안 넘기면 칩만 보이고 아무 동작도 하지 않는다.
  onBrowseCategoryPress?: (category: GachaBrowseCategory) => void;
  onBrowseSeriesPress?: (series: GachaBrowseSeries) => void;
  onBrowseMoreSeries?: () => void;
  onBrowseMoreCategories?: (type: "product_type" | "subject" | "genre") => void;
}

interface SearchInputRowProps {
  activeTab: TabType;
  inputText: string;
  onSearchChange: (text: string) => void;
  onSearchClear: () => void;
  onSubmit: (q: string) => void;
  placeholder: string;
}

function SearchInputRow({
  inputText,
  onSearchChange,
  onSearchClear,
  onSubmit,
  placeholder,
}: SearchInputRowProps) {
  return (
    <>
      <Ionicons name="search" size={16} color={TEXT_GRAY} />
      <TextInput
        style={{ flex: 1, fontSize: 14, color: TEXT_DARK, paddingVertical: 0 }}
        placeholder={placeholder}
        placeholderTextColor={TEXT_GRAY}
        value={inputText}
        onChangeText={onSearchChange}
        returnKeyType="search"
        autoFocus
        onSubmitEditing={() => {
          const q = inputText.trim();
          if (q) onSubmit(q);
        }}
      />
      {inputText.length > 0 && (
        <PressableScale onPress={onSearchClear}>
          <Ionicons name="close-circle" size={16} color={TEXT_GRAY} />
        </PressableScale>
      )}
    </>
  );
}

export default function SearchOverlay({
  visible,
  activeTab,
  onTabChange,
  inputText,
  onSearchChange,
  onSearchClear,
  onSubmit,
  onClose,
  shopSearchStatus,
  searchShops,
  wishedShopIds,
  onShopPress,
  onShopWishToggle,
  onViewOnMap,
  gachaLoading,
  gachaLoadingMore = false,
  gachaResults,
  onGachaEndReached,
  wishedProductIds,
  onGachaPress,
  onGachaWishToggle,
  recentItems,
  onRecentQueryPress,
  onRemoveRecent,
  onClearRecent,
  onBrowseCategoryPress,
  onBrowseSeriesPress,
  onBrowseMoreSeries,
  onBrowseMoreCategories,
}: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const TAB_BAR_HEIGHT = 68; // 56 row + 12 marginBottom (GlassTabBar)
  const listBottomPadding = insets.bottom + TAB_BAR_HEIGHT;

  if (!visible) return null;

  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: WHITE,
        zIndex: 50,
      }}
    >
      {/* 헤더 */}
      <View
        style={{
          paddingTop: insets.top,
          paddingHorizontal: 16,
          paddingBottom: 12,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          height: insets.top + 56,
        }}
      >
        <GlassBackButton onPress={onClose} />
        {/* 검색 입력창 — iOS: LiquidGlass, Android: 단순 컨테이너(BlurView flex 버그 우회) */}
        {Platform.OS === "ios" ? (
          <LiquidGlass
            borderRadius={20}
            fill
            style={{ flex: 1, height: 40 }}
            overlayColor="rgba(0,0,0,0.04)"
          >
            <View
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 14,
                gap: 8,
              }}
            >
              <SearchInputRow
                activeTab={activeTab}
                inputText={inputText}
                onSearchChange={onSearchChange}
                onSearchClear={onSearchClear}
                onSubmit={onSubmit}
                placeholder={
                  activeTab === "shop"
                    ? t("map.searchShopPlaceholder")
                    : t("map.searchGachaPlaceholder")
                }
              />
            </View>
          </LiquidGlass>
        ) : (
          <View
            style={{
              flex: 1,
              height: 40,
              borderRadius: 20,
              backgroundColor: GRAY_100,
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 14,
              gap: 8,
            }}
          >
            <SearchInputRow
              activeTab={activeTab}
              inputText={inputText}
              onSearchChange={onSearchChange}
              onSearchClear={onSearchClear}
              onSubmit={onSubmit}
              placeholder={
                activeTab === "shop"
                  ? t("map.searchShopPlaceholder")
                  : t("map.searchGachaPlaceholder")
              }
            />
          </View>
        )}
      </View>

      {/* 탭 */}
      <View
        style={{
          flexDirection: "row",
          borderBottomWidth: 1,
          borderBottomColor: GRAY_200,
        }}
      >
        {(["shop", "gacha"] as TabType[]).map((tab) => {
          const isActive = activeTab === tab;
          return (
            <PressableScale
              key={tab}
              onPress={() => onTabChange(tab)}
              style={{
                flex: 1,
                alignItems: "center",
                paddingVertical: 12,
                borderBottomWidth: 2,
                borderBottomColor: isActive ? PRIMARY : "transparent",
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: isActive ? "700" : "400",
                  color: isActive ? PRIMARY : TEXT_GRAY,
                }}
              >
                {tab === "shop" ? t("map.tabShop") : t("map.tabGacha")}
              </Text>
            </PressableScale>
          );
        })}
      </View>

      {/* 결과 카운트 */}
      {inputText.trim().length > 0 &&
        (activeTab === "shop"
          ? shopSearchStatus !== "loading" && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                }}
              >
                <Text style={{ flex: 1, fontSize: 13, color: TEXT_GRAY }}>
                  {t("map.shopSearchCount", { count: searchShops.length })}
                </Text>
                {searchShops.length > 0 && onViewOnMap && (
                  <PressableScale
                    onPress={onViewOnMap}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Ionicons name="map-outline" size={14} color={PRIMARY} />
                    <Text
                      style={{
                        fontSize: 13,
                        color: PRIMARY,
                        fontWeight: "600",
                      }}
                    >
                      {t("map.viewOnMap")}
                    </Text>
                  </PressableScale>
                )}
              </View>
            )
          : !gachaLoading && (
              <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
                <Text style={{ fontSize: 13, color: TEXT_GRAY }}>
                  {t("map.gachaSearchCount", { count: gachaResults.length })}
                </Text>
              </View>
            ))}

      {/* 결과 목록 */}
      {inputText.trim() === "" ? (
        <SearchHistoryOverlay
          items={recentItems}
          onQueryPress={onRecentQueryPress}
          onShopPress={onShopPress}
          onGachaPress={onGachaPress}
          onRemove={onRemoveRecent}
          onClearAll={onClearRecent}
          bottomPadding={listBottomPadding}
          // 둘러보기는 가챠 탭에서만 붙인다. 샵 탭 빈 상태는 그대로 둔다. 기획서 §3-1.
          footer={
            activeTab === "gacha" ? (
              <GachaBrowseSections
                enabled
                onCategoryPress={(c) => onBrowseCategoryPress?.(c)}
                onSeriesPress={(s) => onBrowseSeriesPress?.(s)}
                onMoreSeries={() => onBrowseMoreSeries?.()}
                onMoreCategories={(type) => onBrowseMoreCategories?.(type)}
              />
            ) : undefined
          }
        />
      ) : activeTab === "shop" ? (
        shopSearchStatus === "loading" ? (
          <View style={{ flex: 1, padding: 16 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <View
                key={i}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 14,
                  gap: 12,
                }}
              >
                <View style={{ flex: 1, gap: 4 }}>
                  <SkeletonBone width="55%" height={14} />
                  <SkeletonBone width="40%" height={11} />
                </View>
                <SkeletonBone width={22} height={22} borderRadius={11} />
              </View>
            ))}
          </View>
        ) : (
          <FlatList
            data={searchShops}
            keyboardShouldPersistTaps="handled"
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  gap: 12,
                }}
              >
                <PressableScale
                  style={{ flex: 1 }}
                  onPress={() => onShopPress(item.id)}
                >
                  <View style={{ gap: 4 }}>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "700",
                        color: TEXT_DARK,
                      }}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    <Text
                      style={{ fontSize: 11, color: TEXT_GRAY }}
                      numberOfLines={1}
                    >
                      {item.address ?? t("map.noAddress")}
                    </Text>
                  </View>
                </PressableScale>
                <PressableScale
                  onPress={() => onShopWishToggle(item.id)}
                  style={{ padding: 4 }}
                >
                  <Ionicons
                    name={
                      wishedShopIds.includes(item.id)
                        ? "heart"
                        : "heart-outline"
                    }
                    size={22}
                    color={PRIMARY}
                  />
                </PressableScale>
              </View>
            )}
            ItemSeparatorComponent={() => (
              <View
                style={{
                  height: 1,
                  backgroundColor: GRAY_100,
                  marginHorizontal: 16,
                }}
              />
            )}
            ListEmptyComponent={
              <View style={{ alignItems: "center", paddingVertical: 60 }}>
                <Text style={{ fontSize: 14, color: TEXT_GRAY }}>
                  {t("map.searchEmpty")}
                </Text>
              </View>
            }
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: listBottomPadding }}
          />
        )
      ) : gachaLoading ? (
        <View style={{ flex: 1, padding: 16 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View
              key={i}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 12,
                gap: 12,
              }}
            >
              <SkeletonBone
                width={56}
                height={56}
                borderRadius={8}
                style={{ flexShrink: 0 } as any}
              />
              <View style={{ flex: 1, gap: 6 }}>
                <SkeletonBone width="60%" height={14} />
                <SkeletonBone width="40%" height={12} />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={gachaResults}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 16,
                paddingVertical: 12,
                gap: 12,
              }}
            >
              <PressableScale
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                }}
                onPress={() => onGachaPress(item.id)}
              >
                <GachaItemThumb url={item.official_image_url} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "700",
                      color: TEXT_DARK,
                    }}
                    numberOfLines={1}
                  >
                    {item.name_ko ?? item.name}
                  </Text>
                  <Text
                    style={{ fontSize: 11, color: TEXT_GRAY }}
                    numberOfLines={1}
                  >
                    {item.manufacturer}
                    {item.available_shop_count > 0
                      ? ` · ${t("map.shopAvail", { count: item.available_shop_count })}`
                      : ""}
                  </Text>
                </View>
              </PressableScale>
              <PressableScale
                onPress={() => onGachaWishToggle(item.id)}
                style={{ padding: 4 }}
              >
                <Ionicons
                  name={
                    wishedProductIds.includes(item.id)
                      ? "heart"
                      : "heart-outline"
                  }
                  size={22}
                  color={PRIMARY}
                />
              </PressableScale>
            </View>
          )}
          ItemSeparatorComponent={() => (
            <View
              style={{
                height: 1,
                backgroundColor: GRAY_100,
                marginHorizontal: 16,
              }}
            />
          )}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingVertical: 60 }}>
              <Text style={{ fontSize: 14, color: TEXT_GRAY }}>
                {t("map.searchEmpty")}
              </Text>
            </View>
          }
          ListFooterComponent={
            gachaLoadingMore ? (
              <View style={{ paddingVertical: 16, alignItems: "center" }}>
                <ActivityIndicator size="small" color={PRIMARY} />
              </View>
            ) : null
          }
          onEndReached={onGachaEndReached}
          onEndReachedThreshold={0.4}
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: listBottomPadding }}
        />
      )}
    </View>
  );
}
