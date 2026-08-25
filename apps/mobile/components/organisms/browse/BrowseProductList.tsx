import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import type { GachaBrowseSort } from "@gacha-map/shared";
import { GlassBackButton } from "@/components/ui/GlassBackButton";
import GachaItemThumb from "@/components/molecules/GachaItemThumb";
import { PressableScale } from "@/components/ui/PressableScale";
import {
  useBrowseProducts,
  type BrowseProductsQuery,
} from "@/hooks/useBrowseProducts";
import { GRAY_100, PRIMARY, TEXT_DARK, TEXT_GRAY, WHITE } from "@/constants/colors";

const SORTS: { value: GachaBrowseSort; key: string; fallback: string }[] = [
  { value: "popular", key: "browse.sort.popular", fallback: "인기순" },
  { value: "recent", key: "browse.sort.recent", fallback: "최신순" },
  { value: "name", key: "browse.sort.name", fallback: "이름순" },
];

interface Props {
  title: string;
  /** 진입 축. categoryId 또는 seriesId 중 하나. */
  query: Omit<BrowseProductsQuery, "sort">;
}

/**
 * 카테고리·시리즈별 상품 목록. 기획서 §5 / §7.
 *
 * 상품 카드는 검색 결과 카드와 같은 구성을 쓴다(썸네일 + 상품명 + 제조사·샵 수).
 * 라벨과 스타일이 어긋나면 같은 상품이 화면마다 다르게 보인다.
 *
 * 축별 드롭다운 필터(§17)는 아직 붙이지 않았다. 정렬만 우선 제공한다.
 */
export function BrowseProductList({ title, query }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [sort, setSort] = useState<GachaBrowseSort>("popular");

  const {
    products,
    total,
    loading,
    loadingMore,
    error,
    hasMore,
    retry,
    loadMore,
  } = useBrowseProducts({ ...query, sort });

  const cycleSort = () => {
    const i = SORTS.findIndex((s) => s.value === sort);
    setSort(SORTS[(i + 1) % SORTS.length].value);
  };
  const sortLabel = SORTS.find((s) => s.value === sort)!;

  return (
    <View style={styles.root}>
      <View style={[styles.backWrap, { top: insets.top + 8 }]}>
        <GlassBackButton onPress={() => router.back()} />
      </View>
      <Text style={[styles.title, { top: insets.top + 20 }]} numberOfLines={1}>
        {title}
      </Text>

      <View style={[styles.countBar, { marginTop: insets.top + 60 }]}>
        <Text style={styles.count}>
          {t("browse.filter.count", {
            count: total,
            defaultValue: `총 ${total.toLocaleString()}개`,
          })}
        </Text>
        <Pressable onPress={cycleSort} hitSlop={8} accessibilityRole="button">
          <Text style={styles.sort}>
            {t(sortLabel.key, { defaultValue: sortLabel.fallback })} ˅
          </Text>
        </Pressable>
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
      ) : products.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.stateText}>
            {t("browse.filter.emptyResult", {
              defaultValue: "조건에 맞는 상품이 없습니다.",
            })}
          </Text>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          onEndReached={() => hasMore && loadMore()}
          onEndReachedThreshold={0.4}
          renderItem={({ item }) => (
            <PressableScale
              style={styles.row}
              onPress={() => router.push(`/gacha/${item.id}`)}
            >
              <GachaItemThumb url={item.official_image_url} />
              <View style={styles.rowText}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {item.name_ko ?? item.name}
                </Text>
                <Text style={styles.rowSub} numberOfLines={1}>
                  {item.manufacturer}
                  {item.available_shop_count > 0
                    ? ` · ${t("map.shopAvail", { count: item.available_shop_count })}`
                    : ""}
                </Text>
                {item.min_price_krw != null && (
                  <Text style={styles.rowPrice}>
                    {t("gacha.minPrice", {
                      price: item.min_price_krw.toLocaleString(),
                      defaultValue: `최저 ₩${item.min_price_krw.toLocaleString()}`,
                    })}
                  </Text>
                )}
              </View>
            </PressableScale>
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
    right: 16,
    zIndex: 10,
    fontSize: 17,
    fontWeight: "700",
    color: TEXT_DARK,
  },
  countBar: {
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    backgroundColor: "#F5F5F7",
  },
  count: { fontSize: 12, color: TEXT_GRAY },
  sort: { fontSize: 12, color: TEXT_DARK },
  center: { flex: 1, alignItems: "center", paddingTop: 60, gap: 12 },
  stateText: { fontSize: 13, color: TEXT_GRAY },
  retry: { fontSize: 13, fontWeight: "700", color: TEXT_DARK },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  rowText: { flex: 1, gap: 4 },
  rowName: { fontSize: 14, fontWeight: "700", color: TEXT_DARK },
  rowSub: { fontSize: 11, color: TEXT_GRAY },
  rowPrice: { fontSize: 12, color: PRIMARY },
  sep: { height: 1, backgroundColor: GRAY_100, marginHorizontal: 16 },
  footer: { paddingVertical: 20 },
});
