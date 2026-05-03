import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import type { ShopSummary } from "@gacha-map/shared";

export type SortType = "latest" | "name" | "distance" | "wish";

const SORT_OPTIONS: { key: SortType; label: string }[] = [
  { key: "latest", label: "최신순" },
  { key: "name", label: "이름순" },
  { key: "distance", label: "거리순" },
  { key: "wish", label: "찜많은순" },
];

interface ShopCardProps {
  shop: ShopSummary;
  onPress: () => void;
  onWishToggle: () => void;
  isWished: boolean;
}

function ShopCard({ shop, onPress, onWishToggle, isWished }: ShopCardProps) {
  return (
    <TouchableOpacity
      className="flex-row items-start px-4 py-4 gap-3"
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* 썸네일 */}
      <View
        className="rounded-lg flex-shrink-0"
        style={{ width: 64, height: 64, backgroundColor: "#dedede" }}
      />

      {/* 정보 */}
      <View className="flex-1 gap-1">
        <Text
          className="text-[14px] font-bold"
          style={{ color: "#1a1a1a" }}
          numberOfLines={1}
        >
          {shop.name}
        </Text>
        <Text
          className="text-[11px]"
          style={{ color: "#888888" }}
          numberOfLines={1}
        >
          {shop.address ?? "주소 정보 없음"}
        </Text>
        {shop.tags.length > 0 && (
          <View className="flex-row gap-1 mt-0.5">
            <View
              className="items-center justify-center px-2"
              style={{
                height: 20,
                backgroundColor: "#fde8ea",
                borderRadius: 9999,
              }}
            >
              <Text className="text-[11px]" style={{ color: "#e63946" }}>
                {shop.tags[0]}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* 하트 */}
      <TouchableOpacity onPress={onWishToggle} hitSlop={8}>
        <Text
          className="text-[18px]"
          style={{ color: isWished ? "#e94b8c" : "#888888" }}
        >
          {isWished ? "♥" : "♡"}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

interface ShopBottomSheetViewProps {
  shops: ShopSummary[];
  sortType: SortType;
  wishedShopIds: string[];
  onSortChange: (sort: SortType) => void;
  onShopPress: (shop: ShopSummary) => void;
  onWishToggle: (shopId: string) => void;
}

const ShopBottomSheetView = ({
  shops,
  sortType,
  wishedShopIds,
  onSortChange,
  onShopPress,
  onWishToggle,
}: ShopBottomSheetViewProps) => {
  return (
    <View
      className="absolute bottom-0 left-0 right-0 bg-white"
      style={{
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: "60%",
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 8,
      }}
    >
      {/* 드래그 핸들 */}
      <View className="items-center pt-3 pb-1">
        <View
          style={{
            width: 50,
            height: 5,
            backgroundColor: "#e5e5e5",
            borderRadius: 3,
          }}
        />
      </View>

      {/* 시트 헤더 */}
      <View className="flex-row items-center px-5 pt-2 pb-3">
        <Text
          className="text-[17px] font-bold"
          style={{ color: "#1a1a1a" }}
        >
          주변 가챠샵
        </Text>
        <Text className="text-[13px] ml-2" style={{ color: "#888888" }}>
          {shops.length}곳
        </Text>
      </View>

      {/* 구분선 */}
      <View style={{ height: 1, backgroundColor: "#e5e5e5" }} />

      {/* 정렬 탭 */}
      <View className="flex-row gap-2 px-4 py-3">
        {SORT_OPTIONS.map((opt) => {
          const active = sortType === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              className="items-center justify-center px-3"
              style={{
                height: 26,
                borderRadius: 9999,
                backgroundColor: active ? "#e63946" : "#f3f4f6",
              }}
              onPress={() => onSortChange(opt.key)}
            >
              <Text
                className="text-[12px]"
                style={{ color: active ? "#ffffff" : "#9ca3af" }}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 카드 리스트 */}
      <ScrollView showsVerticalScrollIndicator={false}>
        {shops.map((shop, index) => (
          <View key={shop.id}>
            {index > 0 && (
              <View
                className="mx-4"
                style={{ height: 1, backgroundColor: "#f3f4f6" }}
              />
            )}
            <ShopCard
              shop={shop}
              onPress={() => onShopPress(shop)}
              onWishToggle={() => onWishToggle(shop.id)}
              isWished={wishedShopIds.includes(shop.id)}
            />
          </View>
        ))}
        {shops.length === 0 && (
          <View className="items-center py-10">
            <Text className="text-[14px]" style={{ color: "#888888" }}>
              주변에 가챠샵이 없어요
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

export default ShopBottomSheetView;
