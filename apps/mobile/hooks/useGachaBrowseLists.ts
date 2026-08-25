import { useCallback, useEffect, useRef, useState } from "react";
import type {
  GachaBrowseCategoriesResponse,
  GachaBrowseCategory,
  GachaBrowseSeries,
  GachaBrowseSeriesResponse,
  GachaCategoryType,
  GachaSeriesChip,
} from "@gacha-map/shared";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

export const BROWSE_LIST_PAGE_SIZE = 20;

/**
 * 카테고리 전체 목록. 한 축이 최대 23개라 페이지네이션을 두지 않는다.
 */
export function useBrowseCategoryList(type: GachaCategoryType) {
  const [categories, setCategories] = useState<GachaBrowseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const abort = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;

    setLoading(true);
    setError(false);
    try {
      const res = await fetch(
        `${API_BASE}/api/gacha-browse/categories?type=${type}`,
        { signal: controller.signal },
      );
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as GachaBrowseCategoriesResponse;
      if (controller.signal.aborted) return;
      setCategories(json.categories);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError(true);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => () => abort.current?.abort(), []);

  return { categories, loading, error, retry: load };
}

/**
 * 시리즈 전체 목록. 칩 필터 + offset 무한 스크롤.
 *
 * 칩을 바꾸면 목록을 처음부터 다시 받는다. 서버 정렬이 칩마다 다르므로
 * 이어붙이면 순서가 깨진다.
 */
export function useBrowseSeriesList(chip: GachaSeriesChip | null) {
  const [series, setSeries] = useState<GachaBrowseSeries[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  const abort = useRef<AbortController | null>(null);
  const fetching = useRef(false);

  const fetchPage = useCallback(
    async (offset: number, signal: AbortSignal) => {
      const qs = new URLSearchParams({
        limit: String(BROWSE_LIST_PAGE_SIZE),
        offset: String(offset),
      });
      if (chip) qs.set("chip", chip);

      const res = await fetch(
        `${API_BASE}/api/gacha-browse/series?${qs.toString()}`,
        { signal },
      );
      if (!res.ok) throw new Error(String(res.status));
      return (await res.json()) as GachaBrowseSeriesResponse;
    },
    [chip],
  );

  const load = useCallback(async () => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;

    setLoading(true);
    setError(false);
    try {
      const page = await fetchPage(0, controller.signal);
      if (controller.signal.aborted) return;
      setSeries(page.series);
      setTotal(page.total);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError(true);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (fetching.current || loading) return;
    if (series.length >= total) return;

    fetching.current = true;
    setLoadingMore(true);
    const controller = new AbortController();
    try {
      const page = await fetchPage(series.length, controller.signal);
      setSeries((prev) => {
        // 서버 페이지가 겹칠 수 있으므로 id 기준으로 걸러 붙인다.
        const seen = new Set(prev.map((s) => s.series_id));
        return [...prev, ...page.series.filter((s) => !seen.has(s.series_id))];
      });
      setTotal(page.total);
    } catch {
      // 추가 로드 실패는 조용히 넘긴다. 다음 스크롤에서 다시 시도된다.
    } finally {
      fetching.current = false;
      setLoadingMore(false);
    }
  }, [fetchPage, loading, series.length, total]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => () => abort.current?.abort(), []);

  return {
    series,
    total,
    loading,
    loadingMore,
    error,
    hasMore: series.length < total,
    retry: load,
    loadMore,
  };
}
