import { useState, useEffect, useCallback, useRef } from "react";
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
import { useAppSelector } from "@/store/hooks";
import LoginModal from "@/components/ui/LoginModal";
import { WishHeartButton } from "@/components/ui/WishHeartButton";
import { useWishDebounce } from "@/hooks/useWishDebounce";
import ReviewSection from "@/components/organisms/review/ReviewSection";
import type { ShopDetail } from "@gacha-map/shared";
import type { Review } from "@/types/review";
import {
  PRIMARY,
  PRIMARY_BG,
  TEXT_DARK,
  TEXT_GRAY,
  GRAY_200,
  BORDER,
  THUMBNAIL_PLACEHOLDER,
} from "@/constants/colors";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

export default function ShopDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const wishedShopIds = useAppSelector((s) => s.wishlist.shopIds);
  const isWished = wishedShopIds.includes(id ?? "");
  const { handleWishToggle: wishDebounce } = useWishDebounce();
  const isLoggedIn = useAppSelector((s) => s.auth.isLoggedIn);
  const currentUserId = useAppSelector((s) => s.auth.user?.id ?? null);

  const [shop, setShop] = useState<ShopDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchShopDetail(API_BASE, id)
      .then(setShop)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const previousWishedRef = useRef(isWished);
  useEffect(() => {
    const wasWished = previousWishedRef.current;
    if (wasWished !== isWished) {
      setShop((prev) => {
        if (!prev) return prev;
        const currentCount = prev.wishlist_count ?? 0;
        return {
          ...prev,
          wishlist_count: isWished
            ? currentCount + 1
            : Math.max(0, currentCount - 1),
        };
      });
    }
    previousWishedRef.current = isWished;
  }, [isWished]);

  const handleWishToggle = useCallback(() => {
    if (!id) return;
    wishDebounce(id, () => setShowLoginModal(true));
  }, [id, wishDebounce]);

  const handleReportPress = useCallback(() => {
    const name = encodeURIComponent(shop?.name ?? "");
    router.push(`/report?shopId=${id}&shopName=${name}` as never);
  }, [router, id, shop?.name]);

  const handleCopyAddress = useCallback(async () => {
    if (shop?.address) {
      await Clipboard.setStringAsync(shop.address);
      Alert.alert("복사됨", "주소가 클립보드에 복사되었습니다.");
    }
  }, [shop?.address]);

  const handleWriteReview = useCallback(() => {
    if (!isLoggedIn) {
      setShowLoginModal(true);
      return;
    }
    router.push(`/review-form?shopId=${id}` as never);
  }, [isLoggedIn, id, router]);

  const handleGalleryPress = useCallback(() => {
    router.push(`/review-images?shopId=${id}` as never);
  }, [id, router]);

  const handleEditReview = useCallback(
    (review: Review) => {
      const params = new URLSearchParams({
        shopId: id ?? "",
        reviewId: review.id,
        initialContent: review.content ?? "",
        initialImageUrls: JSON.stringify(review.image_urls),
      });
      router.push(`/review-form?${params.toString()}` as never);
    },
    [id, router],
  );

  if (loading) {
    return (
      <SafeAreaView
        className="flex-1 bg-white items-center justify-center"
        edges={["top"]}
      >
        <ActivityIndicator color={PRIMARY} />
      </SafeAreaView>
    );
  }

  if (!shop) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
        <View
          className="flex-row items-center px-4"
          style={{
            height: 58,
            paddingBottom: 6,
            borderBottomWidth: 1,
            borderBottomColor: GRAY_200,
          }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="뒤로 가기"
            hitSlop={8}
            style={{
              width: 40,
              height: 40,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 24, color: TEXT_DARK }}>‹</Text>
          </TouchableOpacity>
        </View>
        <View className="flex-1 items-center justify-center">
          <Text style={{ fontSize: 14, color: TEXT_GRAY }}>
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
        className="flex-row items-center px-4"
        style={{
          height: 58,
          paddingBottom: 6,
          borderBottomWidth: 1,
          borderBottomColor: GRAY_200,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="뒤로 가기"
          hitSlop={8}
          style={{
            width: 40,
            height: 40,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 24, color: TEXT_DARK }}>‹</Text>
        </TouchableOpacity>
        <View className="flex-1" />
        <View
          style={{
            marginRight: 8,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <WishHeartButton
            isWished={isWished}
            onPress={handleWishToggle}
            size={22}
          />
        </View>
        <TouchableOpacity
          onPress={handleReportPress}
          accessibilityRole="button"
          accessibilityLabel="제보하기"
          hitSlop={8}
          style={{
            width: 40,
            height: 40,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="megaphone-outline" size={22} color={TEXT_DARK} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        {/* 대표 이미지 */}
        <View
          style={{
            width: "100%",
            height: 180,
            backgroundColor: THUMBNAIL_PLACEHOLDER,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {shop.image_urls && shop.image_urls.length > 0 ? (
            <Image
              source={{ uri: shop.image_urls[0] }}
              style={{ width: "100%", height: 180 }}
              resizeMode="cover"
            />
          ) : (
            <>
              <Ionicons name="image-outline" size={36} color={TEXT_GRAY} />
              <Text style={{ marginTop: 6, fontSize: 12, color: TEXT_GRAY }}>
                이미지 없음
              </Text>
            </>
          )}
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
                color: TEXT_DARK,
                flex: 1,
              }}
              numberOfLines={1}
            >
              {shop.name}
            </Text>
            <Text style={{ fontSize: 13, color: PRIMARY, marginLeft: 8 }}>
              ♥ {shop.wishlist_count ?? 0}
            </Text>
          </View>

          {/* 공식 인증 배지 */}
          {shop.is_authorized && (
            <View
              style={{
                alignSelf: "flex-start",
                backgroundColor: PRIMARY_BG,
                borderRadius: 9999,
                paddingHorizontal: 10,
                paddingVertical: 3,
                marginTop: 6,
              }}
            >
              <Text style={{ fontSize: 11, color: PRIMARY }}>✓ 공식 인증</Text>
            </View>
          )}

          {/* 구분선 */}
          <View style={{ height: 1, backgroundColor: BORDER, marginTop: 16 }} />

          {/* 주소 + 복사 버튼 */}
          <View
            className="flex-row items-center"
            style={{ marginTop: 16, gap: 8 }}
          >
            <Text
              style={{
                flex: 1,
                fontSize: 14,
                color: shop.address ? TEXT_DARK : TEXT_GRAY,
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
                  borderColor: BORDER,
                  borderRadius: 6,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                }}
              >
                <Text style={{ fontSize: 12, color: TEXT_GRAY }}>복사</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* 구분선 */}
          <View style={{ height: 1, backgroundColor: BORDER, marginTop: 16 }} />

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
                      backgroundColor: PRIMARY_BG,
                      borderRadius: 9999,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 12, color: PRIMARY }}>#{tag}</Text>
                  </View>
                ))}
              </View>

              {/* 구분선 */}
              <View
                style={{ height: 1, backgroundColor: BORDER, marginTop: 16 }}
              />
            </>
          )}
        </View>

        {/* 리뷰 섹션 */}
        {id && (
          <ReviewSection
            shopId={id}
            currentUserId={currentUserId}
            onWritePress={handleWriteReview}
            onGalleryPress={handleGalleryPress}
            onEditPress={handleEditReview}
          />
        )}
      </ScrollView>

      <LoginModal
        visible={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLoginPress={() => {
          setShowLoginModal(false);
          router.push("/login" as never);
        }}
      />
    </SafeAreaView>
  );
}
