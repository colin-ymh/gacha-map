import { useState, useCallback, useEffect, useMemo } from "react";
import GachaPlaceholder from "@/components/ui/GachaPlaceholder";
import ImageViewerModal from "@/components/molecules/ImageViewerModal";
import { SkeletonBone } from "@/components/ui/Skeleton";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { GlassBackButton } from "@/components/ui/GlassBackButton";
import { WishHeartButton } from "@/components/ui/WishHeartButton";
import LoginModal from "@/components/ui/LoginModal";
import { LiquidGlass } from "@/components/ui/LiquidGlass";
import { useLiquidGlassPress } from "@/hooks/useLiquidGlassPress";
import { useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import type {
  GachaProduct,
  GachaShopEntry,
  GachaRollResult,
  GachaRollQuotaSummary,
} from "@gacha-map/shared";
import {
  PRIMARY,
  PRIMARY_BG,
  TEXT_DARK,
  TEXT_GRAY,
  THUMBNAIL_PLACEHOLDER,
  GRAY_100,
  GRAY_200,
  GRAY_400,
  WHITE,
  SUCCESS_BG,
  SUCCESS_TEXT,
  BADGE_CLAIM_SHOP_BG,
  BADGE_CLAIM_SHOP_TEXT,
  primaryAlpha,
} from "@/constants/colors";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchProductWishlistAsync } from "@/store/slices/product-wishlist.slice";
import { setQuota as setQuotaCache } from "@/store/slices/gachaQuota.slice";
import { useProductWishDebounce } from "@/hooks/useProductWishDebounce";
import { useRecentHistory } from "@/hooks/useRecentHistory";
import { useTodayRolls } from "@/hooks/useTodayRolls";
import { getCurrentPositionSafe } from "@/lib/location";
import { getAuthHeaders } from "@/lib/supabase";
import GachaRollModal from "@/components/organisms/gacha/GachaRollModal";
import GachaChangePickerModal from "@/components/organisms/gacha/GachaChangePickerModal";
import { getReleaseLabelSpec } from "@/lib/releaseLabel";

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

function RolledThumb({
  variant,
}: {
  variant: { name: string; name_ko: string | null; image_url: string | null };
}) {
  const [imgError, setImgError] = useState(false);
  const showImg = !imgError && !!variant.image_url;
  return (
    <View
      style={{
        width: 32,
        height: 32,
        borderRadius: 6,
        backgroundColor: THUMBNAIL_PLACEHOLDER,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {showImg ? (
        <Image
          source={{ uri: variant.image_url! }}
          style={{ width: 32, height: 32 }}
          resizeMode="cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <Ionicons name="gift-outline" size={16} color={GRAY_400} />
      )}
    </View>
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
        marginBottom: 4,
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
  const insets = useSafeAreaInsets();

  const isLoggedIn = useAppSelector((s) => s.auth.isLoggedIn);
  const productIds = useAppSelector((s) => s.productWishlist.productIds);
  const hasFetched = useAppSelector((s) => s.productWishlist.hasFetched);

  const isWished = productIds.includes(id ?? "");
  const { handleProductWishToggle } = useProductWishDebounce();
  const { addGacha } = useRecentHistory();
  const { addRoll } = useTodayRolls();

  const [product, setProduct] = useState<GachaProduct | null>(null);
  const [shops, setShops] = useState<GachaShopEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [rollOpen, setRollOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [rollStatus, setRollStatus] = useState<{
    canRoll: boolean;
    reason?: "no_variants" | "already_rolled" | "daily_limit";
    nextAvailableAt?: string;
    quota?: GachaRollQuotaSummary;
    rolledVariant?: {
      id: string;
      name: string;
      name_ko: string | null;
      image_url: string | null;
    };
  } | null>(null);
  // roll-status가 쿼터도 함께 내려주므로 별도 /api/gacha/quota 호출은 하지 않는다
  // (같은 RPC를 두 번 부르며 요청 하나만큼의 지연이 그대로 더해졌었다).
  // roll-status 응답이 오기 전까지는 다른 화면이 채워둔 공유 캐시를 우선
  // 보여줘서 매번 빈칸으로 시작하지 않게 한다.
  const cachedQuota = useAppSelector((s) => s.gachaQuota.quota);
  const quota = rollStatus?.quota ?? cachedQuota;

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
        const status = await rollStatusRes.json();
        setRollStatus(status);
        // 다른 화면(roll/[id] 등)도 이 값을 즉시 쓸 수 있게 공유 캐시에 반영한다.
        if (status.quota) dispatch(setQuotaCache(status.quota));
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
  }, [id, addGacha, dispatch]);

  const refetchQuota = useCallback(async () => {
    if (!id) return;
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(
        `${API_BASE}/api/gacha-products/${id}/roll-status`,
        { headers: authHeaders },
      );
      if (res.ok) {
        const status = await res.json();
        setRollStatus(status);
        if (status.quota) dispatch(setQuotaCache(status.quota));
      }
    } catch {
      // 실패해도 직전 쿼터를 유지한다. 뽑기 자체는 서버가 다시 막아준다.
    }
  }, [id, dispatch]);

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

  const [showLoginModal, setShowLoginModal] = useState(false);

  function handleWishToggle() {
    if (!id) return;
    handleProductWishToggle(id, () => setShowLoginModal(true));
  }

  type SortOption = "price" | "distance" | "recent";
  const [sortBy, setSortBy] = useState<SortOption>("price");
  const [userCoords, setUserCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  useEffect(() => {
    if (!userCoords) {
      getCurrentPositionSafe().then((loc) => {
        if (loc.ok && loc.coords) {
          setUserCoords({
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
          });
        }
      });
    }
  }, []);

  useEffect(() => {
    if (sortBy === "distance" && !userCoords) {
      getCurrentPositionSafe().then((loc) => {
        if (loc.ok && loc.coords) {
          setUserCoords({
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
          });
        }
      });
    }
  }, [sortBy]);

  const sortedShops = useMemo(() => {
    if (sortBy === "distance" && userCoords) {
      return [...shops].sort((a, b) => {
        const aLat = a.lat,
          aLng = a.lng,
          bLat = b.lat,
          bLng = b.lng;
        if (aLat == null || aLng == null) return 1;
        if (bLat == null || bLng == null) return -1;
        const aDist = Math.hypot(aLat - userCoords.lat, aLng - userCoords.lng);
        const bDist = Math.hypot(bLat - userCoords.lat, bLng - userCoords.lng);
        return aDist - bDist;
      });
    }
    if (sortBy === "recent") {
      return [...shops].sort((a, b) => {
        if (!a.updated_at && !b.updated_at) return 0;
        if (!a.updated_at) return 1;
        if (!b.updated_at) return -1;
        return (
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );
      });
    }
    return shops;
  }, [shops, sortBy, userCoords]);

  const handleRolled = useCallback(
    (result: GachaRollResult) => {
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
      if (id && product) {
        addRoll({
          productId: id,
          productName: product.name_ko ?? product.name,
          productImageUrl: product.official_image_url ?? null,
          variantId: result.variant.id,
          variantName: result.variant.name_ko ?? result.variant.name,
          variantImageUrl: result.variant.image_url ?? null,
        });
      }
      // 서버가 계산한 잔여 횟수를 다시 받아온다. 친구 초대 보너스가 그 사이
      // 늘었을 수 있어서 로컬에서 1 빼는 방식은 쓰지 않는다.
      void refetchQuota();
    },
    [id, product, addRoll, refetchQuota],
  );

  const displayName = product?.name_ko ?? product?.name ?? "";
  const releaseLabelSpec = product ? getReleaseLabelSpec(product) : null;

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: WHITE }} edges={["top"]}>
        <View
          style={[gSkStyles.floatRow, { top: insets.top + 8 }]}
          pointerEvents="box-none"
        >
          <GlassBackButton onPress={() => router.back()} />
        </View>
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 60 }}
        >
          {/* 상품 정보: 120x120 이미지 + 상품명/제조사/가격 row */}
          <View style={{ flexDirection: "row", gap: 16, padding: 16 }}>
            <SkeletonBone width={120} height={120} borderRadius={12} />
            <View style={{ flex: 1, gap: 8, justifyContent: "center" }}>
              <SkeletonBone width="80%" height={17} />
              <SkeletonBone width="45%" height={22} borderRadius={99} />
              <SkeletonBone width="55%" height={13} />
            </View>
          </View>
          {/* 구분선 */}
          <View style={{ height: 8, backgroundColor: GRAY_100 }} />
          {/* 뽑기 버튼 */}
          <View
            style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 }}
          >
            <SkeletonBone height={44} borderRadius={8} />
          </View>
          {/* 샵 제목 */}
          <View
            style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}
          >
            <SkeletonBone width="40%" height={15} />
          </View>
          {/* 샵 행: 좌(샵명+주소) + 우(가격+태그) */}
          {[0, 1, 2].map((i) => (
            <View key={i} style={gSkStyles.shopRow}>
              <View style={{ flex: 1, gap: 6 }}>
                <SkeletonBone width="60%" height={13} />
                <SkeletonBone width="45%" height={11} />
              </View>
              <View style={{ alignItems: "flex-end", gap: 6 }}>
                <SkeletonBone width={60} height={14} />
                <SkeletonBone width={50} height={18} borderRadius={99} />
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
      {/* 플로팅 버튼 */}
      <View
        style={[gSkStyles.floatRow, { top: insets.top + 8 }]}
        pointerEvents="box-none"
      >
        <GlassBackButton onPress={() => router.back()} />
        <WishHeartButton
          isWished={isWished}
          onPress={handleWishToggle}
          glass
          size={24}
        />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: 60,
          paddingBottom: rollStatus?.reason !== "no_variants" ? 96 : 40,
        }}
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
            <Text style={{ fontSize: 20, fontWeight: "700", color: TEXT_DARK }}>
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
                style={{ fontSize: 13, color: TEXT_GRAY, fontWeight: "500" }}
              >
                {product.manufacturer}
              </Text>
            </View>

            {product.price_jpy && (
              <Text style={{ fontSize: 14, color: TEXT_GRAY }}>
                {t("gacha.officialPrice", {
                  price: product.price_jpy.toLocaleString(),
                })}
              </Text>
            )}

            {releaseLabelSpec && (
              <Text style={{ fontSize: 14, color: TEXT_GRAY }}>
                {t(releaseLabelSpec.key, releaseLabelSpec.params)}
              </Text>
            )}
          </View>
        </View>

        {shops.length === 0 ? (
          <View style={{ padding: 40, alignItems: "center" }}>
            <Text style={{ fontSize: 14, color: TEXT_GRAY }}>
              {t("gacha.noAvailableShops")}
            </Text>
          </View>
        ) : (
          <>
            {/* 정렬 pill */}
            <View
              style={{
                flexDirection: "row",
                gap: 8,
                paddingHorizontal: 16,
                paddingTop: 16,
                paddingBottom: 6,
              }}
            >
              {(
                [
                  ["price", t("gacha.sort.price")],
                  ["distance", t("gacha.sort.distance")],
                  ["recent", t("gacha.sort.recent")],
                ] as const
              ).map(([key, label]) => {
                const active = sortBy === key;
                return (
                  <SortPill
                    key={key}
                    label={label}
                    active={active}
                    onPress={() => setSortBy(key)}
                  />
                );
              })}
            </View>

            {sortedShops.map((shop) => {
              const statusStyle =
                shop.availability_status === "available"
                  ? { bg: SUCCESS_BG, text: SUCCESS_TEXT }
                  : { bg: BADGE_CLAIM_SHOP_BG, text: BADGE_CLAIM_SHOP_TEXT };
              return (
                <TouchableOpacity
                  key={shop.shop_id}
                  activeOpacity={0.7}
                  onPress={() => router.push(`/shop/${shop.shop_id}` as never)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 20,
                  }}
                >
                  {/* 좌: 샵명 + 주소 + 거리 */}
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text
                      numberOfLines={1}
                      style={{
                        fontSize: 16,
                        fontWeight: "700",
                        color: TEXT_DARK,
                      }}
                    >
                      {shop.shop_name}
                    </Text>
                    {shop.address && (
                      <Text
                        numberOfLines={1}
                        style={{ fontSize: 13, color: TEXT_GRAY }}
                      >
                        {shop.address}
                      </Text>
                    )}
                    {(() => {
                      const dist = calcDistLabel(
                        shop.lat,
                        shop.lng,
                        userCoords,
                      );
                      return dist ? (
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 3,
                          }}
                        >
                          <Ionicons
                            name="navigate-outline"
                            size={12}
                            color={TEXT_GRAY}
                          />
                          <Text style={{ fontSize: 12, color: TEXT_GRAY }}>
                            {dist}
                          </Text>
                        </View>
                      ) : null;
                    })()}
                  </View>
                  {/* 우: 가격 + 태그 */}
                  <View style={{ alignItems: "flex-end", gap: 5 }}>
                    {shop.price_krw != null ? (
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: "700",
                          color: PRIMARY,
                        }}
                      >
                        ₩{shop.price_krw.toLocaleString()}
                      </Text>
                    ) : (
                      <Text style={{ fontSize: 13, color: TEXT_GRAY }}>
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
                          fontSize: 11,
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
              );
            })}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* 뽑기 FAB */}
      {rollStatus?.reason !== "no_variants" && (
        <RollFAB
          label={
            rollStatus?.rolledVariant
              ? t("gacha.roll.reroll")
              : t("gacha.roll.rollBtn")
          }
          onPress={() => setRollOpen(true)}
          bottom={insets.bottom + 16}
          quota={quota}
        />
      )}

      {id && rollOpen && (
        <GachaRollModal
          productId={id}
          productName={product.name_ko ?? product.name}
          productImageUrl={product.official_image_url ?? null}
          isLoggedIn={!!isLoggedIn}
          onClose={() => setRollOpen(false)}
          onLoginRequired={() => {
            setRollOpen(false);
            setShowLoginModal(true);
          }}
          onChangeGacha={() => setPickerOpen(true)}
          onRolled={handleRolled}
          quota={quota}
          onRefetchQuota={refetchQuota}
          changeGachaOverlay={
            <GachaChangePickerModal
              visible={pickerOpen}
              currentId={id}
              onClose={() => setPickerOpen(false)}
              onSelect={(item) => {
                setPickerOpen(false);
                setRollOpen(false);
                router.replace(`/gacha/${item.id}` as never);
              }}
            />
          }
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

function SortPill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 99,
        backgroundColor: active ? PRIMARY_BG : GRAY_100,
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: active ? "700" : "400",
          color: active ? PRIMARY : TEXT_DARK,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function calcDistLabel(
  shopLat: number | null,
  shopLng: number | null,
  user: { lat: number; lng: number } | null,
): string | null {
  if (!user || shopLat == null || shopLng == null) return null;
  const R = 6371000;
  const dLat = ((shopLat - user.lat) * Math.PI) / 180;
  const dLng = ((shopLng - user.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((user.lat * Math.PI) / 180) *
      Math.cos((shopLat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return d < 1000 ? `${Math.round(d)}m` : `${(d / 1000).toFixed(1)}km`;
}

function RollFAB({
  label,
  onPress,
  bottom,
  quota,
}: {
  label: string;
  onPress: () => void;
  bottom: number;
  /** 오늘의 뽑기 쿼터. null이면 아직 모르거나 비로그인 상태다. */
  quota: GachaRollQuotaSummary | null;
}) {
  const { onPressIn, onPressOut, animatedStyle, brightnessValue } =
    useLiquidGlassPress();
  // 숫자만 두면 무엇의 1인지 알 수 없어 분모까지 함께 보여준다.
  const badgeLabel = quota
    ? `${quota.remaining}/${quota.base + quota.bonus}`
    : null;
  return (
    <LiquidGlass
      borderRadius={28}
      style={[
        animatedStyle,
        { position: "absolute", left: 16, right: 16, bottom },
      ]}
      brightnessOpacity={brightnessValue}
      overlayColor={primaryAlpha(0.1)}
    >
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
        style={{
          height: 52,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        <Ionicons name="dice-outline" size={22} color={PRIMARY} />
        <Text style={{ fontSize: 15, fontWeight: "700", color: PRIMARY }}>
          {label}
        </Text>
        {badgeLabel !== null && (
          <View
            style={{
              minWidth: 34,
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 10,
              backgroundColor: primaryAlpha(0.14),
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: PRIMARY,
                textAlign: "center",
              }}
            >
              {badgeLabel}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </LiquidGlass>
  );
}

const gSkStyles = StyleSheet.create({
  floatRow: {
    position: "absolute",
    left: 12,
    right: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 10,
  },
  shopRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
});
