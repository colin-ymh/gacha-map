import React, { useCallback } from "react";
import { useRouter } from "expo-router";
import type { GachaBrowseCategory, GachaBrowseSeries } from "@gacha-map/shared";
import BrowseView from "./browse.view";

/**
 * 둘러보기 탭.
 *
 * 노션 「가챠 카테고리·시리즈 탐색 기획」 §3.
 *
 * 처음에는 검색 오버레이의 빈 상태에 붙였는데, 검색을 열고 탭을 바꾸고 검색어를
 * 비워야 닿는 자리라 사실상 발견되지 않았다. 탐색은 검색의 부수 상태가 아니라
 * 독립 목적지이므로 하단 탭으로 분리한다.
 */
export default function BrowseScreen() {
  const router = useRouter();

  const handleCategoryPress = useCallback(
    (category: GachaBrowseCategory) => {
      router.push(`/browse/category/${category.category_id}`);
    },
    [router],
  );

  const handleSeriesPress = useCallback(
    (series: GachaBrowseSeries) => {
      router.push(`/browse/series/${series.series_id}`);
    },
    [router],
  );

  const handleMoreCategories = useCallback(
    (type: "product_type" | "subject" | "genre") => {
      router.push(`/browse/categories?type=${type}`);
    },
    [router],
  );

  const handleMoreSeries = useCallback(() => {
    router.push("/browse/series");
  }, [router]);

  return (
    <BrowseView
      onCategoryPress={handleCategoryPress}
      onSeriesPress={handleSeriesPress}
      onMoreCategories={handleMoreCategories}
      onMoreSeries={handleMoreSeries}
    />
  );
}
