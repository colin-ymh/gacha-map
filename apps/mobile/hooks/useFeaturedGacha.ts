import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { GachaProductWithShops } from "@gacha-map/shared";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";
const CACHE_KEY_DATE = "featured_gacha_date_v2";
const CACHE_KEY_ITEMS = "featured_gacha_items_v2";

function getTodayString() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

export function useFeaturedGacha() {
  const [items, setItems] = useState<GachaProductWithShops[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(false);

      const today = getTodayString();
      try {
        const [cachedDate, cachedItems] = await Promise.all([
          AsyncStorage.getItem(CACHE_KEY_DATE),
          AsyncStorage.getItem(CACHE_KEY_ITEMS),
        ]);

        if (cachedDate === today && cachedItems) {
          if (!cancelled) {
            setItems(JSON.parse(cachedItems) as GachaProductWithShops[]);
            setLoading(false);
          }
          return;
        }
      } catch {
        // cache miss — fall through to fetch
      }

      try {
        const res = await fetch(
          `${API_BASE}/api/gacha-products?has_variants=true&sort=featured&include_shops=true&limit=10`,
        );
        if (!res.ok) throw new Error("fetch_failed");
        const json = await res.json();
        const fetched = (json.products ?? []) as GachaProductWithShops[];

        await Promise.all([
          AsyncStorage.setItem(CACHE_KEY_DATE, today),
          AsyncStorage.setItem(CACHE_KEY_ITEMS, JSON.stringify(fetched)),
        ]).catch(() => {});

        if (!cancelled) setItems(fetched);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { items, loading, error };
}
