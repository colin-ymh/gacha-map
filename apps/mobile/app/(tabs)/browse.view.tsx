import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import type { GachaBrowseCategory, GachaBrowseSeries } from "@gacha-map/shared";
import { GachaBrowseSections } from "@/components/organisms/search/GachaBrowseSections";
import { GRAY_100, TEXT_DARK, WHITE } from "@/constants/colors";

interface Props {
  onCategoryPress: (category: GachaBrowseCategory) => void;
  onSeriesPress: (series: GachaBrowseSeries) => void;
  onMoreCategories: (type: "product_type" | "subject" | "genre") => void;
  onMoreSeries: () => void;
}

/** GlassTabBar 높이(56) + marginBottom(12). SearchOverlay와 같은 값을 쓴다. */
const TAB_BAR_HEIGHT = 68;

export default function BrowseView({
  onCategoryPress,
  onSeriesPress,
  onMoreCategories,
  onMoreSeries,
}: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {t("browse.title", { defaultValue: "둘러보기" })}
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        <GachaBrowseSections
          enabled
          onCategoryPress={onCategoryPress}
          onSeriesPress={onSeriesPress}
          onMoreCategories={onMoreCategories}
          onMoreSeries={onMoreSeries}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: WHITE,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: GRAY_100,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: TEXT_DARK,
  },
  scroll: {
    flex: 1,
  },
});
