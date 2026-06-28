import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const RECENT_SHOPS_KEY = "@gacha_map/recent_shops";
const MAX = 10;

export type RecentShop = { id: string; name: string; address?: string };

export function useRecentShops() {
  const [recentShops, setRecentShops] = useState<RecentShop[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(() => {
    AsyncStorage.getItem(RECENT_SHOPS_KEY).then((raw) => {
      setRecentShops(raw ? JSON.parse(raw) : []);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const reload = useCallback(() => {
    AsyncStorage.getItem(RECENT_SHOPS_KEY).then((raw) => {
      setRecentShops(raw ? JSON.parse(raw) : []);
    });
  }, []);

  const addShop = useCallback(
    (shop: RecentShop) => {
      if (!loaded) return;
      setRecentShops((prev) => {
        const next = [shop, ...prev.filter((s) => s.id !== shop.id)].slice(
          0,
          MAX,
        );
        AsyncStorage.setItem(RECENT_SHOPS_KEY, JSON.stringify(next));
        return next;
      });
    },
    [loaded],
  );

  const removeShop = useCallback(
    (id: string) => {
      if (!loaded) return;
      setRecentShops((prev) => {
        const next = prev.filter((s) => s.id !== id);
        AsyncStorage.setItem(RECENT_SHOPS_KEY, JSON.stringify(next));
        return next;
      });
    },
    [loaded],
  );

  return { recentShops, addShop, removeShop, reload };
}
