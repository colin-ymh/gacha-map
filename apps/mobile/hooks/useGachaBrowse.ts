import { useCallback, useEffect, useRef, useState } from "react";
import type {
  GachaBrowseSeries,
  GachaBrowseSeriesResponse,
} from "@gacha-map/shared";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

/** 둘러보기 화면 시리즈 섹션에 노출하는 개수. 기획서 §3-3. */
export const BROWSE_SECTION_SIZE = 8;

/**
 * 둘러보기 화면의 인기 시리즈 미리보기.
 *
 * 상품 종류/소재/장르는 축마다 최대 23개뿐이라 useBrowseCategoryList 로 항상 전체를
 * 받는다. 시리즈는 261개로 너무 많아 미리보기만 여기서 받고, 전체는 별도 화면(§7)에서 본다.
 */
export function useGachaBrowse(enabled: boolean) {
  const [series, setSeries] = useState<GachaBrowseSeries[]>([]);
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
      const res = await fetch(
        `${API_BASE}/api/gacha-browse/series?limit=${BROWSE_SECTION_SIZE}`,
        { signal: controller.signal },
      );
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as GachaBrowseSeriesResponse;
      if (controller.signal.aborted) return;

      setSeries(json.series);
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

  return { series, loading, error, retry: load };
}
