import GachaItemThumb from "@/components/molecules/GachaItemThumb";
import { SkeletonBone } from "@/components/ui/Skeleton";
import { LiquidGlass } from "@/components/ui/LiquidGlass";
import { WishHeartButton } from "@/components/ui/WishHeartButton";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import type { ShopSummary } from "@gacha-map/shared";
import type { WishlistedProduct } from "@/store/slices/product-wishlist.slice";
import {
  PRIMARY,
  PRIMARY_BG,
  TEXT_DARK,
  TEXT_GRAY,
  TEXT_PLACEHOLDER,
  THUMBNAIL_PLACEHOLDER,
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
  activeTab: "shop" | "product";
  onTabChange: (tab: "shop" | "product") => void;
  products: WishlistedProduct[];
  wishedProductIds: string[];
  pendingProductIds: string[];
  productLoading?: boolean;
  onProductPress: (productId: string) => void;
  onProductWishToggle: (productId: string) => void;
}

function WishCard({
  shop,
  isWished,
  onWishToggle,
  onPress,
  noAddressText,
}: {
  shop: ShopSummary;
  isWished: boolean;
  onWishToggle: () => void;
  onPress: () => void;
  noAddressText: string;
}) {
  return (
    <View
      style={{
        marginHorizontal: 16,
        marginBottom: 10,
        backgroundColor: WHITE,
        borderRadius: 16,
      }}
    >
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={onPress}
        style={{
          flexDirection: "row",
          paddingHorizontal: 16,
          paddingVertical: 20,
          gap: 12,
        }}
      >
        {/* Info */}
        <View style={{ flex: 1, justifyContent: "space-between" }}>
          <Text
            numberOfLines={1}
            style={{ fontSize: 16, fontWeight: "700", color: TEXT_DARK }}
          >
            {shop.name}
          </Text>
          <Text
            numberOfLines={1}
            style={{ fontSize: 13, color: TEXT_GRAY, marginTop: 4 }}
          >
            {shop.address ?? noAddressText}
          </Text>
        </View>

        {/* Heart */}
        <WishHeartButton
          isWished={isWished}
          count={0}
          onPress={onWishToggle}
          glass
          size={20}
          glassBorderRadius={20}
          inactiveColor={TEXT_GRAY}
        />
      </TouchableOpacity>
    </View>
  );
}

function ProductWishCard({
  product,
  isWished,
  isPending,
  onPress,
  onWishToggle,
}: {
  product: WishlistedProduct;
  isWished: boolean;
  isPending: boolean;
  onPress: () => void;
  onWishToggle: () => void;
}) {
  const { t } = useTranslation();
  const name = product.name_ko ?? product.name ?? "";
  return (
    <View
      style={{
        marginHorizontal: 16,
        marginBottom: 10,
        backgroundColor: WHITE,
        borderRadius: 16,
      }}
    >
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={onPress}
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 16,
          gap: 12,
        }}
      >
        <GachaItemThumb
          url={product.official_image_url}
          size={48}
          accessibilityLabel={name}
        />
        <View style={{ flex: 1, gap: 3 }}>
          <Text
            numberOfLines={1}
            style={{ fontSize: 14, fontWeight: "700", color: TEXT_DARK }}
          >
            {name}
          </Text>
          {product.manufacturer ? (
            <Text numberOfLines={1} style={{ fontSize: 11, color: TEXT_GRAY }}>
              {product.manufacturer}
            </Text>
          ) : null}
          <Text
            style={{
              fontSize: 11,
              color: product.available_shop_count > 0 ? PRIMARY : TEXT_GRAY,
            }}
          >
            {product.available_shop_count > 0
              ? t("wishlistView.availableShops", {
                  count: product.available_shop_count,
                })
              : t("wishlistView.noAvailableShops")}
          </Text>
        </View>
        <WishHeartButton
          isWished={isWished}
          count={0}
          onPress={() => {
            if (!isPending) onWishToggle();
          }}
          glass
          size={20}
          glassBorderRadius={20}
          inactiveColor={TEXT_GRAY}
        />
      </TouchableOpacity>
    </View>
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
  activeTab,
  onTabChange,
  products,
  wishedProductIds,
  pendingProductIds,
  productLoading = false,
  onProductPress,
  onProductWishToggle,
}: SearchViewProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const TAB_BAR_HEIGHT = 68; // 56 row + 12 marginBottom

  if (!isLoggedIn) {
    return (
      <View style={{ flex: 1 }}>
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
            {t("wishlistView.loginPrompt")}
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
              {t("wishlistView.loginBtn")}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isShopEmpty = shops.length === 0;
  const isProductEmpty = products.length === 0;

  return (
    <View style={{ flex: 1, backgroundColor: GRAY_100 }}>
      {/* 세그먼트 탭 */}
      <LiquidGlass
        borderRadius={24}
        style={{ marginHorizontal: 16, marginTop: 14, marginBottom: 8 }}
      >
        <View style={{ flexDirection: "row", height: 38 }}>
          {(["shop", "product"] as const).map((tab) => {
            const isActive = activeTab === tab;
            const label =
              tab === "shop"
                ? t("wishlistView.shopTab")
                : t("wishlistView.productTab");
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => onTabChange(tab)}
                activeOpacity={0.8}
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {isActive && (
                  <View
                    style={{
                      ...StyleSheet.absoluteFillObject,
                      backgroundColor: "rgba(255,255,255,0.45)",
                      borderRadius: 20,
                      margin: 4,
                    }}
                  />
                )}
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: isActive ? "700" : "400",
                    color: isActive ? PRIMARY : TEXT_GRAY,
                  }}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </LiquidGlass>

      {/* 샵 탭 */}
      {activeTab === "shop" &&
        (isLoading ? (
          <ScrollView style={{ flex: 1 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <View
                key={i}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  gap: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: GRAY_100,
                }}
              >
                <View style={{ flex: 1, justifyContent: "space-between" }}>
                  <SkeletonBone
                    width="60%"
                    height={14}
                    style={{ marginBottom: 6 }}
                  />
                  <SkeletonBone width="40%" height={11} />
                </View>
              </View>
            ))}
          </ScrollView>
        ) : isShopEmpty ? (
          <View
            style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ fontSize: 14, color: TEXT_GRAY }}>
              {t("wishlistView.emptyState")}
            </Text>
          </View>
        ) : (
          <>
            <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
              <Text style={{ fontSize: 13, color: TEXT_GRAY }}>
                {t("wishlistView.wishCount", { count: wishedShopIds.length })}
              </Text>
            </View>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{
                paddingTop: 12,
                paddingBottom: insets.bottom + TAB_BAR_HEIGHT,
              }}
              refreshControl={
                <RefreshControl
                  refreshing={isLoading}
                  onRefresh={onRefresh}
                  tintColor={PRIMARY}
                />
              }
            >
              {shops.map((shop) => (
                <WishCard
                  key={shop.id}
                  shop={shop}
                  isWished={wishedShopIds.includes(shop.id)}
                  onWishToggle={() => onWishToggle(shop.id)}
                  onPress={() => onShopPress(shop.id)}
                  noAddressText={t("wishlistView.noAddress")}
                />
              ))}
            </ScrollView>
          </>
        ))}

      {/* 상품 탭 */}
      {activeTab === "product" &&
        (productLoading ? (
          <ScrollView style={{ flex: 1 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <View
                key={i}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  gap: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: GRAY_100,
                }}
              >
                <View style={{ width: 48, height: 48, flexShrink: 0 }}>
                  <SkeletonBone width={48} height={48} borderRadius={8} />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <SkeletonBone
                    width="60%"
                    height={14}
                    style={{ marginBottom: 3 }}
                  />
                  <SkeletonBone
                    width="40%"
                    height={11}
                    style={{ marginBottom: 3 }}
                  />
                  <SkeletonBone width="75%" height={11} />
                </View>
              </View>
            ))}
          </ScrollView>
        ) : isProductEmpty ? (
          <View
            style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons
              name="heart-outline"
              size={48}
              color={BORDER}
              style={{ marginBottom: 12 }}
            />
            <Text style={{ fontSize: 14, color: TEXT_GRAY }}>
              {t("wishlistView.productEmpty")}
            </Text>
          </View>
        ) : (
          <>
            <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
              <Text style={{ fontSize: 13, color: TEXT_GRAY }}>
                {t("wishlistView.productWishCount", {
                  count: wishedProductIds.length,
                })}
              </Text>
            </View>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{
                paddingTop: 12,
                paddingBottom: insets.bottom + TAB_BAR_HEIGHT,
              }}
              refreshControl={
                <RefreshControl
                  refreshing={productLoading}
                  onRefresh={onRefresh}
                  tintColor={PRIMARY}
                />
              }
            >
              {products.map((product) => (
                <ProductWishCard
                  key={product.id}
                  product={product}
                  isWished={wishedProductIds.includes(product.id)}
                  isPending={pendingProductIds.includes(product.id)}
                  onPress={() => onProductPress(product.id)}
                  onWishToggle={() => onProductWishToggle(product.id)}
                />
              ))}
            </ScrollView>
          </>
        ))}
    </View>
  );
}
