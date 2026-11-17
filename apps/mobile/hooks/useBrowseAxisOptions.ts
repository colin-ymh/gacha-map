import { useCallback, useEffect, useRef, useState } from "react";
import type {
  GachaBrowseCategoriesResponse,
  GachaBrowseSeriesResponse,
} from "@gacha-map/shared";
import type { AxisOption } from "@/components/organisms/browse/AxisPickerSheet";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

/** 필터 드롭다운에 쓰는 축. 진입 축은 여기서 제외된다. 기획서 §17-3. */
export type FilterAxis = "product_type" | "subject" | "genre" | "series";

export const AXIS_LABEL: Record<FilterAxis, { key: string; fallback: string }> =
  {
    product_type: { key: "browse.axis.productType", fallback: "상품 종류" },
    subject: { key: "browse.axis.subject", fallback: "소재" },
    genre: { key: "browse.axis.genre", fallback: "장르" },
    series: { key: "browse.axis.series", fallback: "시리즈" },
  };

/** 시리즈 축 드롭다운에 띄우는 최대 개수. 상위 노출 시리즈만 고르게 한다. */
const SERIES_OPTION_LIMIT = 100;

/** 축별 옵션을 미리 불러오고, 상세 화면을 떠날 때까지 재사용한다. */
export function useBrowseAxisOptions() {
  const [options, setOptions] = useState<
    Partial<Record<FilterAxis, AxisOption[]>>
  >({});
  const [failed, setFailed] = useState<Partial<Record<FilterAxis, boolean>>>({});
  const loaded = useRef(new Set<FilterAxis>());
  const inflight = useRef(new Map<FilterAxis, AbortController>());

  const ensure = useCallback(async (axis: FilterAxis) => {
    if (loaded.current.has(axis) || inflight.current.has(axis)) return;
    const controller = new AbortController();
    inflight.current.set(axis, controller);
    const { signal } = controller;
    setFailed((prev) => (prev[axis] ? { ...prev, [axis]: false } : prev));
    try {
      let next: AxisOption[];
      if (axis === "series") {
        const res = await fetch(
          `${API_BASE}/api/gacha-browse/series?limit=${SERIES_OPTION_LIMIT}`,
          { signal },
        );
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as GachaBrowseSeriesResponse;
        next = json.series.map((s) => ({
          id: s.series_id,
          label: s.name_ko,
          count: s.rollup_product_count,
        }));
      } else {
        const res = await fetch(
          `${API_BASE}/api/gacha-browse/categories?type=${axis}`,
          { signal },
        );
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as GachaBrowseCategoriesResponse;
        next = json.categories.map((c) => ({
          id: c.category_id,
          label: c.name_ko,
          count: c.product_count,
        }));
      }
      if (!signal.aborted) {
        loaded.current.add(axis);
        setOptions((prev) => ({ ...prev, [axis]: next }));
      }
    } catch {
      if (!signal.aborted) setFailed((prev) => ({ ...prev, [axis]: true }));
    } finally {
      if (inflight.current.get(axis) === controller) {
        inflight.current.delete(axis);
      }
    }
  }, []);

  useEffect(() => {
    const requests = inflight.current;
    return () => {
      requests.forEach((controller) => controller.abort());
      requests.clear();
    };
  }, []);

  return { options, failed, ensure };
}
