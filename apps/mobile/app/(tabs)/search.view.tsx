import { useState } from "react";
import GachaPlaceholder from "@/components/ui/GachaPlaceholder";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from "react-native";
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
          {shop.address ?? noAddressText}
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
          {isWished
            ? (shop.wishlist_count ?? 0)
            : Math.max(0, (shop.wishlist_count ?? 1) - 1)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function ProductThumb({ url, name }: { url: string | null; name: string }) {
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
          accessibilityLabel={name}
        />
      ) : (
        <GachaPlaceholder size={48} borderRadius={8} />
      )}
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
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 12,
      }}
    >
      <ProductThumb url={product.official_image_url} name={name} />
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
      <TouchableOpacity
        onPress={(e) => {
          e.stopPropagation();
          if (!isPending) onWishToggle();
        }}
        hitSlop={8}
        style={{ padding: 4 }}
      >
        <Ionicons
          name={isWished ? "heart" : "heart-outline"}
          size={20}
          color={isWished ? PRIMARY : TEXT_GRAY}
        />
      </TouchableOpacity>
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
            {t("wishlistView.title")}
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
          {t("wishlistView.title")}
        </Text>
      </View>

      {/* 세그먼트 탭 */}
      <View
        style={{
          flexDirection: "row",
          height: 44,
          borderBottomWidth: 1,
          borderBottomColor: GRAY_200,
          backgroundColor: WHITE,
        }}
      >
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
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                borderBottomWidth: 2,
                borderBottomColor: isActive ? PRIMARY : "transparent",
              }}
            >
              <Text
                style={{
                  fontSize: 14,
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

      {/* 샵 탭 */}
      {activeTab === "shop" &&
        (isLoading ? (
          <View
            style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
          >
            <ActivityIndicator color={PRIMARY} />
          </View>
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
                    noAddressText={t("wishlistView.noAddress")}
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
        ))}

      {/* 상품 탭 */}
      {activeTab === "product" &&
        (productLoading ? (
          <View
            style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
          >
            <ActivityIndicator color={PRIMARY} />
          </View>
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
            <View style={{ height: 1, backgroundColor: BORDER }} />
            <ScrollView
              style={{ flex: 1 }}
              refreshControl={
                <RefreshControl
                  refreshing={productLoading}
                  onRefresh={onRefresh}
                  tintColor={PRIMARY}
                />
              }
            >
              {products.map((product, index) => (
                <View key={product.id}>
                  <ProductWishCard
                    product={product}
                    isWished={wishedProductIds.includes(product.id)}
                    isPending={pendingProductIds.includes(product.id)}
                    onPress={() => onProductPress(product.id)}
                    onWishToggle={() => onProductWishToggle(product.id)}
                  />
                  {index < products.length - 1 && (
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
        ))}
    </View>
  );
}
