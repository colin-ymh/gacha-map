import { useCallback, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchShopsByBoundsAsync } from "@/store/slices/shops.slice";
import type { Bounds, ShopSummary } from "@gacha-map/shared";
import NaverMap from "@/components/organisms/map/naver-map";

export default function MapScreen() {
  const dispatch = useAppDispatch();
  const shops = useAppSelector((s) => s.shops.shops);
  const [selectedShop, setSelectedShop] = useState<ShopSummary | null>(null);

  const handleBoundsChange = useCallback(
    (bounds: Bounds) => {
      dispatch(fetchShopsByBoundsAsync(bounds));
    },
    [dispatch],
  );

  const handleShopPress = useCallback((shop: ShopSummary) => {
    setSelectedShop((prev) => (prev?.id === shop.id ? null : shop));
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <NaverMap
        shops={shops}
        selectedShopId={selectedShop?.id}
        onShopPress={handleShopPress}
        onBoundsChange={handleBoundsChange}
      />
    </SafeAreaView>
  );
}
