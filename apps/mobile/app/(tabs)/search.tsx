import { useCallback, useEffect } from "react";
import { Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { adjustWishlistCount } from "@/store/slices/shops.slice";
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
    loading,
  } = useAppSelector((s) => s.wishlist);

  useEffect(() => {
    if (isLoggedIn === true) {
      dispatch(fetchWishlistAsync());
    }
  }, [dispatch, isLoggedIn]);

  const handleRemoveWish = useCallback(
    async (shopId: string) => {
      try {
        const isCurrentlyWished = wishedShopIds.includes(shopId);
        await dispatch(
          toggleWishAndPersistAsync({ shopId, isWished: isCurrentlyWished }),
        ).unwrap();
        dispatch(
          adjustWishlistCount({
            shopId,
            delta: isCurrentlyWished ? -1 : 1,
          }),
        );
      } catch (e) {
        const msg =
          typeof e === "string"
            ? e
            : ((e as { message?: string })?.message ?? JSON.stringify(e));
        Alert.alert("찜 실패", msg);
      }
    },
    [dispatch, wishedShopIds],
  );

  const handleLoginPress = useCallback(() => {
    router.push("/login" as never);
  }, [router]);

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <SearchView
        shops={wishedShops}
        isLoggedIn={isLoggedIn ?? false}
        isLoading={loading}
        onRemoveWish={handleRemoveWish}
        onLoginPress={handleLoginPress}
      />
    </SafeAreaView>
  );
}
