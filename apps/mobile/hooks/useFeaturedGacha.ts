import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { GachaProductWithShops } from "@gacha-map/shared";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";
const CACHE_KEY_DATE  = "featured_gacha_date_v2";
const CACHE_KEY_ITEMS = "featured_gacha_items_v2";
const CACHE_KEY_HIST  = "featured_gacha_history_v1"; // { [id]: "YYYY-MM-DD" }

const EXCLUDE_DAYS = 7;
const PICK_COUNT   = 10;

function getTodayKST() {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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

      // 오늘 캐시 있으면 바로 사용
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
        const res = await fetch(
          `${API_BASE}/api/gacha-products?has_variants=true&sort=featured&include_shops=true&limit=50`,
        );
        if (!res.ok) throw new Error("fetch_failed");
        const pool = ((await res.json()).products ?? []) as GachaProductWithShops[];

        // 히스토리 로드 + 7일 이상 오래된 항목 정리
        let history: Record<string, string> = {};
        try {
          const raw = await AsyncStorage.getItem(CACHE_KEY_HIST);
          if (raw) history = JSON.parse(raw) as Record<string, string>;
        } catch { /* ignore */ }

        const cutoff = getTodayKST(); // 오늘보다 EXCLUDE_DAYS 전
        const cutoffDate = new Date(Date.now() + 9 * 60 * 60 * 1000);
        cutoffDate.setDate(cutoffDate.getDate() - EXCLUDE_DAYS);
        const cutoffStr = cutoffDate.toISOString().slice(0, 10);

        // 오래된 히스토리 삭제
        for (const id of Object.keys(history)) {
          if (history[id] < cutoffStr) delete history[id];
        }

        // 7일 이내 노출된 항목 제외
        const fresh = pool.filter((p) => !history[p.id]);

        // fresh가 부족하면 히스토리 오래된 순으로 보충
        let candidates: GachaProductWithShops[];
        if (fresh.length >= PICK_COUNT) {
          candidates = fresh;
        } else {
          const stale = pool
            .filter((p) => history[p.id])
            .sort((a, b) => (history[a.id] < history[b.id] ? -1 : 1));
          candidates = [...fresh, ...stale];
        }

        const selected = shuffle(candidates).slice(0, PICK_COUNT);

        // 히스토리에 오늘 날짜 기록
        for (const item of selected) history[item.id] = today;

        await Promise.all([
          AsyncStorage.setItem(CACHE_KEY_DATE, today),
          AsyncStorage.setItem(CACHE_KEY_ITEMS, JSON.stringify(selected)),
          AsyncStorage.setItem(CACHE_KEY_HIST, JSON.stringify(history)),
        ]).catch(() => {});

        if (!cancelled) setItems(selected);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { items, loading, error };
}
