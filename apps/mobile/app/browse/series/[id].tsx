import React, { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import type { GachaBrowseSeriesResponse } from "@gacha-map/shared";
import { BrowseProductList } from "@/components/organisms/browse/BrowseProductList";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

/**
 * 시리즈별 상품 목록. 기획서 §7.
 *
 * 부모 시리즈로 들어오면 자손 상품까지 포함한다(§7-3). 서버 기본값이 true 라
 * 여기서 따로 넘기지 않는다.
 *
 * 제목은 루트 목록에서 id 로 찾는다. 자식 시리즈로 직접 들어온 경우 루트 목록에
 * 없어 제목이 비는데, 지금은 자식으로 가는 진입 경로가 없어 문제되지 않는다.
 * 하위 시리즈 칩을 붙일 때 부모 id 로 한 번 더 조회하도록 고쳐야 한다.
 */
export default function BrowseSeriesProductsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [name, setName] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/gacha-browse/series?limit=100`,
        );
        if (!res.ok) return;
        const json = (await res.json()) as GachaBrowseSeriesResponse;
        if (cancelled) return;
        const found = json.series.find((s) => s.series_id === id);
        if (found) setName(found.name_ko);
      } catch {
        // 제목이 비는 것 외에 영향이 없다.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return <BrowseProductList title={name} query={{ seriesId: id }} />;
}
