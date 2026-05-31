import { useCallback, useEffect } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchWishlistAsync } from "@/store/slices/wishlist.slice";
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

  const { handleWishToggle: wishDebounce } = useWishDebounce();

  useEffect(() => {
    if (isLoggedIn === true) {
      dispatch(fetchWishlistAsync());
    }
  }, [dispatch, isLoggedIn]);

  const handleWishToggle = useCallback(
    (shopId: string) => {
      wishDebounce(shopId);
    },
    [wishDebounce],
  );

  const handleRefresh = useCallback(() => {
    dispatch(fetchWishlistAsync());
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
      />
    </SafeAreaView>
  );
}
