import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ShopSummary } from "@gacha-map/shared";
import {
  PRIMARY,
  PRIMARY_BG,
  TEXT_DARK,
  TEXT_GRAY,
  GRAY_100,
  GRAY_200,
  BORDER,
  WHITE,
} from "@/constants/colors";

interface SearchViewProps {
  shops: ShopSummary[];
  wishedShopIds: string[];
  isLoggedIn: boolean;
  isLoading?: boolean;
  onWishToggle: (shopId: string) => void;
  onShopPress: (shopId: string) => void;
  onLoginPress?: () => void;
  onRefresh?: () => void;
}

function WishCard({
  shop,
  isWished,
  onWishToggle,
  onPress,
}: {
  shop: ShopSummary;
  isWished: boolean;
  onWishToggle: () => void;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      style={{
        flexDirection: "row",
        paddingHorizontal: 16,
        paddingVertical: 14,
        gap: 12,
      }}
    >
      {/* Info */}
      <View style={{ flex: 1, justifyContent: "space-between" }}>
        <Text
          numberOfLines={1}
          style={{ fontSize: 14, fontWeight: "700", color: TEXT_DARK }}
        >
          {shop.name}
        </Text>
        <Text
          numberOfLines={1}
          style={{ fontSize: 11, color: TEXT_GRAY, marginTop: 2 }}
        >
          {shop.address ?? "주소 정보 없음"}
        </Text>
      </View>

      {/* Heart */}
      <View
        style={{
          alignItems: "center",
          justifyContent: "center",
          paddingRight: 4,
          minWidth: 28,
        }}
      >
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            onWishToggle();
          }}
          hitSlop={8}
        >
          <Ionicons
            name={isWished ? "heart" : "heart-outline"}
            size={20}
            color={isWished ? PRIMARY : TEXT_GRAY}
          />
        </TouchableOpacity>
        <Text
          style={{
            fontSize: 10,
            color: isWished ? PRIMARY : TEXT_GRAY,
            marginTop: 2,
          }}
        >
          {shop.wishlist_count ?? 0}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function SearchView({
  shops,
  wishedShopIds,
  isLoggedIn,
  isLoading = false,
  onWishToggle,
  onShopPress,
  onLoginPress,
  onRefresh,
}: SearchViewProps) {
  if (!isLoggedIn) {
    return (
      <View style={{ flex: 1 }}>
        <View
          style={{
            height: 52,
            alignItems: "center",
            justifyContent: "center",
            borderBottomWidth: 1,
            borderBottomColor: GRAY_200,
          }}
        >
          <Text style={{ fontSize: 17, fontWeight: "700", color: TEXT_DARK }}>
            내 찜 목록
          </Text>
        </View>
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 32,
          }}
        >
          <Ionicons
            name="heart-outline"
            size={48}
            color={BORDER}
            style={{ marginBottom: 16 }}
          />
          <Text
            style={{
              fontSize: 14,
              color: TEXT_GRAY,
              textAlign: "center",
              marginBottom: 20,
              lineHeight: 22,
            }}
          >
            {"로그인하면 찜 목록을\n사용할 수 있어요"}
          </Text>
          <TouchableOpacity
            style={{
              backgroundColor: PRIMARY,
              borderRadius: 10,
              paddingVertical: 10,
              paddingHorizontal: 28,
            }}
            onPress={onLoginPress}
          >
            <Text style={{ color: WHITE, fontSize: 14, fontWeight: "700" }}>
              로그인하기
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isEmpty = shops.length === 0;

  return (
    <View style={{ flex: 1 }}>
      {/* Header */}
      <View
        style={{
          height: 52,
          alignItems: "center",
          justifyContent: "center",
          borderBottomWidth: 1,
          borderBottomColor: GRAY_200,
        }}
      >
        <Text style={{ fontSize: 17, fontWeight: "700", color: TEXT_DARK }}>
          내 찜 목록
        </Text>
      </View>

      {isLoading ? (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator color={PRIMARY} />
        </View>
      ) : isEmpty ? (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ fontSize: 14, color: TEXT_GRAY }}>
            찜한 샵이 없어요
          </Text>
        </View>
      ) : (
        <>
          <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
            <Text style={{ fontSize: 13, color: TEXT_GRAY }}>
              찜한 샵 {shops.length}개
            </Text>
          </View>
          <View style={{ height: 1, backgroundColor: BORDER }} />
          <ScrollView
            style={{ flex: 1 }}
            refreshControl={
              <RefreshControl
                refreshing={isLoading}
                onRefresh={onRefresh}
                tintColor={PRIMARY}
              />
            }
          >
            {shops.map((shop, index) => (
              <View key={shop.id}>
                <WishCard
                  shop={shop}
                  isWished={wishedShopIds.includes(shop.id)}
                  onWishToggle={() => onWishToggle(shop.id)}
                  onPress={() => onShopPress(shop.id)}
                />
                {index < shops.length - 1 && (
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
          </ScrollView>
        </>
      )}
    </View>
  );
}
