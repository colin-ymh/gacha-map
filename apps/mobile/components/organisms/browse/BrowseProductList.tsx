import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
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
import { AxisPickerSheet } from "@/components/organisms/browse/AxisPickerSheet";
import {
  AXIS_LABEL,
  useBrowseAxisOptions,
  type FilterAxis,
} from "@/hooks/useBrowseAxisOptions";
import {
  useBrowseProducts,
  type BrowseProductsQuery,
} from "@/hooks/useBrowseProducts";
import {
  GRAY_100,
  GRAY_200,
  PRIMARY,
  PRIMARY_BG,
  TEXT_DARK,
  TEXT_GRAY,
  WHITE,
} from "@/constants/colors";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

const SORTS: { value: GachaBrowseSort; key: string; fallback: string }[] = [
  { value: "popular", key: "browse.sort.popular", fallback: "인기순" },
  { value: "recent", key: "browse.sort.recent", fallback: "최신순" },
  { value: "name", key: "browse.sort.name", fallback: "이름순" },
];

const ALL_AXES: FilterAxis[] = ["product_type", "subject", "genre", "series"];

type Selection = Partial<Record<FilterAxis, string[]>>;

interface Props {
  title: string;
  /** 진입 축. 드롭다운에서 제외된다. 기획서 §17-3. */
  entryAxis: FilterAxis;
  query: Omit<
    BrowseProductsQuery,
    "sort" | "filterCategoryIds" | "filterSeriesIds"
  >;
}

function toQueryFilters(sel: Selection) {
  const categoryIds = (["product_type", "subject", "genre"] as const).flatMap(
    (a) => sel[a] ?? [],
  );
  return {
    filterCategoryIds: categoryIds.length > 0 ? categoryIds : undefined,
    filterSeriesIds: sel.series?.length ? sel.series : undefined,
  };
}

/**
 * 카테고리·시리즈별 상품 목록 + 축별 필터. 기획서 §5 / §7 / §17.
 *
 * 상품 카드는 검색 결과 카드와 같은 구성을 쓴다. 라벨이나 스타일이 어긋나면
 * 같은 상품이 화면마다 다르게 보인다.
 */
export function BrowseProductList({ title, entryAxis, query }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const [sort, setSort] = useState<GachaBrowseSort>("popular");
  const [applied, setApplied] = useState<Selection>({});
  const [openAxis, setOpenAxis] = useState<FilterAxis | null>(null);
  const [pending, setPending] = useState<string[]>([]);
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  const { options, ensure } = useBrowseAxisOptions();

  // 진입 축은 이미 고정돼 있으므로 드롭다운에서 뺀다. 항상 3개가 된다.
  const axes = useMemo(
    () => ALL_AXES.filter((a) => a !== entryAxis),
    [entryAxis],
  );

  const filters = toQueryFilters(applied);
  const {
    products,
    total,
    loading,
    loadingMore,
    error,
    hasMore,
    retry,
    loadMore,
  } = useBrowseProducts({ ...query, ...filters, sort });

  const openSheet = useCallback(
    (axis: FilterAxis) => {
      setOpenAxis(axis);
      setPending(applied[axis] ?? []);
      setPendingCount(null);
      void ensure(axis);
    },
    [applied, ensure],
  );

  // 적용 버튼에 띄울 예상 결과 수. 선택이 바뀔 때마다 디바운스해서 한 번 더 조회한다.
  useEffect(() => {
    if (!openAxis) return;
    const next: Selection = { ...applied, [openAxis]: pending };
    const f = toQueryFilters(next);
    const qs = new URLSearchParams({ limit: "1", offset: "0", sort });
    if (query.categoryId) qs.set("categoryId", query.categoryId);
    if (query.seriesId) qs.set("seriesId", query.seriesId);
    if (f.filterCategoryIds)
      qs.set("filterCategoryIds", f.filterCategoryIds.join(","));
    if (f.filterSeriesIds)
      qs.set("filterSeriesIds", f.filterSeriesIds.join(","));

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(
            `${API_BASE}/api/gacha-browse/products?${qs.toString()}`,
          );
          if (!res.ok) return;
          const json = (await res.json()) as { total: number };
          setPendingCount(json.total);
        } catch {
          // 이전 값을 유지한다. 버튼을 막지는 않는다. 기획서 §18-5.
        }
      })();
    }, 200);
    return () => clearTimeout(timer);
  }, [openAxis, pending, applied, sort, query.categoryId, query.seriesId]);

  const selectedChips = useMemo(
    () =>
      axes.flatMap((axis) =>
        (applied[axis] ?? []).map((id) => ({
          axis,
          id,
          label:
            options[axis]?.find((o) => o.id === id)?.label ?? id.slice(0, 6),
        })),
      ),
    [axes, applied, options],
  );

  const sortLabel = SORTS.find((s) => s.value === sort)!;
  const cycleSort = () => {
    const i = SORTS.findIndex((s) => s.value === sort);
    setSort(SORTS[(i + 1) % SORTS.length].value);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.backWrap, { top: insets.top + 8 }]}>
        <GlassBackButton onPress={() => router.back()} />
      </View>
      <Text style={[styles.title, { top: insets.top + 20 }]} numberOfLines={1}>
        {title}
      </Text>

      {/* 축별 드롭다운 */}
      <View style={{ paddingTop: insets.top + 60 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.axisRow}
        >
          {axes.map((axis) => {
            const n = applied[axis]?.length ?? 0;
            const label = AXIS_LABEL[axis];
            return (
              <Pressable
                key={axis}
                style={[styles.axisChip, n > 0 && styles.axisChipOn]}
                onPress={() => openSheet(axis)}
                accessibilityRole="button"
              >
                <Text style={[styles.axisText, n > 0 && styles.axisTextOn]}>
                  {t(label.key, { defaultValue: label.fallback })}
                  {n > 0 ? ` ${n}` : ""} ˅
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* 선택된 값 + 초기화 */}
      {selectedChips.length > 0 && (
        <View style={styles.selectedRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.selectedInner}
          >
            {selectedChips.map((c) => (
              <Pressable
                key={`${c.axis}:${c.id}`}
                style={styles.selectedChip}
                onPress={() =>
                  setApplied((prev) => ({
                    ...prev,
                    [c.axis]: (prev[c.axis] ?? []).filter((x) => x !== c.id),
                  }))
                }
              >
                <Text style={styles.selectedText}>{c.label} ✕</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable onPress={() => setApplied({})} hitSlop={8}>
            <Text style={styles.reset}>
              {t("browse.filter.reset", { defaultValue: "초기화" })} ↺
            </Text>
          </Pressable>
        </View>
      )}

      <View style={styles.countBar}>
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
          {selectedChips.length > 0 && (
            <Pressable onPress={() => setApplied({})} hitSlop={8}>
              <Text style={styles.retry}>
                {t("browse.filter.reset", { defaultValue: "초기화" })}
              </Text>
            </Pressable>
          )}
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

      <AxisPickerSheet
        visible={openAxis != null}
        title={
          openAxis
            ? t(AXIS_LABEL[openAxis].key, {
                defaultValue: AXIS_LABEL[openAxis].fallback,
              })
            : ""
        }
        options={openAxis ? (options[openAxis] ?? []) : []}
        selectedIds={pending}
        resultCount={pendingCount}
        onToggle={(id) =>
          setPending((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
          )
        }
        onReset={() => setPending([])}
        onApply={() => {
          if (openAxis)
            setApplied((prev) => ({ ...prev, [openAxis]: pending }));
          setOpenAxis(null);
        }}
        onClose={() => setOpenAxis(null)}
      />
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
  axisRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 12 },
  axisChip: {
    height: 32,
    borderRadius: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: GRAY_200,
    backgroundColor: WHITE,
    justifyContent: "center",
  },
  axisChipOn: { backgroundColor: PRIMARY_BG, borderColor: PRIMARY_BG },
  axisText: { fontSize: 13, color: TEXT_DARK },
  axisTextOn: { fontWeight: "700", color: PRIMARY },
  selectedRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  selectedInner: { gap: 8, flexGrow: 1 },
  selectedChip: {
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 12,
    backgroundColor: GRAY_100,
    justifyContent: "center",
  },
  selectedText: { fontSize: 12, color: TEXT_DARK },
  reset: { fontSize: 12, color: TEXT_GRAY },
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
