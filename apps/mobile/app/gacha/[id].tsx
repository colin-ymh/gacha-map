import { useState, useCallback, useEffect } from "react";
import ImageViewerModal from "@/components/molecules/ImageViewerModal";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import type { GachaProduct, GachaShopEntry, GachaRollResult } from "@gacha-map/shared";
import {
  PRIMARY,
  TEXT_DARK,
  TEXT_GRAY,
  TEXT_PLACEHOLDER,
  THUMBNAIL_PLACEHOLDER,
  GRAY_100,
  GRAY_200,
  GRAY_400,
  BORDER,
  WHITE,
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
          <Text style={{ fontSize: 40, color: TEXT_PLACEHOLDER }}>🎰</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

function ShopThumb({ url }: { url: string | null }) {
  const [error, setError] = useState(false);
  const show = !error && !!url;
  return (
    <View
      style={{
        width: 48,
        height: 48,
        borderRadius: 8,
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
          style={{ width: 48, height: 48 }}
          resizeMode="cover"
          onError={() => setError(true)}
        />
      ) : (
        <Ionicons name="storefront-outline" size={22} color={GRAY_400} />
      )}
    </View>
  );
}

function RolledResultCard({
  variant,
}: {
  variant: { id: string; name: string; name_ko: string | null; image_url: string | null };
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
        <Text numberOfLines={2} style={{ fontSize: 13, fontWeight: "700", color: TEXT_DARK }}>
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
        fetch(`${API_BASE}/api/gacha-products/${id}/roll-status`, { headers: authHeaders }).catch(() => null),
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
    setRollStatus({
      canRoll: false,
      reason: "already_rolled",
      nextAvailableAt: result.permission.nextAvailableAt,
      rolledVariant: {
        id: result.variant.id,
        name: result.variant.name,
        name_ko: result.variant.name_ko ?? null,
        image_url: result.variant.image_url ?? null,
      },
    });
  }, []);

  const displayName = product?.name_ko ?? product?.name ?? "";

  if (loading) {
    return (
      <SafeAreaView
        style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        edges={["top"]}
      >
        <ActivityIndicator color={PRIMARY} />
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
            {product.name_parts?.tags && product.name_parts.tags.length > 0 && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                {product.name_parts.tags.map((tag) => (
                  <View
                    key={tag}
                    style={{
                      backgroundColor: GRAY_100,
                      borderRadius: 99,
                      paddingHorizontal: 7,
                      paddingVertical: 2,
                    }}
                  >
                    <Text
                      style={{ fontSize: 11, color: TEXT_GRAY, fontWeight: "500" }}
                    >
                      {tag}
                    </Text>
                  </View>
                ))}
              </View>
            )}
            {product.price_jpy && (
              <Text style={{ fontSize: 12, color: TEXT_GRAY }}>
                {t("gacha.officialPrice", {
                  price: product.price_jpy.toLocaleString(),
                })}
              </Text>
            )}
          </View>
        </View>

        {/* 오늘 뽑은 결과 카드 */}
        {rollStatus?.rolledVariant && (
          <RolledResultCard variant={rollStatus.rolledVariant} />
        )}

        {/* 구분선 */}
        <View style={{ height: 8, backgroundColor: GRAY_100 }} />

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
          shops.map((shop, index) => (
            <View key={shop.shop_id}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => router.push(`/shop/${shop.shop_id}` as never)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                }}
              >
                <ShopThumb url={shop.image_url} />
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
                {shop.price_krw != null ? (
                  <Text
                    style={{ fontSize: 14, fontWeight: "700", color: PRIMARY }}
                  >
                    ₩{shop.price_krw.toLocaleString()}
                  </Text>
                ) : (
                  <Text style={{ fontSize: 12, color: TEXT_GRAY }}>
                    {t("gacha.noPrice")}
                  </Text>
                )}
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
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* TODO: 진입점 위치 확정 후 이동 */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 12, paddingTop: 8 }}>
        {(() => {
          const blocked = rollStatus && !rollStatus.canRoll;
          const disabledText = blocked
            ? rollStatus.reason === "no_variants"
              ? t("gacha.roll.disabledNoVariants")
              : rollStatus.reason === "already_rolled"
                ? t("gacha.roll.disabledAlreadyRolled")
                : t("gacha.roll.disabledDailyLimit")
            : null;
          return (
            <>
              <TouchableOpacity
                style={{
                  backgroundColor: blocked ? GRAY_200 : PRIMARY,
                  borderRadius: 8,
                  height: 44,
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onPress={blocked ? undefined : () => setRollOpen(true)}
                disabled={!!blocked}
              >
                <Text style={{ fontSize: 15, fontWeight: "700", color: blocked ? TEXT_GRAY : WHITE }}>
                  {t("gacha.roll.rollBtn")}
                </Text>
              </TouchableOpacity>
              {disabledText && (
                <Text style={{ fontSize: 12, color: TEXT_GRAY, textAlign: "center", marginTop: 6 }}>
                  {disabledText}
                </Text>
              )}
            </>
          );
        })()}
      </View>

      {id && rollOpen && (
        <GachaRollModal
          productId={id}
          isLoggedIn={!!isLoggedIn}
          onClose={() => setRollOpen(false)}
          onLoginRequired={() => { setRollOpen(false); router.push("/login" as never); }}
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
