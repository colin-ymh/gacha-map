import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { GachaProductWithShops } from "@gacha-map/shared";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";
const CACHE_KEY_DATE = "featured_gacha_date_v3";
const CACHE_KEY_ITEMS = "featured_gacha_items_v3";

function getTodayKST() {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
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

      const today = getTodayKST();

      // 오늘 캐시 있으면 바로 사용 (서버가 어차피 같은 날엔 동일 리스트를 주지만,
      // 매 진입마다 네트워크 왕복 없이 즉시 렌더하기 위한 로컬 캐시)
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
      } catch { /* cache miss */ }

      try {
        // 오늘의 가챠 선정/순서/최근 7일 후순위/이미지 필터는 전부 서버
        // (get_daily_featured_gacha RPC)가 결정 — 모든 사용자에게 동일한 결과.
        const res = await fetch(
          `${API_BASE}/api/gacha-products?sort=featured&include_shops=true`,
        );
        if (!res.ok) throw new Error("fetch_failed");
        const selected = ((await res.json()).products ??
          []) as GachaProductWithShops[];

        await Promise.all([
          AsyncStorage.setItem(CACHE_KEY_DATE, today),
          AsyncStorage.setItem(CACHE_KEY_ITEMS, JSON.stringify(selected)),
        ]).catch(() => {});

        if (!cancelled) setItems(selected);
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
