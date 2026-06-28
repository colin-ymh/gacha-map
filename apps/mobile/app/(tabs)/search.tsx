import { useCallback, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchWishlistAsync } from "@/store/slices/wishlist.slice";
import { fetchProductWishlistAsync } from "@/store/slices/product-wishlist.slice";
import { useProductWishDebounce } from "@/hooks/useProductWishDebounce";
import { useWishDebounce } from "@/hooks/useWishDebounce";
import SearchView from "./search.view";

export default function SearchScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const isLoggedIn = useAppSelector((s) => s.auth.isLoggedIn);
  const {
    shopIds: wishedShopIds,
    shops: wishedShops,
    loading,
  } = useAppSelector((s) => s.wishlist);

  const {
    productIds: wishedProductIds,
    products: wishedProducts,
    pendingProductIds,
    loading: productLoading,
  } = useAppSelector((s) => s.productWishlist);

  const [activeTab, setActiveTab] = useState<"shop" | "product">("shop");

  const { handleWishToggle: wishDebounce } = useWishDebounce();
  const { handleProductWishToggle: productWishDebounce } =
    useProductWishDebounce();

  useFocusEffect(
    useCallback(() => {
      if (isLoggedIn === true) {
        dispatch(fetchWishlistAsync());
        dispatch(fetchProductWishlistAsync());
      }
    }, [dispatch, isLoggedIn]),
  );

  const handleWishToggle = useCallback(
    (shopId: string) => {
      wishDebounce(shopId);
    },
    [wishDebounce],
  );

  const handleRefresh = useCallback(() => {
    dispatch(fetchWishlistAsync());
    dispatch(fetchProductWishlistAsync());
  }, [dispatch]);

  const handleLoginPress = useCallback(() => {
    router.push("/login" as never);
  }, [router]);

  const handleShopPress = useCallback(
    (shopId: string) => {
      router.push(`/shop/${shopId}` as never);
    },
    [router],
  );

  const handleProductPress = useCallback(
    (productId: string) => {
      router.push(`/gacha/${productId}` as never);
    },
    [router],
  );

  const handleProductWishToggle = useCallback(
    (productId: string) => {
      productWishDebounce(productId, () => router.push("/login" as never));
    },
    [productWishDebounce, router],
  );

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <SearchView
        shops={wishedShops}
        wishedShopIds={wishedShopIds}
        isLoggedIn={isLoggedIn ?? false}
        isLoading={loading}
        onWishToggle={handleWishToggle}
        onShopPress={handleShopPress}
        onLoginPress={handleLoginPress}
        onRefresh={handleRefresh}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        products={wishedProducts}
        wishedProductIds={wishedProductIds}
        pendingProductIds={pendingProductIds}
        productLoading={productLoading}
        onProductPress={handleProductPress}
        onProductWishToggle={handleProductWishToggle}
      />
    </SafeAreaView>
  );
}
