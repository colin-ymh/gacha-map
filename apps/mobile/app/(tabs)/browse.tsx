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

  const handleMoreSeries = useCallback(() => {
    router.push("/browse/series");
  }, [router]);

  const handleMoreCategories = useCallback(
    (type: "product_type" | "subject" | "genre") => {
      router.push(`/browse/categories?type=${type}`);
    },
    [router],
  );

  // 검색은 홈/지도 탭에서만 붙어 있다. 여기서는 홈으로 이동만 한다 —
  // 기획/디자인 재작업 전까지의 임시 동작이다.
  const handleSearchPress = useCallback(() => {
    router.push("/");
  }, [router]);

  return (
    <BrowseView
      onCategoryPress={handleCategoryPress}
      onSeriesPress={handleSeriesPress}
      onMoreSeries={handleMoreSeries}
      onMoreCategories={handleMoreCategories}
      onSearchPress={handleSearchPress}
    />
  );
}
