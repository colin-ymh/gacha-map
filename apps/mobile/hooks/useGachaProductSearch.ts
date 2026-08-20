import { useCallback, useEffect, useRef, useState } from "react";
import type {
  GachaProductWithShops,
  GachaSearchAppliedAlias,
} from "@gacha-map/shared";
import { setBounded } from "@/lib/bounded-cache";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

export const GACHA_SEARCH_PAGE_SIZE = 20;

const CACHE_LIMIT = 30;

interface CacheEntry {
  /** 화면에 뿌리는 목록(중복 id 제거 후) */
  products: GachaProductWithShops[];
  /** 서버에서 실제로 받아온 행 수 — 다음 offset 계산용 (중복 제거로 products와 어긋날 수 있다) */
  fetched: number;
  /** 서버가 알려준 전체 건수 */
  total: number;
  /** 검색어가 확장된 별칭 (예: 먼작귀 → 치이카와). 없으면 빈 배열 */
  appliedAliases: GachaSearchAppliedAlias[];
}

/**
 * 가챠 상품 검색 + offset 기반 무한 스크롤.
 * 홈/지도 SearchOverlay와 shop-search 화면이 같은 로직을 세 번 복제하고 있어 하나로 합쳤다.
 */
export function useGachaProductSearch() {
  const [results, setResults] = useState<GachaProductWithShops[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [appliedAliases, setAppliedAliases] = useState<GachaSearchAppliedAlias[]>(
    [],
  );

  const cache = useRef<Map<string, CacheEntry>>(new Map());
  const abort = useRef<AbortController | null>(null);
  /** 현재 화면에 떠 있는 검색어 (소문자 = 캐시 키) */
  const activeKey = useRef("");
  /** 원문 검색어 — 요청에는 소문자가 아니라 이 값을 쓴다 */
  const activeQuery = useRef("");
  const fetchingMore = useRef(false);

  const fetchPage = useCallback(
    async (query: string, offset: number): Promise<CacheEntry> => {
      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;

      const res = await fetch(
        `${API_BASE}/api/gacha-products?q=${encodeURIComponent(query)}` +
          `&include_shops=true&limit=${GACHA_SEARCH_PAGE_SIZE}&offset=${offset}`,
        { signal: controller.signal },
      );
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      const products: GachaProductWithShops[] = data.products ?? [];
      const total =
        typeof data.total === "number" ? data.total : offset + products.length;
      const appliedAliases: GachaSearchAppliedAlias[] = Array.isArray(
        data.applied_aliases,
      )
        ? data.applied_aliases
        : [];
      return { products, fetched: products.length, total, appliedAliases };
    },
    [],
  );

  /** 디바운스 대기 중에도 스켈레톤을 띄우고 싶을 때 호출 */
  const beginPending = useCallback(() => {
    setLoading(true);
  }, []);

  const search = useCallback(
    async (raw: string) => {
      const query = raw.trim();
      const key = query.toLowerCase();
      if (!query) {
        activeKey.current = "";
        activeQuery.current = "";
        setResults([]);
        setHasMore(false);
        setAppliedAliases([]);
        setLoading(false);
        return;
      }

      activeKey.current = key;
      activeQuery.current = query;

      const cached = cache.current.get(key);
      if (cached) {
        setResults(cached.products);
        setHasMore(cached.fetched < cached.total);
        setAppliedAliases(cached.appliedAliases);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const page = await fetchPage(query, 0);
        if (activeKey.current !== key) return;
        setBounded(cache.current, key, page, CACHE_LIMIT);
        setResults(page.products);
        setHasMore(page.fetched > 0 && page.fetched < page.total);
        setAppliedAliases(page.appliedAliases);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        if (activeKey.current !== key) return;
        setResults([]);
        setHasMore(false);
        setAppliedAliases([]);
      } finally {
        if (activeKey.current === key) setLoading(false);
      }
    },
    [fetchPage],
  );

  const loadMore = useCallback(async () => {
    const key = activeKey.current;
    const query = activeQuery.current;
    if (!key || fetchingMore.current) return;

    const entry = cache.current.get(key);
    if (!entry || entry.fetched >= entry.total) return;

    fetchingMore.current = true;
    setLoadingMore(true);
    try {
      const page = await fetchPage(query, entry.fetched);
      if (activeKey.current !== key) return;

      const seen = new Set(entry.products.map((p) => p.id));
      const merged: CacheEntry = {
        products: [
          ...entry.products,
          ...page.products.filter((p) => !seen.has(p.id)),
        ],
        fetched: entry.fetched + page.fetched,
        total: page.total,
        // 별칭은 질의어에만 의존하므로 첫 페이지 값을 그대로 유지한다.
        appliedAliases: entry.appliedAliases,
      };
      setBounded(cache.current, key, merged, CACHE_LIMIT);
      setResults(merged.products);
      // 빈 페이지가 오면 total이 어긋난 것이므로 더 조르지 않는다
      setHasMore(page.fetched > 0 && merged.fetched < merged.total);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      if (activeKey.current === key) setHasMore(false);
    } finally {
      fetchingMore.current = false;
      setLoadingMore(false);
    }
  }, [fetchPage]);

  /** 검색 종료/입력 초기화 시 호출 — 진행 중 요청도 취소한다 */
  const clear = useCallback(() => {
    abort.current?.abort();
    activeKey.current = "";
    activeQuery.current = "";
    fetchingMore.current = false;
    setResults([]);
    setHasMore(false);
    setAppliedAliases([]);
    setLoading(false);
    setLoadingMore(false);
  }, []);

  useEffect(() => {
    return () => {
      abort.current?.abort();
    };
  }, []);

  return {
    results,
    /**
     * 적용된 별칭. UI 노출은 기획서/디자인 확정 후 별도 작업이며,
     * 지금은 API 계약만 훅까지 연결해 둔다.
     */
    appliedAliases,
    loading,
    loadingMore,
    hasMore,
    search,
    loadMore,
    clear,
    beginPending,
  };
}
