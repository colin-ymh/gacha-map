import { useCallback, useMemo, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchShopsByBoundsAsync } from "@/store/slices/shops.slice";
import { toggleWish } from "@/store/slices/wishlist.slice";
import type { Bounds, ShopSummary } from "@gacha-map/shared";
import NaverMap from "@/components/organisms/map/naver-map";
import ShopBottomSheetView, {
  type SortType,
} from "@/components/organisms/map/shop-bottom-sheet.view";

export default function MapScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const shops = useAppSelector((s) => s.shops.shops);
  const wishedShopIds = useAppSelector((s) => s.wishlist.shopIds);
  const [selectedShop, setSelectedShop] = useState<ShopSummary | null>(null);
  const [sortType, setSortType] = useState<SortType>("latest");

  const sortedShops = useMemo(() => {
    const list = [...shops];
    switch (sortType) {
      case "name":
        return list.sort((a, b) => a.name.localeCompare(b.name, "ko"));
      case "wish":
        return list.sort(
          (a, b) => (b.wishlist_count ?? 0) - (a.wishlist_count ?? 0),
        );
      default:
        return list;
    }
  }, [shops, sortType]);

  const handleBoundsChange = useCallback(
    (bounds: Bounds) => {
      dispatch(fetchShopsByBoundsAsync(bounds));
    },
    [dispatch],
  );

  const handleShopPress = useCallback(
    (shop: ShopSummary) => {
      setSelectedShop((prev) => (prev?.id === shop.id ? null : shop));
      router.push(`/shop/${shop.id}` as never);
    },
    [router],
  );

  const handleWishToggle = useCallback(
    (shopId: string) => {
      dispatch(toggleWish(shopId));
    },
    [dispatch],
  );

  const handleSearchPress = useCallback(() => {
    // TODO: 검색 화면 이동
  }, []);

  const handleReportPress = useCallback(() => {
    router.push("/report" as never);
  }, [router]);

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <NaverMap
        shops={shops}
        selectedShopId={selectedShop?.id}
        wishedShopIds={wishedShopIds}
        onShopPress={handleShopPress}
        onBoundsChange={handleBoundsChange}
        onSearchPress={handleSearchPress}
        onReportPress={handleReportPress}
      />
      <ShopBottomSheetView
        shops={sortedShops}
        sortType={sortType}
        wishedShopIds={wishedShopIds}
        onSortChange={setSortType}
        onShopPress={handleShopPress}
        onWishToggle={handleWishToggle}
      />
    </SafeAreaView>
  );
}
