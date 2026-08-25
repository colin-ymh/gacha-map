import React, { useCallback } from "react";
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
 *
 * 목록 화면은 아직 없다. 핸들러는 자리만 잡아 두고 다음 단계에서 라우팅을 붙인다.
 */
export default function BrowseScreen() {
  const handleCategoryPress = useCallback((_category: GachaBrowseCategory) => {
    // TODO: /browse/category/[id] 라우트 연결
  }, []);

  const handleSeriesPress = useCallback((_series: GachaBrowseSeries) => {
    // TODO: /browse/series/[id] 라우트 연결
  }, []);

  const handleMoreCategories = useCallback(
    (_type: "product_type" | "subject" | "genre") => {
      // TODO: /browse/categories?type=... 라우트 연결
    },
    [],
  );

  const handleMoreSeries = useCallback(() => {
    // TODO: /browse/series 라우트 연결
  }, []);

  return (
    <BrowseView
      onCategoryPress={handleCategoryPress}
      onSeriesPress={handleSeriesPress}
      onMoreCategories={handleMoreCategories}
      onMoreSeries={handleMoreSeries}
    />
  );
}
