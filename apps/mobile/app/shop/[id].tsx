import { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { fetchShopDetail } from "@gacha-map/shared";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { toggleWish } from "@/store/slices/wishlist.slice";
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
    if (id) dispatch(toggleWish(id));
  }, [dispatch, id]);

  const handleReportPress = useCallback(() => {
    router.push("/report" as never);
  }, [router]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center" edges={["top"]}>
        <ActivityIndicator color="#e63946" />
      </SafeAreaView>
    );
  }

  if (!shop) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
        <View className="flex-row items-center px-4 h-13" style={{ borderBottomWidth: 1, borderBottomColor: "#e5e7eb" }}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Text style={{ fontSize: 24, color: "#1a1a1a" }}>‹</Text>
          </TouchableOpacity>
        </View>
        <View className="flex-1 items-center justify-center">
          <Text style={{ fontSize: 14, color: "#888888" }}>샵 정보를 불러올 수 없어요</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        {/* 상단바 */}
        <View
          className="flex-row items-center px-4 h-13"
          style={{ borderBottomWidth: 1, borderBottomColor: "#e5e7eb" }}
        >
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Text style={{ fontSize: 24, color: "#1a1a1a" }}>‹</Text>
          </TouchableOpacity>
          <View className="flex-1" />
        </View>

        {/* 대표 이미지 */}
        <View style={{ width: "100%", height: 220, backgroundColor: "#dedede" }}>
          {shop.image_urls && shop.image_urls.length > 0 ? (
            <Image
              source={{ uri: shop.image_urls[0] }}
              style={{ width: "100%", height: 220 }}
              resizeMode="cover"
            />
          ) : null}
        </View>

        {/* 컨텐츠 영역 */}
        <View className="px-5 pt-5 pb-24">
          <Text style={{ fontSize: 22, fontWeight: "700", color: "#1a1a1a" }}>
            {shop.name}
          </Text>

          {shop.is_authorized && (
            <View
              className="mt-1.5 px-2.5 rounded-full"
              style={{ alignSelf: "flex-start", backgroundColor: "#eff6ff", paddingVertical: 3 }}
            >
              <Text style={{ fontSize: 11, color: "#1d4ed8" }}>✓ 공식 인증</Text>
            </View>
          )}

          <Text style={{ marginTop: 12, fontSize: 14, color: shop.address ? "#1a1a1a" : "#888888" }}>
            {shop.address || "주소 정보 없음"}
          </Text>

          {shop.tags && shop.tags.length > 0 && (
            <View className="flex-row flex-wrap gap-1.5 mt-3">
              {shop.tags.map((tag) => (
                <View
                  key={tag}
                  className="px-2.5 items-center justify-center"
                  style={{ height: 24, backgroundColor: "#fde8ea", borderRadius: 9999 }}
                >
                  <Text style={{ fontSize: 12, color: "#e63946" }}>{tag}</Text>
                </View>
              ))}
            </View>
          )}

          <View className="mt-5" style={{ height: 1, backgroundColor: "#e5e5e5" }} />

          <View className="mt-5">
            <Text style={{ fontSize: 15, fontWeight: "700", color: "#1a1a1a" }}>샵 소개</Text>
            <Text style={{ marginTop: 8, fontSize: 13, color: "#888888", lineHeight: 20 }}>
              {shop.description || "소개글이 없습니다."}
            </Text>
          </View>

          <Text style={{ marginTop: 20, fontSize: 13, color: "#ff4b6e" }}>
            ♥ {shop.wishlist_count ?? 0}명이 찜했어요
          </Text>
        </View>
      </ScrollView>

      {/* 하단 고정 바 */}
      <View
        className="absolute bottom-0 left-0 right-0 flex-row px-4 gap-3"
        style={{
          height: 72,
          backgroundColor: "white",
          borderTopWidth: 1,
          borderTopColor: "#e5e5e5",
          alignItems: "center",
        }}
      >
        <TouchableOpacity
          className="flex-1 items-center justify-center rounded-full"
          style={{ height: 48, borderWidth: 1, borderColor: "#e5e5e5" }}
          onPress={handleWishToggle}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 15, color: isWished ? "#e94b8c" : "#1a1a1a" }}>
            {isWished ? "♥ 찜완료" : "♡ 찜하기"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="flex-[2] items-center justify-center rounded-full"
          style={{ height: 48, backgroundColor: "#4b5563" }}
          onPress={handleReportPress}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 15, fontWeight: "600", color: "white" }}>제보하기</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
