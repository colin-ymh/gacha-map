import { useCallback, useEffect, useRef, useState } from "react";
import type {
  GachaBrowseCategoriesResponse,
  GachaBrowseCategory,
  GachaBrowseSeries,
  GachaBrowseSeriesResponse,
} from "@gacha-map/shared";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

/** 탐색 진입 화면의 각 섹션에 노출하는 개수. 기획서 §3-3. */
export const BROWSE_SECTION_SIZE = 8;

export interface GachaBrowseData {
  productTypes: GachaBrowseCategory[];
  subjects: GachaBrowseCategory[];
  genres: GachaBrowseCategory[];
  popularSeries: GachaBrowseSeries[];
}

const EMPTY: GachaBrowseData = {
  productTypes: [],
  subjects: [],
  genres: [],
  popularSeries: [],
};

/**
 * 검색 오버레이 가챠 탭의 둘러보기 섹션 데이터.
 *
 * 네 섹션(상품 종류 / 소재 / 장르 / 인기 시리즈)을 한 번에 받는다. 값이 자주 바뀌지
 * 않으므로 훅 인스턴스 수명 동안 한 번만 요청하고, 실패했을 때만 다시 시도한다.
 */
export function useGachaBrowse(enabled: boolean) {
  const [data, setData] = useState<GachaBrowseData>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const loaded = useRef(false);
  const abort = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;

    setLoading(true);
    setError(false);

    try {
      const get = async <T>(path: string): Promise<T> => {
        const res = await fetch(`${API_BASE}${path}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`${path} ${res.status}`);
        return (await res.json()) as T;
      };

      const [productTypes, subjects, genres, series] = await Promise.all([
        get<GachaBrowseCategoriesResponse>(
          "/api/gacha-browse/categories?type=product_type",
        ),
        get<GachaBrowseCategoriesResponse>(
          "/api/gacha-browse/categories?type=subject",
        ),
        get<GachaBrowseCategoriesResponse>(
          "/api/gacha-browse/categories?type=genre",
        ),
        get<GachaBrowseSeriesResponse>(
          `/api/gacha-browse/series?limit=${BROWSE_SECTION_SIZE}`,
        ),
      ]);

      if (controller.signal.aborted) return;

      setData({
        productTypes: productTypes.categories.slice(0, BROWSE_SECTION_SIZE),
        subjects: subjects.categories.slice(0, BROWSE_SECTION_SIZE),
        genres: genres.categories.slice(0, BROWSE_SECTION_SIZE),
        popularSeries: series.series,
      });
      loaded.current = true;
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError(true);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled || loaded.current) return;
    void load();
  }, [enabled, load]);

  useEffect(() => () => abort.current?.abort(), []);

  return { data, loading, error, retry: load };
}
