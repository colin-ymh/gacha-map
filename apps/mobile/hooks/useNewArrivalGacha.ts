import { useState, useEffect } from "react";
import type { GachaProductWithShops } from "@gacha-map/shared";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";
const MAX_NEW_ARRIVAL_COUNT = 15;

// get_new_arrival_gacha RPC returns at most 15 items, all with images.
function isValidNewArrivals(items: unknown): items is GachaProductWithShops[] {
  return (
    Array.isArray(items) &&
    items.length > 0 &&
    items.length <= MAX_NEW_ARRIVAL_COUNT &&
    items.every(
      (i) => !!(i as { official_image_url?: string | null }).official_image_url,
    )
  );
}

export function useNewArrivalGacha() {
  const [items, setItems] = useState<GachaProductWithShops[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(false);

      try {
        // 이번 주 배치 선정/variant 유무/이미지 필터/오늘의 가챠 중복 제외는
        // 전부 서버(get_new_arrival_gacha RPC)가 결정 — 로컬 캐싱 없이 매번 fetch.
        const res = await fetch(
          `${API_BASE}/api/gacha-products?sort=new_arrivals&include_shops=true`,
        );
        if (!res.ok) throw new Error("fetch_failed");
        const body = await res.json();
        const selected = body.products as unknown;

        if (!isValidNewArrivals(selected)) {
          if (!cancelled) setItems([]);
          return;
        }

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
