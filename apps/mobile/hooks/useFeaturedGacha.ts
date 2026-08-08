import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { GachaProductWithShops } from "@gacha-map/shared";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";
const CACHE_KEY_DATE = "featured_gacha_date_v4";
const CACHE_KEY_ITEMS = "featured_gacha_items_v4";
const MAX_FEATURED_COUNT = 10;

function getTodayKST() {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

// get_daily_featured_gacha RPC always returns <= 10 items, all with images.
// A larger or image-less batch means the response came from a stale/incorrect
// route (e.g. deploy-lag), and must not be trusted or cached — see 2.0.1 bug
// where such a response got frozen in AsyncStorage for a full day.
function isValidFeatured(items: unknown): items is GachaProductWithShops[] {
  return (
    Array.isArray(items) &&
    items.length > 0 &&
    items.length <= MAX_FEATURED_COUNT &&
    items.every(
      (i) => !!(i as { official_image_url?: string | null }).official_image_url,
    )
  );
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
          const parsed = JSON.parse(cachedItems) as unknown;
          if (isValidFeatured(parsed)) {
            if (!cancelled) {
              setItems(parsed);
              setLoading(false);
            }
            return;
          }
          // Invalid cache (e.g. frozen from a stale route response) — fall
          // through and refetch instead of trusting it for the rest of today.
        }
      } catch { /* cache miss */ }

      try {
        // 오늘의 가챠 선정/순서/최근 7일 후순위/이미지 필터는 전부 서버
        // (get_daily_featured_gacha RPC)가 결정 — 모든 사용자에게 동일한 결과.
        const res = await fetch(
          `${API_BASE}/api/gacha-products?sort=featured&include_shops=true`,
        );
        if (!res.ok) throw new Error("fetch_failed");
        const selected = (await res.json()).products as unknown;

        if (!isValidFeatured(selected)) {
          throw new Error("invalid_featured_response");
        }

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
