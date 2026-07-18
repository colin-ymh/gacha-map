import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const HISTORY_KEY = "@gacha_map/recent_history";
const MAX = 20;

export type RecentItem =
  | { type: "query"; q: string; ts: number }
  | { type: "shop"; id: string; name: string; address?: string; ts: number }
  | { type: "gacha"; id: string; name: string; imageUrl?: string; ts: number };

function itemKey(item: RecentItem): string {
  if (item.type === "query") return `query:${item.q}`;
  return `${item.type}:${item.id}`;
}

export function useRecentHistory() {
  const [items, setItems] = useState<RecentItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(() => {
    AsyncStorage.getItem(HISTORY_KEY).then((raw) => {
      setItems(raw ? JSON.parse(raw) : []);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const reload = useCallback(() => {
    AsyncStorage.getItem(HISTORY_KEY).then((raw) => {
      setItems(raw ? JSON.parse(raw) : []);
    });
  }, []);

  const _upsert = useCallback(
    (item: RecentItem) => {
      if (!loaded) return;
      setItems((prev) => {
        const key = itemKey(item);
        const next = [item, ...prev.filter((x) => itemKey(x) !== key)].slice(0, MAX);
        AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
        return next;
      });
    },
    [loaded],
  );

  const addQuery = useCallback(
    (q: string) => _upsert({ type: "query", q, ts: Date.now() }),
    [_upsert],
  );

  const addShop = useCallback(
    (shop: { id: string; name: string; address?: string }) =>
      _upsert({ type: "shop", ...shop, ts: Date.now() }),
    [_upsert],
  );

  const addGacha = useCallback(
    (gacha: { id: string; name: string; imageUrl?: string }) =>
      _upsert({ type: "gacha", ...gacha, ts: Date.now() }),
    [_upsert],
  );

  const remove = useCallback(
    (item: RecentItem) => {
      if (!loaded) return;
      const key = itemKey(item);
      setItems((prev) => {
        const next = prev.filter((x) => itemKey(x) !== key);
        AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
        return next;
      });
    },
    [loaded],
  );

  const clearAll = useCallback(() => {
    if (!loaded) return;
    setItems([]);
    AsyncStorage.removeItem(HISTORY_KEY);
  }, [loaded]);

  return { items, addQuery, addShop, addGacha, remove, clearAll, reload };
}
