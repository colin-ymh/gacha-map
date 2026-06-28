import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const RECENT_GACHA_KEY = "@gacha_map/recent_gacha";
const MAX = 10;

export type RecentGacha = {
  id: string;
  name: string;
  imageUrl?: string;
};

export function useRecentGacha() {
  const [recentGacha, setRecentGacha] = useState<RecentGacha[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(() => {
    AsyncStorage.getItem(RECENT_GACHA_KEY).then((raw) => {
      setRecentGacha(raw ? JSON.parse(raw) : []);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const reload = useCallback(() => {
    AsyncStorage.getItem(RECENT_GACHA_KEY).then((raw) => {
      setRecentGacha(raw ? JSON.parse(raw) : []);
    });
  }, []);

  const addGacha = useCallback(
    (item: RecentGacha) => {
      if (!loaded) return;
      setRecentGacha((prev) => {
        const next = [item, ...prev.filter((g) => g.id !== item.id)].slice(
          0,
          MAX,
        );
        AsyncStorage.setItem(RECENT_GACHA_KEY, JSON.stringify(next));
        return next;
      });
    },
    [loaded],
  );

  const removeGacha = useCallback(
    (id: string) => {
      if (!loaded) return;
      setRecentGacha((prev) => {
        const next = prev.filter((g) => g.id !== id);
        AsyncStorage.setItem(RECENT_GACHA_KEY, JSON.stringify(next));
        return next;
      });
    },
    [loaded],
  );

  return { recentGacha, addGacha, removeGacha, reload };
}
