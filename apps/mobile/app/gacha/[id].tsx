import { useState, useCallback, useEffect } from "react";
import GachaPlaceholder from "@/components/ui/GachaPlaceholder";
import ImageViewerModal from "@/components/molecules/ImageViewerModal";
import { SkeletonBone } from "@/components/ui/Skeleton";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import type {
  GachaProduct,
  GachaShopEntry,
  GachaRollResult,
} from "@gacha-map/shared";
import {
  PRIMARY,
  TEXT_DARK,
  TEXT_GRAY,
  THUMBNAIL_PLACEHOLDER,
  GRAY_100,
  GRAY_200,
  GRAY_400,
  BORDER,
  WHITE,
  SUCCESS_BG,
  SUCCESS_TEXT,
  BADGE_CLAIM_SHOP_BG,
  BADGE_CLAIM_SHOP_TEXT,
} from "@/constants/colors";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchProductWishlistAsync } from "@/store/slices/product-wishlist.slice";
import { useProductWishDebounce } from "@/hooks/useProductWishDebounce";
import { useRecentGacha } from "@/hooks/useRecentGacha";
import { getAuthHeaders } from "@/lib/supabase";
import GachaRollModal from "@/components/organisms/gacha/GachaRollModal";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

function ProductImage({
  url,
  name,
  onPress,
}: {
  url: string | null;
  name: string;
  onPress?: () => void;
}) {
  const [error, setError] = useState(false);
  const show = !error && !!url;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!url}
      activeOpacity={0.85}
      accessibilityLabel={name}
      accessibilityRole="button"
    >
      <View
        style={{
          width: 120,
          height: 120,
          borderRadius: 12,
          backgroundColor: THUMBNAIL_PLACEHOLDER,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {show ? (
          <Image
            source={{ uri: url! }}
            style={{ width: 120, height: 120 }}
            resizeMode="cover"
            onError={() => setError(true)}
            accessibilityLabel={name}
          />
        ) : (
          <GachaPlaceholder size={120} borderRadius={12} />
        )}
      </View>
    </TouchableOpacity>
  );
}

function RolledResultCard({
  variant,
}: {
  variant: {
    id: string;
    name: string;
    name_ko: string | null;
    image_url: string | null;
  };
}) {
  const { t } = useTranslation();
  const [imgError, setImgError] = useState(false);
  const displayName = variant.name_ko ?? variant.name;
  const showImg = !imgError && !!variant.image_url;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        backgroundColor: GRAY_100,
        borderRadius: 8,
        padding: 12,
        marginHorizontal: 16,
        marginTop: 12,
      }}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 8,
          backgroundColor: THUMBNAIL_PLACEHOLDER,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {showImg ? (
          <Image
            source={{ uri: variant.image_url! }}
            style={{ width: 48, height: 48 }}
            resizeMode="cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <Ionicons name="gift-outline" size={22} color={GRAY_400} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 11, color: TEXT_GRAY, marginBottom: 2 }}>
          {t("gacha.roll.todayResult")}
        </Text>
        <Text
          numberOfLines={2}
          style={{ fontSize: 13, fontWeight: "700", color: TEXT_DARK }}
        >
          {displayName}
        </Text>
      </View>
    </View>
  );
}

export default function GachaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const isLoggedIn = useAppSelector((s) => s.auth.isLoggedIn);
  const productIds = useAppSelector((s) => s.productWishlist.productIds);
  const hasFetched = useAppSelector((s) => s.productWishlist.hasFetched);

  const isWished = productIds.includes(id ?? "");
  const { handleProductWishToggle } = useProductWishDebounce();
  const { addGacha } = useRecentGacha();

  const [product, setProduct] = useState<GachaProduct | null>(null);
  const [shops, setShops] = useState<GachaShopEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [rollOpen, setRollOpen] = useState(false);
  const [rollStatus, setRollStatus] = useState<{
    canRoll: boolean;
    reason?: "no_variants" | "already_rolled" | "daily_limit";
    nextAvailableAt?: string;
    rolledVariant?: {
      id: string;
      name: string;
      name_ko: string | null;
      image_url: string | null;
    };
  } | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(false);
    try {
      const authHeaders = await getAuthHeaders();
      const [productRes, shopsRes, rollStatusRes] = await Promise.all([
        fetch(`${API_BASE}/api/gacha-products/${id}`),
        fetch(`${API_BASE}/api/gacha-products/${id}/shops?limit=20`),
        fetch(`${API_BASE}/api/gacha-products/${id}/roll-status`, {
          headers: authHeaders,
        }).catch(() => null),
      ]);
      if (!productRes.ok) throw new Error("product not found");
      const productData = await productRes.json();
      const shopsData = shopsRes.ok ? await shopsRes.json() : { shops: [] };
      const p: GachaProduct = productData.product ?? productData;
      setProduct(p);
      setShops(shopsData.shops ?? []);
      if (rollStatusRes?.ok) {
        setRollStatus(await rollStatusRes.json());
      }
      addGacha({
        id,
        name: p.name_ko ?? p.name,
        imageUrl: p.official_image_url ?? undefined,
      });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id, addGacha]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    if (isLoggedIn && !hasFetched) {
      dispatch(fetchProductWishlistAsync());
    }
  }, [isLoggedIn, hasFetched, dispatch]);

  function handleWishToggle() {
    if (!id) return;
    handleProductWishToggle(id, () => router.push("/login" as never));
  }

  const handleRolled = useCallback((result: GachaRollResult) => {
    setRollStatus((prev) => ({
      ...prev,
      canRoll: true,
      rolledVariant: {
        id: result.variant.id,
        name: result.variant.name,
        name_ko: result.variant.name_ko ?? null,
        image_url: result.variant.image_url ?? null,
      },
    }));
  }, []);

  const displayName = product?.name_ko ?? product?.name ?? "";

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: WHITE }} edges={["top"]}>
        <View style={gSkStyles.header}>
          <SkeletonBone width={32} height={32} borderRadius={16} />
          <SkeletonBone
            width="50%"
            height={18}
            style={{ marginHorizontal: 12 }}
          />
          <View style={{ width: 32 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <SkeletonBone
            height={200}
            borderRadius={12}
            style={{ marginBottom: 16 }}
          />
          <SkeletonBone width="55%" height={22} style={{ marginBottom: 8 }} />
          <SkeletonBone width="30%" height={15} style={{ marginBottom: 6 }} />
          <SkeletonBone width="20%" height={18} style={{ marginBottom: 24 }} />
          <SkeletonBone width="40%" height={16} style={{ marginBottom: 12 }} />
          {[0, 1, 2].map((i) => (
            <View key={i} style={gSkStyles.shopRow}>
              <SkeletonBone width={56} height={56} borderRadius={8} />
              <View style={{ flex: 1, marginLeft: 12, gap: 6 }}>
                <SkeletonBone width="55%" height={15} />
                <SkeletonBone width="40%" height={12} />
              </View>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (error || !product) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 16 }}>
          <Text style={{ fontSize: 16, color: TEXT_DARK }}>{"←"}</Text>
        </TouchableOpacity>
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ color: TEXT_GRAY, fontSize: 14 }}>
            {t("gacha.loadError")}
          </Text>
          <TouchableOpacity onPress={load} style={{ marginTop: 12 }}>
            <Text style={{ color: PRIMARY, fontSize: 14 }}>
              {t("gacha.retry")}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: WHITE }} edges={["top"]}>
      {/* 헤더 */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: GRAY_100,
        }}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ fontSize: 16, color: TEXT_DARK }}>{"←"}</Text>
        </TouchableOpacity>
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            marginLeft: 12,
            fontSize: 16,
            fontWeight: "700",
            color: TEXT_DARK,
          }}
        >
          {displayName}
        </Text>
        <TouchableOpacity
          onPress={handleWishToggle}
          hitSlop={8}
          style={{ padding: 4, marginLeft: 8 }}
        >
          <Ionicons
            name={isWished ? "heart" : "heart-outline"}
            size={22}
            color={isWished ? PRIMARY : TEXT_GRAY}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* 상품 정보 */}
        <View
          style={{
            flexDirection: "row",
            gap: 16,
            padding: 16,
            backgroundColor: WHITE,
          }}
        >
          <ProductImage
            url={product.official_image_url}
            name={displayName}
            onPress={() => setShowImageViewer(true)}
          />
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={{ fontSize: 17, fontWeight: "700", color: TEXT_DARK }}>
              {displayName}
            </Text>
            <View
              style={{
                alignSelf: "flex-start",
                backgroundColor: GRAY_100,
                borderRadius: 99,
                paddingHorizontal: 7,
                paddingVertical: 2,
              }}
            >
              <Text
                style={{ fontSize: 11, color: TEXT_GRAY, fontWeight: "500" }}
              >
                {product.manufacturer}
              </Text>
            </View>

            {product.price_jpy && (
              <Text style={{ fontSize: 12, color: TEXT_GRAY }}>
                {t("gacha.officialPrice", {
                  price: product.price_jpy.toLocaleString(),
                })}
              </Text>
            )}
          </View>
        </View>

        {/* 구분선 */}
        <View style={{ height: 8, backgroundColor: GRAY_100 }} />

        {/* 오늘 뽑은 결과 카드 */}
        {rollStatus?.rolledVariant && (
          <RolledResultCard variant={rollStatus.rolledVariant} />
        )}

        {/* 뽑기 버튼 — 품목 없으면 숨김, 뽑은 이력 있으면 "다시 뽑기" */}
        {rollStatus?.reason !== "no_variants" && (
          <View
            style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 }}
          >
            <TouchableOpacity
              style={{
                backgroundColor: PRIMARY,
                borderRadius: 8,
                height: 44,
                alignItems: "center",
                justifyContent: "center",
              }}
              onPress={() => setRollOpen(true)}
            >
              <Text style={{ fontSize: 15, fontWeight: "700", color: WHITE }}>
                {rollStatus?.rolledVariant
                  ? t("gacha.roll.reroll")
                  : t("gacha.roll.rollBtn")}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 판매 중인 샵 */}
        <View
          style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}
        >
          <Text style={{ fontSize: 15, fontWeight: "700", color: TEXT_DARK }}>
            {t("gacha.shopsTitle", { count: shops.length })}
          </Text>
        </View>

        {shops.length === 0 ? (
          <View style={{ padding: 40, alignItems: "center" }}>
            <Text style={{ fontSize: 14, color: TEXT_GRAY }}>
              {t("gacha.noAvailableShops")}
            </Text>
          </View>
        ) : (
          shops.map((shop, index) => {
            const statusStyle =
              shop.availability_status === "available"
                ? { bg: SUCCESS_BG, text: SUCCESS_TEXT }
                : { bg: BADGE_CLAIM_SHOP_BG, text: BADGE_CLAIM_SHOP_TEXT };
            return (
              <View key={shop.shop_id}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => router.push(`/shop/${shop.shop_id}` as never)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                  }}
                >
                  {/* 좌: 샵명 + 주소 */}
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text
                      numberOfLines={1}
                      style={{
                        fontSize: 13,
                        fontWeight: "700",
                        color: TEXT_DARK,
                      }}
                    >
                      {shop.shop_name}
                    </Text>
                    {shop.address && (
                      <Text
                        numberOfLines={1}
                        style={{ fontSize: 11, color: TEXT_GRAY }}
                      >
                        {shop.address}
                      </Text>
                    )}
                  </View>
                  {/* 우: 가격 + 태그 */}
                  <View style={{ alignItems: "flex-end", gap: 5 }}>
                    {shop.price_krw != null ? (
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "700",
                          color: PRIMARY,
                        }}
                      >
                        ₩{shop.price_krw.toLocaleString()}
                      </Text>
                    ) : (
                      <Text style={{ fontSize: 12, color: TEXT_GRAY }}>
                        {t("gacha.noPrice")}
                      </Text>
                    )}
                    <View
                      style={{
                        backgroundColor: statusStyle.bg,
                        borderRadius: 99,
                        paddingHorizontal: 7,
                        paddingVertical: 2,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: "600",
                          color: statusStyle.text,
                        }}
                      >
                        {t(
                          shop.availability_status === "available"
                            ? "gacha.statusAvailable"
                            : "gacha.statusSeen",
                        )}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
                {index < shops.length - 1 && (
                  <View
                    style={{
                      height: 1,
                      backgroundColor: BORDER,
                      marginHorizontal: 16,
                    }}
                  />
                )}
              </View>
            );
          })
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {id && rollOpen && (
        <GachaRollModal
          productId={id}
          isLoggedIn={!!isLoggedIn}
          onClose={() => setRollOpen(false)}
          onLoginRequired={() => {
            setRollOpen(false);
            router.push("/login" as never);
          }}
          onRolled={handleRolled}
        />
      )}

      {product.official_image_url && (
        <ImageViewerModal
          images={[product.official_image_url]}
          initialIndex={0}
          visible={showImageViewer}
          onClose={() => setShowImageViewer(false)}
        />
      )}
    </SafeAreaView>
  );
}

const gSkStyles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  shopRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
});
