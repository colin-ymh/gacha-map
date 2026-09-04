import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import type { GachaSeriesChip } from "@gacha-map/shared";
import { GlassBackButton } from "@/components/ui/GlassBackButton";
import { BrowseChip } from "@/components/molecules/BrowseChip";
import { useBrowseSeriesList } from "@/hooks/useGachaBrowseLists";
import { GRAY_100, TEXT_DARK, TEXT_GRAY, WHITE } from "@/constants/colors";

/**
 * 칩 순서는 dev 실측 건수 내림차순이다. 기획서 §6-3.
 * unknown 은 어떤 칩에도 넣지 않는다 — '전체'에서만 보인다.
 */
const CHIPS: {
  value: GachaSeriesChip | null;
  key: string;
  fallback: string;
}[] = [
  { value: null, key: "browse.kind.all", fallback: "전체" },
  { value: "other", key: "browse.kind.other", fallback: "오리지널" },
  { value: "anime", key: "browse.kind.anime", fallback: "애니메이션" },
  {
    value: "character_brand",
    key: "browse.kind.characterBrand",
    fallback: "캐릭터",
  },
  { value: "franchise", key: "browse.kind.franchise", fallback: "프랜차이즈" },
  { value: "game", key: "browse.kind.game", fallback: "게임" },
];

/** 시리즈 전체 목록. 기획서 §6. */
export default function BrowseSeriesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [chip, setChip] = useState<GachaSeriesChip | null>(null);

  const { series, loading, loadingMore, error, hasMore, retry, loadMore } =
    useBrowseSeriesList(chip);

  return (
    <View style={styles.root}>
      <View style={[styles.backWrap, { top: insets.top + 8 }]}>
        <GlassBackButton onPress={() => router.back()} />
      </View>
      <Text style={[styles.title, { top: insets.top + 20 }]}>
        {t("browse.series.title", { defaultValue: "시리즈" })}
      </Text>

      <View style={{ paddingTop: insets.top + 60 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {CHIPS.map((c) => (
            <BrowseChip
              key={c.value ?? "all"}
              label={t(c.key, { defaultValue: c.fallback })}
              selected={chip === c.value}
              onPress={() => setChip(c.value)}
            />
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={TEXT_GRAY} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.stateText}>
            {t("browse.loadError", {
              defaultValue: "목록을 불러오지 못했습니다.",
            })}
          </Text>
          <Pressable onPress={retry} hitSlop={8}>
            <Text style={styles.retry}>
              {t("common.retry", { defaultValue: "다시 시도" })}
            </Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={series}
          keyExtractor={(item) => item.series_id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          onEndReached={() => hasMore && loadMore()}
          onEndReachedThreshold={0.4}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => router.push(`/browse/series/${item.series_id}`)}
              accessibilityRole="button"
            >
              {item.representative_image_url ? (
                <Image
                  source={{ uri: item.representative_image_url }}
                  style={styles.thumb}
                />
              ) : (
                <View style={[styles.thumb, styles.thumbEmpty]} />
              )}
              <View style={styles.rowText}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {item.name_ko}
                </Text>
                <Text style={styles.rowSub}>
                  {t("browse.productCount", {
                    count: item.rollup_product_count,
                    defaultValue: `상품 ${item.rollup_product_count}개`,
                  })}
                  {item.child_count > 0
                    ? ` · ${t("browse.series.childCount", {
                        count: item.child_count,
                        defaultValue: `하위 ${item.child_count}`,
                      })}`
                    : ""}
                </Text>
              </View>
            </Pressable>
          )}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footer}>
                <ActivityIndicator color={TEXT_GRAY} />
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: WHITE },
  backWrap: { position: "absolute", left: 16, zIndex: 10 },
  title: {
    position: "absolute",
    left: 72,
    zIndex: 10,
    fontSize: 17,
    fontWeight: "700",
    color: TEXT_DARK,
  },
  chipRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 12 },
  center: { flex: 1, alignItems: "center", paddingTop: 60, gap: 12 },
  stateText: { fontSize: 13, color: TEXT_GRAY },
  retry: { fontSize: 13, fontWeight: "700", color: TEXT_DARK },
  row: {
    height: 68,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 12,
  },
  thumb: { width: 48, height: 48, borderRadius: 8, backgroundColor: GRAY_100 },
  thumbEmpty: { backgroundColor: GRAY_100 },
  rowText: { flex: 1, gap: 4 },
  rowName: { fontSize: 14, fontWeight: "700", color: TEXT_DARK },
  rowSub: { fontSize: 11, color: TEXT_GRAY },
  sep: {
    height: 1,
    backgroundColor: GRAY_100,
    marginLeft: 76,
    marginRight: 16,
  },
  footer: { paddingVertical: 20 },
});
