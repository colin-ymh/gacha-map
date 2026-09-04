import React from "react";
import { StyleSheet, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import type {
  BrowsableCategoryType,
  GachaBrowseCategory,
  GachaBrowseSeries,
} from "@gacha-map/shared";
import SearchBar from "@/components/molecules/SearchBar";
import { GachaBrowseSections } from "@/components/organisms/search/GachaBrowseSections";
import { WHITE } from "@/constants/colors";

interface Props {
  onCategoryPress: (category: GachaBrowseCategory) => void;
  onSeriesPress: (series: GachaBrowseSeries) => void;
  onMoreSeries: () => void;
  onMoreCategories: (type: BrowsableCategoryType) => void;
  onSearchPress: () => void;
}

/** GlassTabBar 높이(56) + marginBottom(12). SearchOverlay와 같은 값을 쓴다. */
const TAB_BAR_HEIGHT = 68;

export default function BrowseView({
  onCategoryPress,
  onSeriesPress,
  onMoreSeries,
  onMoreCategories,
  onSearchPress,
}: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <View style={styles.searchBarWrap}>
        {/* 홈/지도와 같은 검색 컴포넌트. 기획/디자인 재작업 전까지는 홈 탭 검색으로 이동만 한다. */}
        <SearchBar
          glass
          placeholder={t("map.searchPlaceholder")}
          onPress={onSearchPress}
        />
      </View>

      <GachaBrowseSections
        enabled
        onCategoryPress={onCategoryPress}
        onSeriesPress={onSeriesPress}
        onMoreSeries={onMoreSeries}
        onMoreCategories={onMoreCategories}
        bottomPadding={insets.bottom + TAB_BAR_HEIGHT + 16}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: WHITE,
  },
  searchBarWrap: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
});
