import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import type { GachaBrowseSort } from "@gacha-map/shared";
import { GlassBackButton } from "@/components/ui/GlassBackButton";
import { BrowseChip } from "@/components/molecules/BrowseChip";
import GachaItemThumb from "@/components/molecules/GachaItemThumb";
import { PressableScale } from "@/components/ui/PressableScale";
import { SkeletonBone } from "@/components/ui/Skeleton";
import { AxisPickerSheet } from "@/components/organisms/browse/AxisPickerSheet";
import { getGachaDisplayName } from "@/lib/gachaDisplayName";
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
  PRIMARY,
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
const PRODUCT_THUMB_SIZE = 56;
const PRODUCT_THUMB_RADIUS = 8;
const SKELETON_NAME_WIDTHS = [165, 135, 190, 150, 175, 130, 160, 145];

type Selection = Partial<Record<FilterAxis, string[]>>;

interface Props {
  title: string;
  titleLoading: boolean;
  /** 드롭다운에서 제외할 진입 축. 확인하기 전에는 null. */
  entryAxis: FilterAxis | null;
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

function ProductRowsSkeleton({
  label,
  pagination = false,
}: {
  label: string;
  pagination?: boolean;
}) {
  const widths = pagination
    ? SKELETON_NAME_WIDTHS.slice(0, 2)
    : SKELETON_NAME_WIDTHS;

  return (
    <View
      style={pagination ? undefined : styles.skeletonList}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
    >
      {widths.map((width, index) => (
        <React.Fragment key={width}>
          {(pagination || index > 0) && <View style={styles.sep} />}
          <View style={styles.row}>
            <SkeletonBone
              width={PRODUCT_THUMB_SIZE}
              height={PRODUCT_THUMB_SIZE}
              borderRadius={PRODUCT_THUMB_RADIUS}
            />
            <View style={styles.rowText}>
              <SkeletonBone
                width={width}
                height={14}
                style={styles.skeletonText}
              />
              <SkeletonBone width={85} height={11} />
              <SkeletonBone width={64} height={12} />
            </View>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

/**
 * 카테고리·시리즈별 상품 목록 + 축별 필터. 기획서 §5 / §7 / §17.
 *
 * 상품 카드는 검색 결과 카드와 같은 구성을 쓴다. 라벨이나 스타일이 어긋나면
 * 같은 상품이 화면마다 다르게 보인다.
 */
export function BrowseProductList({
  title,
  titleLoading,
  entryAxis,
  query,
}: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const [sort, setSort] = useState<GachaBrowseSort>("popular");
  const [applied, setApplied] = useState<Selection>({});
  const [openAxis, setOpenAxis] = useState<FilterAxis | null>(null);
  const [pending, setPending] = useState<string[]>([]);
  const [pendingCount, setPendingCount] = useState<{
    query: string;
    total: number;
  } | null>(null);

  const { options, failed, ensure } = useBrowseAxisOptions();

  // 메타데이터를 기다리는 동안에도 기본 축 옵션은 미리 로드한다.
  const axes = useMemo(
    () => ALL_AXES.filter((axis) => axis !== (entryAxis ?? "product_type")),
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

  useEffect(() => {
    axes.forEach((axis) => void ensure(axis));
  }, [axes, ensure]);

  const openSheet = useCallback(
    (axis: FilterAxis) => {
      setOpenAxis(axis);
      setPending(applied[axis] ?? []);
      setPendingCount(null);
      void ensure(axis);
    },
    [applied, ensure],
  );

  const currentSelection = openAxis ? applied[openAxis] ?? [] : [];
  const selectionChanged =
    pending.length !== currentSelection.length ||
    pending.some((id) => !currentSelection.includes(id));
  let countQuery: string | null = null;
  if (openAxis && selectionChanged) {
    const next: Selection = { ...applied, [openAxis]: pending };
    const f = toQueryFilters(next);
    const qs = new URLSearchParams({ limit: "1", offset: "0", sort });
    if (query.categoryId) qs.set("categoryId", query.categoryId);
    if (query.seriesId) qs.set("seriesId", query.seriesId);
    if (f.filterCategoryIds)
      qs.set("filterCategoryIds", f.filterCategoryIds.join(","));
    if (f.filterSeriesIds)
      qs.set("filterSeriesIds", f.filterSeriesIds.join(","));
    countQuery = qs.toString();
  }

  const currentCount = loading || error ? null : total;
  const matchingCount = pendingCount?.query === countQuery ? pendingCount?.total : null;
  const resultCount = countQuery ? matchingCount ?? null : currentCount;

  // 현재 목록의 결과 수는 재사용하고, 조건이 바뀔 때만 새로 조회한다.
  useEffect(() => {
    if (!countQuery) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(
            `${API_BASE}/api/gacha-browse/products?${countQuery}`,
            { signal: controller.signal },
          );
          if (!res.ok) return;
          const json = (await res.json()) as { total: number };
          if (!controller.signal.aborted) {
            setPendingCount({ query: countQuery, total: json.total });
          }
        } catch {
          // 예상 건수를 알 수 없어도 새 필터 적용은 가능하다.
        }
      })();
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [countQuery]);

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
      {titleLoading ? (
        <View style={[styles.title, { top: insets.top + 21 }]}>
          <SkeletonBone width={120} height={18} style={styles.skeletonText} />
        </View>
      ) : (
        <Text style={[styles.title, { top: insets.top + 20 }]} numberOfLines={1}>
          {title}
        </Text>
      )}

      {/* 축별 드롭다운 */}
      <View style={{ paddingTop: insets.top + 60 }}>
        {entryAxis == null ? (
          <View style={[styles.axisRow, styles.inlineSkeleton]}>
            {[68, 68, 80].map((width, index) => (
              <SkeletonBone
                key={index}
                width={width}
                height={32}
                borderRadius={16}
              />
            ))}
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.axisRow}
          >
            {axes.map((axis) => {
              const n = applied[axis]?.length ?? 0;
              const label = AXIS_LABEL[axis];
              const axisLabel = t(label.key, { defaultValue: label.fallback });
              return (
                <BrowseChip
                  key={axis}
                  label={axisLabel}
                  count={n || undefined}
                  selected={n > 0}
                  trailingIcon="chevron-down"
                  accessibilityLabel={
                    n > 0
                      ? `${axisLabel}, ${t("browse.sheet.selectedCount", { count: n })}`
                      : axisLabel
                  }
                  onPress={() => openSheet(axis)}
                />
              );
            })}
          </ScrollView>
        )}
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
                accessibilityRole="button"
                onPress={() =>
                  setApplied((prev) => ({
                    ...prev,
                    [c.axis]: (prev[c.axis] ?? []).filter((x) => x !== c.id),
                  }))
                }
              >
                <Text style={styles.selectedText}>{c.label}</Text>
                <Ionicons
                  name="close"
                  size={12}
                  color={TEXT_GRAY}
                  accessible={false}
                />
              </Pressable>
            ))}
          </ScrollView>
          <Pressable
            style={styles.inlineControl}
            onPress={() => setApplied({})}
            hitSlop={8}
            accessibilityRole="button"
          >
            <Text style={styles.reset}>
              {t("browse.filter.reset", { defaultValue: "초기화" })}
            </Text>
            <Ionicons
              name="refresh"
              size={12}
              color={TEXT_GRAY}
              accessible={false}
            />
          </Pressable>
        </View>
      )}

      <View style={styles.countBar}>
        {loading ? (
          <SkeletonBone width={66} height={12} />
        ) : (
          <Text style={styles.count}>
            {t("browse.filter.count", {
              count: total,
              defaultValue: `총 ${total.toLocaleString()}개`,
            })}
          </Text>
        )}
        <Pressable
          style={styles.inlineControl}
          onPress={cycleSort}
          hitSlop={8}
          accessibilityRole="button"
        >
          <Text style={styles.sort}>
            {t(sortLabel.key, { defaultValue: sortLabel.fallback })}
          </Text>
          <Ionicons
            name="swap-vertical"
            size={12}
            color={TEXT_GRAY}
            accessible={false}
          />
        </Pressable>
      </View>

      {loading ? (
        <ProductRowsSkeleton label={t("browse.loadingProducts")} />
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
              <GachaItemThumb
                url={item.official_image_url}
                size={PRODUCT_THUMB_SIZE}
                borderRadius={PRODUCT_THUMB_RADIUS}
              />
              <View style={styles.rowText}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {getGachaDisplayName(item)}
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
              <ProductRowsSkeleton label={t("browse.loadingProducts")} pagination />
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
        loading={
          openAxis != null && options[openAxis] == null && !failed[openAxis]
        }
        error={openAxis != null && failed[openAxis] === true}
        selectedIds={pending}
        resultCount={resultCount}
        onRetry={() => {
          if (openAxis) void ensure(openAxis);
        }}
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
  inlineSkeleton: { flexDirection: "row" },
  selectedRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  selectedInner: { gap: 8, flexGrow: 1 },
  selectedChip: {
    minHeight: 28,
    borderRadius: 14,
    paddingHorizontal: 12,
    backgroundColor: GRAY_100,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  selectedText: { fontSize: 12, color: TEXT_DARK },
  reset: { fontSize: 12, color: TEXT_GRAY },
  countBar: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: GRAY_100,
  },
  inlineControl: { flexDirection: "row", alignItems: "center", gap: 5 },
  count: { flexShrink: 1, fontSize: 12, color: TEXT_GRAY },
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
  skeletonList: { flex: 1, overflow: "hidden" },
  skeletonText: { maxWidth: "100%" },
});
