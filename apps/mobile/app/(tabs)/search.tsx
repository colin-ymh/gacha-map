import { useCallback, useEffect } from "react";
import { Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchWishlistAsync,
  toggleWishAndPersistAsync,
} from "@/store/slices/wishlist.slice";
import SearchView from "./search.view";

export default function SearchScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const isLoggedIn = useAppSelector((s) => s.auth.isLoggedIn);
  const {
    shopIds: wishedShopIds,
    shops: wishedShops,
    pendingShopIds: pendingWishShopIds,
    loading,
  } = useAppSelector((s) => s.wishlist);

  useEffect(() => {
    if (isLoggedIn === true) {
      dispatch(fetchWishlistAsync());
    }
  }, [dispatch, isLoggedIn]);

  const handleWishToggle = useCallback(
    async (shopId: string) => {
      try {
        if (pendingWishShopIds.includes(shopId)) return;
        const isCurrentlyWished = wishedShopIds.includes(shopId);
        await dispatch(
          toggleWishAndPersistAsync({ shopId, isWished: isCurrentlyWished }),
        ).unwrap();
      } catch (e) {
        const msg =
          typeof e === "string"
            ? e
            : ((e as { message?: string })?.message ?? JSON.stringify(e));
        Alert.alert("찜 실패", msg);
      }
    },
    [dispatch, pendingWishShopIds, wishedShopIds],
  );

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
      />
    </SafeAreaView>
  );
}
