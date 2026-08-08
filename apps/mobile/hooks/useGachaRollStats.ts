import { useEffect, useState } from "react";
import { getAuthHeaders } from "@/lib/supabase";
import type { GachaRollStats } from "@gacha-map/shared";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

const EMPTY_STATS: GachaRollStats = {
  totalCount: 0,
  todayCount: 0,
  variantStats: [],
};

export function useGachaRollStats(productId: string, isLoggedIn: boolean) {
  const [stats, setStats] = useState<GachaRollStats>(EMPTY_STATS);

  useEffect(() => {
    if (!isLoggedIn || !productId) {
      setStats(EMPTY_STATS);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(
          `${API_BASE}/api/gacha-products/${productId}/roll-stats`,
          { headers },
        );
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as GachaRollStats;
        if (!cancelled) setStats(json);
      } catch {
        // keep previous stats on failure
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [productId, isLoggedIn]);

  return { stats, setStats };
}
