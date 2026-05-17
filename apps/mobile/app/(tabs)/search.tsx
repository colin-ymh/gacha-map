import { useCallback } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { toggleWishAndPersistAsync } from "@/store/slices/wishlist.slice";
import SearchView from "./search.view";

export default function SearchScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const isLoggedIn = useAppSelector((s) => s.auth.isLoggedIn);
  const wishedShopIds = useAppSelector((s) => s.wishlist.shopIds);
  const allShops = useAppSelector((s) => s.shops.mapShops);
  const wishedShops = allShops.filter((s) => wishedShopIds.includes(s.id));

  const handleRemoveWish = useCallback(
    (shopId: string) => {
      const isCurrentlyWished = wishedShopIds.includes(shopId);
      dispatch(
        toggleWishAndPersistAsync({ shopId, isWished: isCurrentlyWished }),
      );
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
        onRemoveWish={handleRemoveWish}
        onLoginPress={handleLoginPress}
      />
    </SafeAreaView>
  );
}
