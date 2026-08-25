import { useCallback, useEffect, useRef, useState } from "react";
import type {
  GachaBrowseProductsResponse,
  GachaBrowseSort,
  GachaProductWithShops,
} from "@gacha-map/shared";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

export const BROWSE_PRODUCT_PAGE_SIZE = 20;

export interface BrowseProductsQuery {
  /** 진입 축이 카테고리일 때 */
  categoryId?: string;
  /** 진입 축이 시리즈일 때 */
  seriesId?: string;
  /** 드롭다운으로 고른 카테고리. 축 안 OR / 축 간 AND 는 서버가 처리한다. */
  filterCategoryIds?: string[];
  filterSeriesIds?: string[];
  sort: GachaBrowseSort;
}

function buildQuery(q: BrowseProductsQuery, offset: number) {
  const qs = new URLSearchParams({
    limit: String(BROWSE_PRODUCT_PAGE_SIZE),
    offset: String(offset),
    sort: q.sort,
  });
  if (q.categoryId) qs.set("categoryId", q.categoryId);
  if (q.seriesId) qs.set("seriesId", q.seriesId);
  if (q.filterCategoryIds?.length)
    qs.set("filterCategoryIds", q.filterCategoryIds.join(","));
  if (q.filterSeriesIds?.length)
    qs.set("filterSeriesIds", q.filterSeriesIds.join(","));
  return qs.toString();
}

/**
 * 카테고리·시리즈별 상품 목록. 기획서 §5 / §7 / §17.
 *
 * 필터나 정렬이 바뀌면 offset 을 0으로 되돌리고 처음부터 다시 받는다.
 * 이어붙이면 순서가 섞인다.
 */
export function useBrowseProducts(query: BrowseProductsQuery) {
  const [products, setProducts] = useState<GachaProductWithShops[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  const abort = useRef<AbortController | null>(null);
  const fetching = useRef(false);

  // 객체 참조가 매 렌더 바뀌므로 값 기준 키로 비교한다.
  const key = buildQuery(query, 0);

  const load = useCallback(async () => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;

    setLoading(true);
    setError(false);
    try {
      const res = await fetch(
        `${API_BASE}/api/gacha-browse/products?${key}`,
        { signal: controller.signal },
      );
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as GachaBrowseProductsResponse;
      if (controller.signal.aborted) return;
      setProducts(json.products);
      setTotal(json.total);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError(true);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [key]);

  const loadMore = useCallback(async () => {
    if (fetching.current || loading) return;
    if (products.length >= total) return;

    fetching.current = true;
    setLoadingMore(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/gacha-browse/products?${buildQuery(query, products.length)}`,
      );
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as GachaBrowseProductsResponse;
      setProducts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...json.products.filter((p) => !seen.has(p.id))];
      });
      setTotal(json.total);
    } catch {
      // 추가 로드 실패는 조용히 넘긴다. 다음 스크롤에서 재시도된다.
    } finally {
      fetching.current = false;
      setLoadingMore(false);
    }
  }, [loading, products.length, query, total]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => () => abort.current?.abort(), []);

  return {
    products,
    total,
    loading,
    loadingMore,
    error,
    hasMore: products.length < total,
    retry: load,
    loadMore,
  };
}
