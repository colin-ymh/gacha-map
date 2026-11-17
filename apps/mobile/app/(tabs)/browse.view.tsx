import React from "react";
import { StyleSheet, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import type {
  BrowsableCategoryType,
  GachaBrowseCategory,
  GachaBrowseSeries,
} from "@gacha-map/shared";
import SearchBar from "@/components/molecules/SearchBar";
import SearchOverlay from "@/components/organisms/search/SearchOverlay";
import LoginModal from "@/components/ui/LoginModal";
import { GachaBrowseSections } from "@/components/organisms/search/GachaBrowseSections";
import type { useSearchOverlay } from "@/hooks/useSearchOverlay";
import { WHITE } from "@/constants/colors";

interface Props {
  onCategoryPress: (category: GachaBrowseCategory) => void;
  onSeriesPress: (series: GachaBrowseSeries) => void;
  onMoreSeries: () => void;
  onMoreCategories: (type: BrowsableCategoryType) => void;
  search: ReturnType<typeof useSearchOverlay>;
  onViewOnMap: () => void;
  showLoginModal: boolean;
  onLoginModalClose: () => void;
}

/** GlassTabBar 높이(56) + marginBottom(12). SearchOverlay와 같은 값을 쓴다. */
const TAB_BAR_HEIGHT = 68;

export default function BrowseView({
  onCategoryPress,
  onSeriesPress,
  onMoreSeries,
  onMoreCategories,
  search,
  onViewOnMap,
  showLoginModal,
  onLoginModalClose,
}: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      {/* 홈·지도 탭과 같은 SearchBar 컴포넌트·같은 props·같은 여백을 쓴다. */}
      {!search.searchOpen && (
        <View style={styles.searchBarWrap}>
          <SearchBar
            glass
            placeholder={t("map.searchPlaceholder")}
            onPress={() => search.openSearch()}
          />
        </View>
      )}

      <GachaBrowseSections
        enabled
        stickySections
        onCategoryPress={onCategoryPress}
        onSeriesPress={onSeriesPress}
        onMoreSeries={onMoreSeries}
        onMoreCategories={onMoreCategories}
        bottomPadding={insets.bottom + TAB_BAR_HEIGHT + 16}
      />

      {/* 홈·지도와 동일한 검색 오버레이. 배선은 useSearchOverlay 가 공유한다. */}
      <SearchOverlay
        visible={search.searchOpen}
        activeTab={search.activeTab}
        onTabChange={search.setActiveTab}
        inputText={search.inputText}
        onSearchChange={search.handleSearchChange}
        onSearchClear={search.handleSearchTextClear}
        onSubmit={search.addQuery}
        onClose={search.handleSearchClose}
        shopSearchStatus={search.shopSearchStatus}
        searchShops={search.searchShops}
        wishedShopIds={search.wishedShopIds}
        onShopPress={(shopId) => router.push(`/shop/${shopId}` as never)}
        onShopWishToggle={search.handleWishToggle}
        onViewOnMap={onViewOnMap}
        gachaLoading={search.gachaLoading}
        gachaLoadingMore={search.gachaLoadingMore}
        gachaResults={search.gachaResults}
        onGachaEndReached={search.loadMoreGacha}
        wishedProductIds={search.wishedProductIds}
        onGachaPress={(gachaId) => router.push(`/gacha/${gachaId}` as never)}
        onGachaWishToggle={search.handleProductWishToggle}
        recentItems={search.recentItems}
        onRecentQueryPress={search.handleRecentQueryPress}
        onRemoveRecent={search.removeRecent}
        onClearRecent={search.clearRecent}
        onBrowseCategoryPress={onCategoryPress}
        onBrowseSeriesPress={onSeriesPress}
        onBrowseMoreSeries={onMoreSeries}
        onBrowseMoreCategories={onMoreCategories}
      />

      <LoginModal
        visible={showLoginModal}
        onClose={onLoginModalClose}
        onLoginPress={() => {
          onLoginModalClose();
          router.push("/login");
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: WHITE,
  },
  /**
   * 홈·지도 탭의 플로팅 검색바와 같은 여백을 쓴다.
   *
   * 세 탭이 같은 `SearchBar` 를 쓰는데 감싸는 여백이 달라서, 탭을 옮길 때 검색창이
   * 좌우로 4px 씩 튀고 위 여백도 어긋났다(홈 20/12 vs 여기 16/8).
   *
   * 홈·지도는 지도를 가리지 않으려고 absolute 로 띄우지만 이 화면은 그럴 이유가
   * 없어 일반 흐름에 둔다. 시각적 위치는 같다.
   */
  searchBarWrap: {
    // 검색창 그림자가 스크롤 영역의 상단에서 끊기지 않도록 한다.
    zIndex: 1,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
});
