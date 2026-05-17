import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Animated,
  Image,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
  const [imageError, setImageError] = useState(false);
  const thumbUri =
    !imageError && shop.image_urls.length > 0 ? shop.image_urls[0] : null;

  return (
    <TouchableOpacity
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        paddingHorizontal: 16,
        paddingVertical: 16,
        gap: 12,
      }}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* 썸네일 */}
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 8,
          backgroundColor: "#dedede",
          flexShrink: 0,
          overflow: "hidden",
        }}
      >
        {thumbUri && (
          <Image
            source={{ uri: thumbUri }}
            style={{ width: 64, height: 64 }}
            resizeMode="cover"
            onError={() => setImageError(true)}
          />
        )}
      </View>

      {/* 정보 */}
      <View style={{ flex: 1, gap: 4 }}>
        <Text
          style={{ fontSize: 14, fontWeight: "700", color: "#1a1a1a" }}
          numberOfLines={1}
        >
          {shop.name}
        </Text>
        <Text style={{ fontSize: 11, color: "#888888" }} numberOfLines={1}>
          {shop.address ?? "주소 정보 없음"}
        </Text>
        {shop.tags.length > 0 && (
          <View style={{ flexDirection: "row", gap: 4, marginTop: 2 }}>
            <View
              style={{
                height: 20,
                backgroundColor: "#fce8f4",
                borderRadius: 9999,
                paddingHorizontal: 8,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 11, color: "#e94b8c" }}>
                #{shop.tags[0]}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* 하트 */}
      <TouchableOpacity onPress={onWishToggle} hitSlop={8}>
        <Ionicons
          name={isWished ? "heart" : "heart-outline"}
          size={20}
          color={isWished ? "#e94b8c" : "#888888"}
        />
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
  sheetHeight: number;
  translateY: Animated.Value;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  panHandlers: Record<string, any>;
  isSearchMode?: boolean;
  isSearchLoading?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  hasMore?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

const ShopBottomSheetView = ({
  shops,
  sortType,
  wishedShopIds,
  onSortChange,
  onShopPress,
  onWishToggle,
  sheetHeight,
  translateY,
  panHandlers,
  isSearchMode = false,
  isSearchLoading = false,
  onLoadMore,
  isLoadingMore = false,
  hasMore = false,
  error = null,
  onRetry,
}: ShopBottomSheetViewProps) => {
  const flatListRef = useRef<FlatList<ShopSummary>>(null);
  const prevFirstIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const firstId = shops[0]?.id;
    if (firstId !== prevFirstIdRef.current) {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
    }
    prevFirstIdRef.current = firstId;
  }, [shops]);

  return (
    <Animated.View
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: sheetHeight,
        backgroundColor: "#fff",
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 8,
        transform: [{ translateY }],
      }}
    >
      {/* 드래그 핸들 + 헤더 + 정렬 탭 */}
      <View {...panHandlers}>
        {/* 드래그 핸들 */}
        <View
          style={{ alignItems: "center", paddingTop: 12, paddingBottom: 4 }}
        >
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
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: 12,
          }}
        >
          <Text style={{ fontSize: 17, fontWeight: "700", color: "#1a1a1a" }}>
            {isSearchMode ? "검색 결과" : "주변 가챠샵"}
          </Text>
          <Text style={{ fontSize: 13, color: "#888888", marginLeft: 8 }}>
            {shops.length}곳
          </Text>
        </View>

        {/* 구분선 */}
        <View style={{ height: 1, backgroundColor: "#e5e5e5" }} />

        {/* 정렬 탭 — 검색 모드에서는 숨김 */}
        {!isSearchMode && (
          <View
            style={{
              flexDirection: "row",
              gap: 8,
              paddingHorizontal: 16,
              paddingVertical: 12,
            }}
          >
            {SORT_OPTIONS.map((opt) => {
              const active = sortType === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={{
                    height: 26,
                    borderRadius: 9999,
                    paddingHorizontal: 12,
                    backgroundColor: active ? "#e94b8c" : "#f3f4f6",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  onPress={() => onSortChange(opt.key)}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      color: active ? "#ffffff" : "#9ca3af",
                    }}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* 검색 모드일 때 여백 */}
        {isSearchMode && <View style={{ height: 12 }} />}
      </View>

      {/* 카드 리스트 */}
      {isSearchLoading ? (
        <View style={{ flex: 1, alignItems: "center", paddingTop: 32 }}>
          <ActivityIndicator color="#e94b8c" />
        </View>
      ) : error ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
          }}
        >
          <Text style={{ fontSize: 14, color: "#888888" }}>
            불러오기에 실패했어요
          </Text>
          {onRetry && (
            <TouchableOpacity
              onPress={onRetry}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 20,
                borderRadius: 8,
                backgroundColor: "#e94b8c",
              }}
            >
              <Text
                style={{ fontSize: 13, color: "#ffffff", fontWeight: "600" }}
              >
                다시 시도
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={shops}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ShopCard
              shop={item}
              onPress={() => onShopPress(item)}
              onWishToggle={() => onWishToggle(item.id)}
              isWished={wishedShopIds.includes(item.id)}
            />
          )}
          ItemSeparatorComponent={() => (
            <View
              style={{
                height: 1,
                backgroundColor: "#f3f4f6",
                marginHorizontal: 16,
              }}
            />
          )}
          ListHeaderComponent={
            hasMore && !isLoadingMore ? (
              <TouchableOpacity
                onPress={onLoadMore}
                style={{
                  marginHorizontal: 16,
                  marginTop: 8,
                  marginBottom: 4,
                  paddingVertical: 10,
                  borderRadius: 8,
                  backgroundColor: "#fce8f4",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{ fontSize: 13, color: "#e94b8c", fontWeight: "600" }}
                >
                  더 불러오기
                </Text>
              </TouchableOpacity>
            ) : null
          }
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingVertical: 40 }}>
              <Text style={{ fontSize: 14, color: "#888888" }}>
                {isSearchMode ? "검색 결과가 없어요" : "주변에 가챠샵이 없어요"}
              </Text>
            </View>
          }
          ListFooterComponent={
            isLoadingMore ? (
              <View style={{ paddingVertical: 16 }}>
                <ActivityIndicator color="#e94b8c" />
              </View>
            ) : null
          }
          onEndReached={onLoadMore}
          onEndReachedThreshold={0.3}
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
        />
      )}
    </Animated.View>
  );
};

export default ShopBottomSheetView;
