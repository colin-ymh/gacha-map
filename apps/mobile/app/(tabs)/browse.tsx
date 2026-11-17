import React, { useCallback, useState } from "react";
import { useRouter } from "expo-router";
import type {
  BrowsableCategoryType,
  GachaBrowseCategory,
  GachaBrowseSeries,
} from "@gacha-map/shared";
import { useSearchOverlay } from "@/hooks/useSearchOverlay";
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
  const [showLoginModal, setShowLoginModal] = useState(false);

  const search = useSearchOverlay({
    onRequireLogin: () => setShowLoginModal(true),
  });

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
    (type: BrowsableCategoryType) => {
      router.push(`/browse/categories?type=${type}`);
    },
    [router],
  );

  /**
   * 검색 결과를 지도에서 본다.
   *
   * 이 화면에는 지도가 없으므로 지도 탭으로 넘긴다. 홈 탭과 같은 방식이다 —
   * 검색 결과(mode/searchShops)는 Redux 에 남겨 두고 exitSearch() 를 부르지
   * 않아야 지도 탭이 그대로 이어받아 핀을 그린다.
   */
  const handleViewOnMap = useCallback(() => {
    search.cancelPendingSearch();
    search.setSearchOpen(false);
    router.navigate("/(tabs)/map" as never);
  }, [router, search]);

  return (
    <BrowseView
      onCategoryPress={handleCategoryPress}
      onSeriesPress={handleSeriesPress}
      onMoreSeries={handleMoreSeries}
      onMoreCategories={handleMoreCategories}
      search={search}
      onViewOnMap={handleViewOnMap}
      showLoginModal={showLoginModal}
      onLoginModalClose={() => setShowLoginModal(false)}
    />
  );
}
