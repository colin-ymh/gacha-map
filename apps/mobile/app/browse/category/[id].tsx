import React, { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import type { GachaBrowseCategory } from "@gacha-map/shared";
import { BrowseProductList } from "@/components/organisms/browse/BrowseProductList";
import type { FilterAxis } from "@/hooks/useBrowseAxisOptions";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

/**
 * 카테고리별 상품 목록. 기획서 §5.
 *
 * 헤더 제목에 카테고리명이 필요한데 목록 API 는 이름을 돌려주지 않는다.
 * 3축 목록을 받아 id 로 찾는다. 축이 최대 23개라 부담이 없고, 어느 축인지
 * 몰라도 되므로 진입 경로를 단순하게 유지할 수 있다.
 */
export default function BrowseCategoryProductsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [details, setDetails] = useState<{
    id: string;
    title: string;
    axis: FilterAxis;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    void (async () => {
      let title = "";
      let axis: FilterAxis = "product_type";
      try {
        const res = await fetch(`${API_BASE}/api/gacha-browse/categories`, {
          signal,
        });
        if (!res.ok) return;
        const json = (await res.json()) as {
          categories: GachaBrowseCategory[];
        };
        const found = json.categories.find((c) => c.category_id === id);
        if (found) {
          title = found.name_ko;
          axis = found.category_type as FilterAxis;
        }
      } catch {
        // 제목이 비는 것 외에 영향이 없다. 목록은 그대로 뜬다.
      } finally {
        if (!signal.aborted) setDetails({ id, title, axis });
      }
    })();
    return () => controller.abort();
  }, [id]);

  const currentDetails = details?.id === id ? details : null;
  return (
    <BrowseProductList
      title={currentDetails?.title ?? ""}
      titleLoading={currentDetails == null}
      entryAxis={currentDetails?.axis ?? null}
      query={{ categoryId: id }}
    />
  );
}
