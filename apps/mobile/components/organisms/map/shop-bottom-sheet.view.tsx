import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Pressable,
  Animated,
  Image,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ShopSummary } from "@gacha-map/shared";
import { WishHeartButtonSmall } from "@/components/ui/WishHeartButton";
import {
  PRIMARY,
  PRIMARY_BG,
  TEXT_DARK,
  TEXT_GRAY,
  WHITE,
  BLACK,
  GRAY_100,
  GRAY_400,
  BORDER,
  THUMBNAIL_PLACEHOLDER,
  RIPPLE_COLOR,
} from "@/constants/colors";

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
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        paddingHorizontal: 16,
        paddingVertical: 16,
        gap: 12,
      }}
    >
      {/* 카드 본문 (썸네일 + 정보) */}
      <Pressable
        style={{
          flex: 1,
          flexDirection: "row",
          gap: 12,
          alignItems: "flex-start",
        }}
        onPress={onPress}
        android_ripple={{ color: RIPPLE_COLOR }}
      >
        {/* 썸네일 */}
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 8,
            backgroundColor: THUMBNAIL_PLACEHOLDER,
            flexShrink: 0,
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {thumbUri ? (
            <Image
              source={{ uri: thumbUri }}
              style={{ width: 64, height: 64 }}
              resizeMode="cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <Ionicons name="storefront-outline" size={28} color={GRAY_400} />
          )}
        </View>

        {/* 정보 */}
        <View style={{ flex: 1, gap: 4 }}>
          <Text
            style={{ fontSize: 14, fontWeight: "700", color: TEXT_DARK }}
            numberOfLines={1}
          >
            {shop.name}
          </Text>
          <Text style={{ fontSize: 11, color: TEXT_GRAY }} numberOfLines={1}>
            {shop.address ?? "주소 정보 없음"}
          </Text>
          {shop.tags.length > 0 && (
            <View style={{ flexDirection: "row", gap: 4, marginTop: 2 }}>
              <View
                style={{
                  height: 20,
                  backgroundColor: PRIMARY_BG,
                  borderRadius: 9999,
                  paddingHorizontal: 8,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 11, color: PRIMARY }}>
                  #{shop.tags[0]}
                </Text>
              </View>
            </View>
          )}
        </View>
      </Pressable>

      {/* 하트 — 카드 본문과 형제 구조로 분리하여 이벤트 충돌 방지 */}
      <View style={{ alignItems: "center", alignSelf: "center", minWidth: 28 }}>
        <WishHeartButtonSmall isWished={isWished} onPress={onWishToggle} />
        <Text style={{ fontSize: 10, color: PRIMARY, marginTop: 2 }}>
          {shop.wishlist_count ?? 0}
        </Text>
      </View>
    </View>
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
        backgroundColor: WHITE,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        shadowColor: BLACK,
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
              backgroundColor: BORDER,
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
          <Text style={{ fontSize: 17, fontWeight: "700", color: TEXT_DARK }}>
            {isSearchMode ? "검색 결과" : "주변 가챠샵"}
          </Text>
          <Text style={{ fontSize: 13, color: TEXT_GRAY, marginLeft: 8 }}>
            {shops.length}곳
          </Text>
        </View>

        {/* 구분선 */}
        <View style={{ height: 1, backgroundColor: BORDER }} />

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
                    backgroundColor: active ? PRIMARY : GRAY_100,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  onPress={() => onSortChange(opt.key)}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      color: active ? WHITE : GRAY_400,
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
          <ActivityIndicator color={PRIMARY} />
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
          <Text style={{ fontSize: 14, color: TEXT_GRAY }}>
            불러오기에 실패했어요
          </Text>
          {onRetry && (
            <TouchableOpacity
              onPress={onRetry}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 20,
                borderRadius: 8,
                backgroundColor: PRIMARY,
              }}
            >
              <Text style={{ fontSize: 13, color: WHITE, fontWeight: "600" }}>
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
                backgroundColor: GRAY_100,
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
                  backgroundColor: PRIMARY_BG,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{ fontSize: 13, color: PRIMARY, fontWeight: "600" }}
                >
                  더 불러오기
                </Text>
              </TouchableOpacity>
            ) : null
          }
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingVertical: 40 }}>
              <Text style={{ fontSize: 14, color: TEXT_GRAY }}>
                {isSearchMode ? "검색 결과가 없어요" : "주변에 가챠샵이 없어요"}
              </Text>
            </View>
          }
          ListFooterComponent={
            isLoadingMore ? (
              <View style={{ paddingVertical: 16 }}>
                <ActivityIndicator color={PRIMARY} />
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
