import { useState, useEffect } from "react";
import type { GachaProductWithShops } from "@gacha-map/shared";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

export function useFeaturedGacha() {
  const [items, setItems] = useState<GachaProductWithShops[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetch_() {
      setLoading(true);
      setError(false);
      try {
        const res = await fetch(
          `${API_BASE}/api/gacha-products?has_variants=true&sort=featured&include_shops=true&limit=20`,
        );
        if (!res.ok) throw new Error("fetch_failed");
        const json = await res.json();
        if (!cancelled) {
          setItems((json.products ?? []) as GachaProductWithShops[]);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetch_();
    return () => {
      cancelled = true;
    };
  }, []);

  return { items, loading, error };
}
