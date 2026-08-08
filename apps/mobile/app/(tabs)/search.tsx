import { useCallback, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { GRAY_100 } from "@/constants/colors";
import { useFocusEffect, useRouter } from "expo-router";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchWishlistAsync } from "@/store/slices/wishlist.slice";
import { fetchProductWishlistAsync } from "@/store/slices/product-wishlist.slice";
import { useProductWishDebounce } from "@/hooks/useProductWishDebounce";
import { useWishDebounce } from "@/hooks/useWishDebounce";
import LoginModal from "@/components/ui/LoginModal";
import SearchView from "./search.view";

export default function SearchScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const isLoggedIn = useAppSelector((s) => s.auth.isLoggedIn);
  const {
    shopIds: wishedShopIds,
    shops: wishedShops,
    loading,
    hasFetched: shopHasFetched,
    isDirty: shopIsDirty,
  } = useAppSelector((s) => s.wishlist);

  const {
    productIds: wishedProductIds,
    products: wishedProducts,
    pendingProductIds,
    loading: productLoading,
    hasFetched: productHasFetched,
    isDirty: productIsDirty,
  } = useAppSelector((s) => s.productWishlist);

  const [activeTab, setActiveTab] = useState<"shop" | "product">("shop");
  const [showLoginModal, setShowLoginModal] = useState(false);

  const { handleWishToggle: wishDebounce } = useWishDebounce();
  const { handleProductWishToggle: productWishDebounce } =
    useProductWishDebounce();

  useFocusEffect(
    useCallback(() => {
      if (isLoggedIn === true) {
        if (!shopHasFetched) dispatch(fetchWishlistAsync());
        if (!productHasFetched) dispatch(fetchProductWishlistAsync());
      }
    }, [dispatch, isLoggedIn, shopHasFetched, productHasFetched]),
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
      productWishDebounce(productId, () => setShowLoginModal(true));
    },
    [productWishDebounce],
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: GRAY_100 }} edges={["top"]}>
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
