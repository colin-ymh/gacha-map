import { useCallback } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { toggleWish } from "@/store/slices/wishlist.slice";
import SearchView from "./search.view";

export default function SearchScreen() {
  const dispatch = useAppDispatch();
  const wishedShopIds = useAppSelector((s) => s.wishlist.shopIds);
  const allShops = useAppSelector((s) => s.shops.shops);
  const wishedShops = allShops.filter((s) => wishedShopIds.includes(s.id));

  const handleRemoveWish = useCallback(
    (shopId: string) => {
      dispatch(toggleWish(shopId));
    },
    [dispatch],
  );

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <SearchView shops={wishedShops} onRemoveWish={handleRemoveWish} />
    </SafeAreaView>
  );
}
