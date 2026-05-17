import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ShopSummary } from "@gacha-map/shared";

interface SearchViewProps {
  shops: ShopSummary[];
  isLoggedIn: boolean;
  isLoading?: boolean;
  onRemoveWish: (shopId: string) => void;
  onLoginPress?: () => void;
}

function WishCard({
  shop,
  onRemoveWish,
}: {
  shop: ShopSummary;
  onRemoveWish: () => void;
}) {
  const [imageError, setImageError] = useState(false);
  const thumbUri =
    !imageError && shop.image_urls.length > 0 ? shop.image_urls[0] : null;

  return (
    <View
      style={{
        flexDirection: "row",
        paddingHorizontal: 16,
        paddingVertical: 14,
        gap: 12,
      }}
    >
      {/* Thumbnail */}
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

      {/* Info */}
      <View style={{ flex: 1, justifyContent: "space-between" }}>
        <Text
          numberOfLines={1}
          style={{ fontSize: 14, fontWeight: "700", color: "#1a1a1a" }}
        >
          {shop.name}
        </Text>
        <Text
          numberOfLines={1}
          style={{ fontSize: 11, color: "#888888", marginTop: 2 }}
        >
          {shop.address ?? "주소 정보 없음"}
        </Text>
        {shop.tags && shop.tags.length > 0 && (
          <View style={{ marginTop: 6, flexDirection: "row", gap: 6 }}>
            <View
              style={{
                height: 20,
                paddingHorizontal: 8,
                borderRadius: 9999,
                backgroundColor: "#fce8f4",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 10, color: "#e94b8c" }}>
                #{shop.tags[0]}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Heart */}
      <TouchableOpacity
        style={{
          alignItems: "center",
          justifyContent: "center",
          paddingRight: 4,
        }}
        onPress={onRemoveWish}
        hitSlop={8}
      >
        <Ionicons name="heart" size={20} color="#e94b8c" />
      </TouchableOpacity>
    </View>
  );
}

export default function SearchView({
  shops,
  isLoggedIn,
  isLoading = false,
  onRemoveWish,
  onLoginPress,
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
            borderBottomColor: "#e5e7eb",
          }}
        >
          <Text style={{ fontSize: 17, fontWeight: "700", color: "#1a1a1a" }}>
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
            color="#e5e5e5"
            style={{ marginBottom: 16 }}
          />
          <Text
            style={{
              fontSize: 14,
              color: "#888888",
              textAlign: "center",
              marginBottom: 20,
              lineHeight: 22,
            }}
          >
            {"로그인하면 찜 목록을\n사용할 수 있어요"}
          </Text>
          <TouchableOpacity
            style={{
              backgroundColor: "#e94b8c",
              borderRadius: 10,
              paddingVertical: 10,
              paddingHorizontal: 28,
            }}
            onPress={onLoginPress}
          >
            <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>
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
          borderBottomColor: "#e5e7eb",
        }}
      >
        <Text style={{ fontSize: 17, fontWeight: "700", color: "#1a1a1a" }}>
          내 찜 목록
        </Text>
      </View>

      {isLoading ? (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator color="#e94b8c" />
        </View>
      ) : isEmpty ? (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ fontSize: 14, color: "#888888" }}>
            찜한 샵이 없어요
          </Text>
        </View>
      ) : (
        <>
          <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
            <Text style={{ fontSize: 13, color: "#888888" }}>
              찜한 샵 {shops.length}개
            </Text>
          </View>
          <View style={{ height: 1, backgroundColor: "#e5e5e5" }} />
          <ScrollView style={{ flex: 1 }}>
            {shops.map((shop, index) => (
              <View key={shop.id}>
                <WishCard
                  shop={shop}
                  onRemoveWish={() => onRemoveWish(shop.id)}
                />
                {index < shops.length - 1 && (
                  <View
                    style={{
                      height: 1,
                      backgroundColor: "#f3f4f6",
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
