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

/**
 * 축 하나의 선택 가능한 값 목록.
 *
 * 시트를 처음 열 때만 받아 두고 이후에는 캐시를 쓴다. 값이 자주 바뀌지 않는다.
 */
export function useBrowseAxisOptions() {
  const [options, setOptions] = useState<Record<string, AxisOption[]>>({});
  const [loading, setLoading] = useState(false);
  const inflight = useRef<Set<string>>(new Set());

  const ensure = useCallback(
    async (axis: FilterAxis) => {
      if (options[axis] || inflight.current.has(axis)) return;
      inflight.current.add(axis);
      setLoading(true);
      try {
        let next: AxisOption[];
        if (axis === "series") {
          const res = await fetch(
            `${API_BASE}/api/gacha-browse/series?limit=${SERIES_OPTION_LIMIT}`,
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
          );
          if (!res.ok) throw new Error(String(res.status));
          const json = (await res.json()) as GachaBrowseCategoriesResponse;
          next = json.categories.map((c) => ({
            id: c.category_id,
            label: c.name_ko,
            count: c.product_count,
          }));
        }
        setOptions((prev) => ({ ...prev, [axis]: next }));
      } catch {
        // 실패하면 시트가 빈 목록으로 뜬다. 닫았다 다시 열면 재시도된다.
        inflight.current.delete(axis);
      } finally {
        setLoading(false);
      }
    },
    [options],
  );

  useEffect(() => {
    const set = inflight.current;
    return () => set.clear();
  }, []);

  return { options, loading, ensure };
}
