import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { fetchShopDetail } from "@gacha-map/shared";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { toggleWishAndPersistAsync } from "@/store/slices/wishlist.slice";
import type { ShopDetail } from "@gacha-map/shared";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

export default function ShopDetailScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { id } = useLocalSearchParams<{ id: string }>();
  const wishedShopIds = useAppSelector((s) => s.wishlist.shopIds);
  const isWished = wishedShopIds.includes(id ?? "");

  const [shop, setShop] = useState<ShopDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetchShopDetail(API_BASE, id)
      .then(setShop)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const handleWishToggle = useCallback(() => {
    if (id) dispatch(toggleWishAndPersistAsync(id));
  }, [dispatch, id]);

  const handleReportPress = useCallback(() => {
    router.push("/report" as never);
  }, [router]);

  const handleCopyAddress = useCallback(async () => {
    if (shop?.address) {
      await Clipboard.setStringAsync(shop.address);
      Alert.alert("복사됨", "주소가 클립보드에 복사되었습니다.");
    }
  }, [shop?.address]);

  if (loading) {
    return (
      <SafeAreaView
        className="flex-1 bg-white items-center justify-center"
        edges={["top"]}
      >
        <ActivityIndicator color="#e94b8c" />
      </SafeAreaView>
    );
  }

  if (!shop) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
        <View
          className="flex-row items-center px-4 h-13"
          style={{ borderBottomWidth: 1, borderBottomColor: "#e5e7eb" }}
        >
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Text style={{ fontSize: 24, color: "#1a1a1a" }}>‹</Text>
          </TouchableOpacity>
        </View>
        <View className="flex-1 items-center justify-center">
          <Text style={{ fontSize: 14, color: "#888888" }}>
            샵 정보를 불러올 수 없어요
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      {/* 상단바 */}
      <View
        className="flex-row items-center px-4 h-13"
        style={{ borderBottomWidth: 1, borderBottomColor: "#e5e7eb" }}
      >
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Text style={{ fontSize: 24, color: "#1a1a1a" }}>‹</Text>
        </TouchableOpacity>
        <View className="flex-1" />
        <TouchableOpacity
          onPress={handleWishToggle}
          hitSlop={8}
          style={{ marginRight: 16 }}
        >
          <Ionicons
            name={isWished ? "heart" : "heart-outline"}
            size={22}
            color={isWished ? "#e94b8c" : "#1a1a1a"}
          />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleReportPress} hitSlop={8}>
          <Text style={{ fontSize: 14, color: "#888888" }}>제보하기</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        {/* 대표 이미지 */}
        <View
          style={{ width: "100%", height: 180, backgroundColor: "#dedede" }}
        >
          {shop.image_urls && shop.image_urls.length > 0 ? (
            <Image
              source={{ uri: shop.image_urls[0] }}
              style={{ width: "100%", height: 180 }}
              resizeMode="cover"
            />
          ) : null}
        </View>

        {/* 컨텐츠 영역 */}
        <View
          style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32 }}
        >
          {/* 이름 + 찜 카운트 */}
          <View className="flex-row items-center">
            <Text
              style={{
                fontSize: 22,
                fontWeight: "700",
                color: "#1a1a1a",
                flex: 1,
              }}
              numberOfLines={1}
            >
              {shop.name}
            </Text>
            <Text style={{ fontSize: 13, color: "#e94b8c", marginLeft: 8 }}>
              ♥ {shop.wishlist_count ?? 0}
            </Text>
          </View>

          {/* 공식 인증 배지 */}
          {shop.is_authorized && (
            <View
              style={{
                alignSelf: "flex-start",
                backgroundColor: "#fce8f4",
                borderRadius: 9999,
                paddingHorizontal: 10,
                paddingVertical: 3,
                marginTop: 6,
              }}
            >
              <Text style={{ fontSize: 11, color: "#e94b8c" }}>
                ✓ 공식 인증
              </Text>
            </View>
          )}

          {/* 구분선 */}
          <View
            style={{ height: 1, backgroundColor: "#e5e5e5", marginTop: 16 }}
          />

          {/* 주소 + 복사 버튼 */}
          <View
            className="flex-row items-center"
            style={{ marginTop: 16, gap: 8 }}
          >
            <Text
              style={{
                flex: 1,
                fontSize: 14,
                color: shop.address ? "#1a1a1a" : "#888888",
              }}
            >
              {shop.address || "주소 정보 없음"}
            </Text>
            {shop.address && (
              <TouchableOpacity
                onPress={handleCopyAddress}
                hitSlop={8}
                style={{
                  borderWidth: 1,
                  borderColor: "#e5e5e5",
                  borderRadius: 6,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                }}
              >
                <Text style={{ fontSize: 12, color: "#888888" }}>복사</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* 구분선 */}
          <View
            style={{ height: 1, backgroundColor: "#e5e5e5", marginTop: 16 }}
          />

          {/* 태그 */}
          {shop.tags && shop.tags.length > 0 && (
            <>
              <View
                className="flex-row flex-wrap"
                style={{ gap: 6, marginTop: 16 }}
              >
                {shop.tags.map((tag) => (
                  <View
                    key={tag}
                    style={{
                      height: 24,
                      paddingHorizontal: 10,
                      backgroundColor: "#fce8f4",
                      borderRadius: 9999,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 12, color: "#e94b8c" }}>
                      #{tag}
                    </Text>
                  </View>
                ))}
              </View>

              {/* 구분선 */}
              <View
                style={{ height: 1, backgroundColor: "#e5e5e5", marginTop: 16 }}
              />
            </>
          )}

          {/* 샵 소개 */}
          <View style={{ marginTop: 20 }}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: "#1a1a1a" }}>
              샵 소개
            </Text>
            <Text
              style={{
                marginTop: 8,
                fontSize: 13,
                color: "#888888",
                lineHeight: 20,
              }}
            >
              {shop.description || "소개글이 없습니다."}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
