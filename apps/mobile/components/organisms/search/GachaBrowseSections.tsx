import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";
import type {
  BrowsableCategoryType,
  GachaBrowseCategory,
  GachaBrowseSeries,
} from "@gacha-map/shared";
import {
  GRAY_100,
  IMAGE_GRADIENT_BOTTOM,
  PRIMARY,
  primaryAlpha,
  TEXT_DARK,
  TEXT_GRAY,
  TRANSPARENT,
  WHITE,
} from "@/constants/colors";
import { useGachaBrowse } from "@/hooks/useGachaBrowse";
import { useBrowseCategoryList } from "@/hooks/useGachaBrowseLists";
import {
  BrowseListRow,
  BrowseListRowSkeleton,
} from "@/components/molecules/BrowseListRow";
import { LiquidGlass } from "@/components/ui/LiquidGlass";
import { SkeletonBone } from "@/components/ui/Skeleton";

interface Props {
  /** 가챠 탭이 열려 있고 검색어가 비어 있을 때만 true. 그때만 데이터를 받는다. */
  enabled: boolean;
  onCategoryPress: (category: GachaBrowseCategory) => void;
  onSeriesPress: (series: GachaBrowseSeries) => void;
  onMoreSeries: () => void;
  onMoreCategories: (type: BrowsableCategoryType) => void;
  /** 오른쪽 목록 맨 아래 여백. 하단 탭바에 가려지지 않게 호출부가 넘긴다. */
  bottomPadding?: number;
  /** 탐색 탭에서 검색창 아래에 분류 레일과 섹션 제목을 고정한다. */
  stickySections?: boolean;
}

type RailKey = "series" | "product_type" | "subject" | "genre" | "line";
type RailItemLayout = { y: number; height: number };

const RAIL_HIGHLIGHT_TIMING = {
  duration: 180,
  easing: Easing.out(Easing.cubic),
  reduceMotion: ReduceMotion.System,
};

/** 시리즈를 뺀 나머지 축. 이쪽만 `gacha_categories`에서 온다. */
type CategoryRailKey = Exclude<RailKey, "series">;

/**
 * 레일 노출 순서.
 *
 * 시리즈(IP) 바로 다음이 제품 라인이다. 이용자가 가챠를 떠올리는 순서가
 * "무슨 IP" → "어떤 종류"이고, 상품 종류·소재·장르는 그보다 넓은 분류라
 * 뒤로 뺀다.
 */
const RAIL_KEYS: RailKey[] = [
  "series",
  "line",
  "product_type",
  "subject",
  "genre",
];

/** 카테고리 축 미리보기 개수. 나머지는 "전체" 눌러 별도 화면에서 본다. */
const CATEGORY_PREVIEW_SIZE = 8;

/** 검색창 아래 바로가기 칩 개수. */
const SHORTCUT_SIZE = 5;

/**
 * 바로가기에 고정 노출할 항목. 표시 순서를 그대로 따른다.
 *
 * id가 아니라 `name_ko`로 지정한다 — id를 박으면 그 항목이 archive 되거나 다른
 * 시리즈로 병합될 때 죽은 링크가 된다. 이름으로 찾다 없으면 건너뛰고 축별
 * 상위 항목으로 자리를 메운다.
 *
 * 이름이 바뀌면 조용히 목록에서 빠지므로, 택소노미에서 이 이름들을 바꿀 때는
 * 여기도 함께 고쳐야 한다.
 */
const PINNED_SERIES = ["산리오 캐릭터즈", "포켓몬스터"] as const;
const PINNED_LINES = ["메지루시", "오네무탄", "카타즌"] as const;

/** 스크롤 위치가 섹션 상단을 이 값만큼 지나야 그 섹션을 활성으로 본다. */
const ACTIVE_OFFSET = 24;

function Row({
  label,
  count,
  previewImageUrl,
  onPress,
}: {
  label: string;
  count: number;
  previewImageUrl?: string | null;
  onPress: () => void;
}) {
  if (previewImageUrl !== undefined) {
    return (
      <BrowseListRow
        preview
        name={label}
        imageUrl={previewImageUrl}
        productCount={count}
        onPress={onPress}
      />
    );
  }

  return (
    <Pressable style={styles.row} onPress={onPress} accessibilityRole="button">
      <Text style={styles.rowLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.rowCount}>{count.toLocaleString()}</Text>
    </Pressable>
  );
}

function SectionHeader({
  title,
  onPress,
  compact = false,
}: {
  title: string;
  onPress?: () => void;
  compact?: boolean;
}) {
  const { t } = useTranslation();

  const headerStyle = [styles.sectionHeader, compact && styles.browseHeader];
  const titleStyle = [
    styles.sectionHeaderTitle,
    compact && styles.browseHeaderTitle,
  ];

  if (!onPress) {
    return (
      <View style={headerStyle}>
        <Text style={titleStyle}>{title}</Text>
      </View>
    );
  }

  return (
    <Pressable
      style={headerStyle}
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
    >
      <Text style={titleStyle}>{title}</Text>
      <Text style={[styles.sectionHeaderMore, compact && styles.browseHeaderMore]}>
        {t("browse.all", { defaultValue: "전체" })} ›
      </Text>
    </Pressable>
  );
}

function BrowseRailHighlight({ y, height }: RailItemLayout) {
  const top = useSharedValue(y);
  const itemHeight = useSharedValue(height);

  useEffect(() => {
    top.value = withTiming(y, RAIL_HIGHLIGHT_TIMING);
    itemHeight.value = withTiming(height, RAIL_HIGHLIGHT_TIMING);
  }, [top, itemHeight, y, height]);

  const animation = useAnimatedStyle(() => ({
    height: itemHeight.value,
    transform: [{ translateY: top.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.browseRailHighlight, animation]}
    >
      <LiquidGlass
        fill
        borderRadius={BROWSE_RAIL_RADIUS}
        overlayColor={primaryAlpha(0.15)}
        androidElevation={0}
        style={styles.browseRailGlass}
      >
        {null}
      </LiquidGlass>
    </Animated.View>
  );
}

function BrowseSectionsSkeleton({ label }: { label: string }) {
  return (
    <View
      style={[styles.wrap, styles.clipped]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
    >
      <View style={[styles.rail, styles.stickyRail]}>
        {[40, 48, 52, 30, 36].map((width) => (
          <View key={width} style={styles.browseRailItem}>
            <SkeletonBone width={width} height={10} borderRadius={5} />
          </View>
        ))}
      </View>
      <View style={styles.scrollingSections}>
        <View
          style={[styles.sectionHeader, styles.browseHeader, styles.skeletonHeader]}
        >
          <SkeletonBone width={68} height={15} />
          <SkeletonBone width={32} height={12} />
        </View>
        {[110, 88, 124, 75, 116, 96, 103, 90].map((width) => (
          <BrowseListRowSkeleton key={width} nameWidth={width} />
        ))}
      </View>
    </View>
  );
}

/**
 * 둘러보기 화면. 왼쪽 레일(시리즈/상품 종류/소재/장르/제품 라인) + 오른쪽 스크롤 목록.
 *
 * 레일을 누르면 그 섹션으로 스크롤하고, 스크롤하면 레일이 따라 강조된다(스크롤스파이).
 * 축 5개가 서로 독립적(계층 아님)이라 데일리샷류 카테고리 화면과 달리 상위-하위 관계는
 * 없다 — 레일 항목 자체가 각 축이다.
 *
 * 노션 「가챠 카테고리·시리즈 탐색 기획」 §3.
 */
export function GachaBrowseSections({
  enabled,
  onCategoryPress,
  onSeriesPress,
  onMoreSeries,
  onMoreCategories,
  bottomPadding = 0,
  stickySections = false,
}: Props) {
  const { t } = useTranslation();
  const { series, loading, error, retry } = useGachaBrowse(enabled);
  const productTypes = useBrowseCategoryList("product_type");
  const subjects = useBrowseCategoryList("subject");
  const genres = useBrowseCategoryList("genre");
  const lines = useBrowseCategoryList("line");

  const scrollRef = useRef<ScrollView>(null);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [lastSectionHeight, setLastSectionHeight] = useState(0);
  const [railLayouts, setRailLayouts] = useState<
    Partial<Record<RailKey, RailItemLayout>>
  >({});
  const offsets = useRef<Partial<Record<RailKey, number>>>({});
  const sectionHeights = useRef<
    Partial<Record<RailKey, { header?: number; rows?: number }>>
  >({});
  const selectedRailKey = useRef<RailKey | null>(null);
  const [activeKey, setActiveKey] = useState<RailKey>("series");

  const railLabels: Record<RailKey, string> = useMemo(
    () => ({
      series: t("browse.section.popularSeries", { defaultValue: "시리즈" }),
      product_type: t("browse.section.productType", {
        defaultValue: "상품 종류",
      }),
      subject: t("browse.section.subject", { defaultValue: "소재" }),
      genre: t("browse.section.genre", { defaultValue: "장르" }),
      line: t("browse.section.line", { defaultValue: "제품 라인" }),
    }),
    [t],
  );

  /**
   * 카테고리 축 → 목록. 축이 늘어날 때 이 맵에만 추가하면 레일·본문·표시 여부가
   * 함께 따라온다. 축마다 if를 늘어놓으면 한 군데를 빠뜨렸을 때 조용히 어긋난다.
   */
  const categoryListByKey: Record<
    CategoryRailKey,
    ReturnType<typeof useBrowseCategoryList>
  > = {
    product_type: productTypes,
    subject: subjects,
    genre: genres,
    line: lines,
  };

  const visibleKeys = RAIL_KEYS.filter((key) =>
    key === "series"
      ? series.length > 0
      : categoryListByKey[key].categories.length > 0,
  );

  /**
   * 검색창 바로 아래 붙는 바로가기 카드.
   *
   * 목록을 스크롤하지 않고도 가장 많이 찾을 항목으로 바로 가게 한다.
   *
   * 노출 항목은 기획에서 지정한 5개(PINNED_*)를 우선한다. 상품 수 순으로 자동
   * 선정하면 택소노미가 바뀔 때마다 목록이 흔들린다 — 실제로 닛코리노를 시리즈로
   * 옮기자 212건이 되며 포켓몬(190)을 제쳤고, 캡슐 플라레일(107)이 오네무탄(90)을
   * 밀어냈다. 바로가기는 "많이 팔린 것"이 아니라 "먼저 보여주고 싶은 것"이라
   * 지정 목록이 맞다.
   *
   * 다만 **id가 아니라 이름으로 지정한다.** 고정 id는 그 항목이 archive 되거나
   * 병합되면 죽은 링크가 된다. 이름으로 찾다가 없으면 그냥 건너뛰고, 모자란
   * 자리는 축별 상위에서 자동으로 채운다. 지정 항목이 사라져도 화면이 비지 않는다.
   *
   * 대표 이미지가 겹치면 카드가 같은 썸네일로 도배되므로 중복을 거른다. 겹칠 때는
   * API 가 주는 후보 2·3순위로 넘어가 항목 자체는 살린다. 지정 항목은 후보가 전부
   * 겹쳐도 버리지 않는다 — 지정의 의미가 사라지기 때문이다.
   */
  const shortcuts = useMemo(() => {
    if (stickySections) return [];

    const items: {
      id: string;
      label: string;
      imageUrl: string;
      onPress: () => void;
    }[] = [];
    const usedImages = new Set<string>();
    const usedIds = new Set<string>();

    /**
     * 아직 안 쓰인 첫 이미지를 고른다.
     *
     * API 가 후보를 상위 3장까지 준다(`representative_image_urls`). 1순위가 다른
     * 항목과 겹쳐도 2·3순위로 넘어가면 항목을 잃지 않는다. 구버전 API 는 배열을
     * 안 주므로 단수 컬럼으로 폴백한다.
     *
     * `force` 는 지정 항목(PINNED_*)용이다. 후보가 전부 겹쳐도 버리지 않는다 —
     * 그러면 지정의 의미가 없어진다.
     */
    const pickImage = (
      candidates: string[] | null | undefined,
      fallback: string | null,
      force: boolean,
    ): string | null => {
      const pool = candidates?.length ? candidates : fallback ? [fallback] : [];
      for (const url of pool) {
        if (url && !usedImages.has(url)) return url;
      }
      return force ? (pool[0] ?? null) : null;
    };

    const addSeries = (s: GachaBrowseSeries, force: boolean) => {
      const id = `series-${s.series_id}`;
      if (usedIds.has(id)) return false;
      const img = pickImage(
        s.representative_image_urls,
        s.representative_image_url,
        force,
      );
      if (!img) return false;
      usedImages.add(img);
      usedIds.add(id);
      items.push({
        id,
        label: s.name_ko,
        imageUrl: img,
        onPress: () => onSeriesPress(s),
      });
      return true;
    };

    const addCategory = (c: GachaBrowseCategory, force: boolean) => {
      const id = `category-${c.category_id}`;
      if (usedIds.has(id)) return false;
      const img = pickImage(
        c.representative_image_urls,
        c.representative_image_url,
        force,
      );
      if (!img) return false;
      usedImages.add(img);
      usedIds.add(id);
      items.push({
        id,
        label: c.name_ko,
        imageUrl: img,
        onPress: () => onCategoryPress(c),
      });
      return true;
    };

    // 1) 지정 항목을 순서대로 채운다. 없는 이름은 조용히 건너뛴다.
    for (const name of PINNED_SERIES) {
      const found = series.find((s) => s.name_ko === name);
      if (found) addSeries(found, true);
    }
    for (const name of PINNED_LINES) {
      const found = lines.categories.find((c) => c.name_ko === name);
      if (found) addCategory(found, true);
    }

    /** 이미지가 있고 아직 안 쓰인 첫 항목을 집는다. */
    const pickSeries = (pool: GachaBrowseSeries[], take: number) => {
      let taken = 0;
      for (const s of pool) {
        if (taken >= take) return;
        if (addSeries(s, false)) taken += 1;
      }
    };
    const pickCategory = (pool: GachaBrowseCategory[], take = 1) => {
      let taken = 0;
      for (const c of pool) {
        if (taken >= take) return;
        if (addCategory(c, false)) taken += 1;
      }
    };

    // 2) 지정 항목을 못 찾아 자리가 남으면 축별 상위에서 채운다.
    //
    //    두 축만 쓰는 이유는 이용자가 실제로 찾는 단위가 IP와 가챠 종류이기
    //    때문이다. 상품 종류·소재·장르는 범위가 넓어 대표 항목이 "마스코트",
    //    "동물"처럼 뭉뚱그려진 값이 되어 바로가기로서 변별력이 없다.
    if (items.length < SHORTCUT_SIZE) {
      pickCategory(lines.categories, SHORTCUT_SIZE - items.length);
    }
    if (items.length < SHORTCUT_SIZE) {
      pickSeries(series, SHORTCUT_SIZE - items.length);
    }

    return items.slice(0, SHORTCUT_SIZE);
  }, [stickySections, series, lines.categories, onSeriesPress, onCategoryPress]);

  const handleLayout = useCallback(
    (key: RailKey) => (y: number) => {
      offsets.current[key] = y;
    },
    [],
  );

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (selectedRailKey.current !== null) return;

      const y =
        Math.max(e.nativeEvent.contentOffset.y, 0) + ACTIVE_OFFSET;
      let next: RailKey = visibleKeys[0] ?? "series";
      for (const key of visibleKeys) {
        const offset = offsets.current[key];
        if (offset !== undefined && offset <= y) next = key;
      }
      setActiveKey((prev) => (prev === next ? prev : next));
    },
    [visibleKeys],
  );

  const handleRailPress = useCallback(
    (key: RailKey) => {
      const y = offsets.current[key];
      if (y === undefined || !scrollRef.current) return;

      // 하단에서 이동 거리가 제한되어도 직접 드래그하기 전까지 선택을 유지한다.
      selectedRailKey.current = key;
      setActiveKey(key);
      scrollRef.current.scrollTo({ y, animated: true });
    },
    [],
  );

  const handleScrollBeginDrag = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      selectedRailKey.current = null;
      handleScroll(e);
    },
    [handleScroll],
  );

  if (!enabled) return null;

  const categoryLists = Object.values(categoryListByKey);
  if (stickySections && (loading || categoryLists.some((list) => list.loading))) {
    return <BrowseSectionsSkeleton label={t("browse.loading")} />;
  }

  if (loading) {
    return (
      <View style={styles.stateBox}>
        <ActivityIndicator color={TEXT_GRAY} />
      </View>
    );
  }

  const failedCategories = categoryLists.filter((list) => list.error);
  const showError = stickySections
    ? visibleKeys.length === 0 && (error || failedCategories.length > 0)
    : error;

  if (showError) {
    const retryBrowse = () => {
      if (error) void retry();
      if (stickySections) failedCategories.forEach((list) => void list.retry());
    };
    return (
      <View style={styles.stateBox}>
        <Text style={styles.stateText}>
          {t("browse.loadError", {
            defaultValue: "목록을 불러오지 못했습니다.",
          })}
        </Text>
        <Pressable onPress={retryBrowse} hitSlop={8} accessibilityRole="button">
          <Text style={styles.retry}>
            {t("common.retry", { defaultValue: "다시 시도" })}
          </Text>
        </Pressable>
      </View>
    );
  }

  if (visibleKeys.length === 0) {
    return stickySections ? (
      <View style={styles.stateBox}>
        <Text style={styles.stateText}>{t("browse.empty")}</Text>
      </View>
    ) : null;
  }

  const shortcutContent = shortcuts.length > 0 ? (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.shortcutBar}
      contentContainerStyle={styles.shortcutContent}
    >
      {shortcuts.map((item) => (
        <Pressable
          key={item.id}
          style={styles.shortcutCard}
          onPress={item.onPress}
          accessibilityRole="button"
          accessibilityLabel={item.label}
        >
          <Image
            source={{ uri: item.imageUrl }}
            style={styles.shortcutImage}
            resizeMode="cover"
            accessible={false}
          />
          <LinearGradient
            colors={[TRANSPARENT, IMAGE_GRADIENT_BOTTOM]}
            style={styles.shortcutGradient}
          >
            <Text style={styles.shortcutLabel} numberOfLines={2}>
              {item.label}
            </Text>
          </LinearGradient>
        </Pressable>
      ))}
    </ScrollView>
  ) : null;
  const selectedKey =
    stickySections && !visibleKeys.includes(activeKey)
      ? visibleKeys[0]
      : activeKey;
  const highlightLayout = railLayouts[selectedKey];
  const railContent = (
    <>
      {visibleKeys.map((key) => (
        <Pressable
          key={key}
          style={[
            styles.railItem,
            stickySections && styles.browseRailItem,
            !stickySections && selectedKey === key && styles.railItemActive,
          ]}
          onPress={() => handleRailPress(key)}
          onLayout={
            stickySections
              ? ({ nativeEvent: { layout: { y, height } } }) => {
                  setRailLayouts((layouts) =>
                    layouts[key]?.y === y && layouts[key]?.height === height
                      ? layouts
                      : { ...layouts, [key]: { y, height } },
                  );
                }
              : undefined
          }
          accessibilityRole="button"
          accessibilityState={
            stickySections ? { selected: selectedKey === key } : undefined
          }
        >
          <Text
            style={[
              styles.railItemText,
              stickySections && styles.browseRailItemText,
              selectedKey === key && styles.railItemTextActive,
              stickySections &&
                selectedKey === key &&
                styles.browseRailItemTextActive,
            ]}
            numberOfLines={stickySections ? undefined : 1}
          >
            {railLabels[key]}
          </Text>
        </Pressable>
      ))}
    </>
  );
  const renderSectionRows = (key: RailKey) =>
    key === "series"
      ? series.map((s) => (
          <Row
            key={s.series_id}
            label={s.name_ko}
            count={s.rollup_product_count}
            previewImageUrl={
              stickySections ? s.representative_image_url ?? null : undefined
            }
            onPress={() => onSeriesPress(s)}
          />
        ))
      : categoryListByKey[key].categories
          .slice(0, CATEGORY_PREVIEW_SIZE)
          .map((c) => (
            <Row
              key={c.category_id}
              label={c.name_ko}
              count={c.product_count}
              previewImageUrl={
                stickySections ? c.representative_image_url ?? null : undefined
              }
              onPress={() => onCategoryPress(c)}
            />
          ));
  const renderSectionHeader = (key: RailKey) => (
    <SectionHeader
      title={railLabels[key]}
      compact={stickySections}
      onPress={key === "series" ? onMoreSeries : () => onMoreCategories(key)}
    />
  );
  const sectionContent = visibleKeys.map((key) => (
    <View
      key={key}
      onLayout={(e) => handleLayout(key)(e.nativeEvent.layout.y)}
    >
      {renderSectionHeader(key)}
      {renderSectionRows(key)}
    </View>
  ));
  const measureSectionPart = (
    key: RailKey,
    part: "header" | "rows",
    height: number,
  ) => {
    const heights = (sectionHeights.current[key] ??= {});
    heights[part] = height;
    if (key === visibleKeys[visibleKeys.length - 1]) {
      setLastSectionHeight((heights.header ?? 0) + (heights.rows ?? 0));
    }
  };

  if (stickySections) {
    return (
      <View
        style={[styles.wrap, styles.clipped]}
        onLayout={(e) => setViewportHeight(e.nativeEvent.layout.height)}
      >
        <ScrollView
          ref={scrollRef}
          stickyHeaderIndices={visibleKeys.map((_, index) => 2 * index)}
          bounces={false}
          alwaysBounceVertical={false}
          overScrollMode="never"
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={{
            paddingBottom: Math.max(
              bottomPadding + 24,
              viewportHeight - lastSectionHeight,
            ),
          }}
          onScroll={handleScroll}
          onScrollBeginDrag={handleScrollBeginDrag}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          {visibleKeys.flatMap((key) => [
            <View
              key={`${key}-header`}
              style={[styles.scrollingSections, styles.stickySectionHeader]}
              onLayout={(e) => {
                handleLayout(key)(e.nativeEvent.layout.y);
                measureSectionPart(key, "header", e.nativeEvent.layout.height);
              }}
            >
              {renderSectionHeader(key)}
            </View>,
            <View
              key={`${key}-rows`}
              style={[styles.scrollingSections, styles.browseSectionRows]}
              onLayout={(e) =>
                measureSectionPart(key, "rows", e.nativeEvent.layout.height)
              }
            >
              {renderSectionRows(key)}
            </View>,
          ])}
        </ScrollView>
        <View style={[styles.rail, styles.stickyRail]}>
          {highlightLayout && <BrowseRailHighlight {...highlightLayout} />}
          {railContent}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {shortcutContent}
      <View style={styles.root}>
        <View style={styles.rail}>{railContent}</View>
        <ScrollView
          ref={scrollRef}
          style={styles.content}
          contentContainerStyle={{ paddingBottom: bottomPadding + 24 }}
          onScroll={handleScroll}
          onScrollBeginDrag={handleScrollBeginDrag}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          {sectionContent}
        </ScrollView>
      </View>
    </View>
  );
}

const RAIL_WIDTH = 104;
const BROWSE_RAIL_RADIUS = 12;
const BROWSE_RAIL_INSET = 8;

/** 바로가기 카드의 정사각 썸네일 한 변. */
const SHORTCUT_IMAGE_SIZE = 120;

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
  },
  clipped: {
    overflow: "hidden",
  },
  scrollingSections: {
    marginLeft: RAIL_WIDTH,
    paddingHorizontal: 20,
  },
  stickySectionHeader: {
    backgroundColor: WHITE,
  },
  browseSectionRows: {
    paddingBottom: 12,
  },
  stickyRail: {
    backgroundColor: WHITE,
    paddingHorizontal: BROWSE_RAIL_INSET,
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
  },
  /** 가로 스크롤이지만 flex:1이 걸리면 세로를 다 먹으므로 높이를 내용에 맡긴다. */
  shortcutBar: {
    flexGrow: 0,
    paddingBottom: 12,
  },
  shortcutContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  shortcutCard: {
    width: SHORTCUT_IMAGE_SIZE,
    height: SHORTCUT_IMAGE_SIZE,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: GRAY_100,
  },
  shortcutImage: {
    ...StyleSheet.absoluteFillObject,
  },
  shortcutGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingTop: 40,
    paddingBottom: 10,
  },
  shortcutLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: WHITE,
    lineHeight: 18,
  },
  root: {
    flex: 1,
    flexDirection: "row",
  },
  /** 레일 전체가 회색 판이고, 활성 항목만 흰색으로 떠올라 오른쪽 콘텐츠와 이어진다. */
  rail: {
    width: RAIL_WIDTH,
    backgroundColor: GRAY_100,
  },
  railItem: {
    paddingVertical: 20,
    paddingHorizontal: 14,
  },
  railItemActive: {
    backgroundColor: WHITE,
  },
  railItemText: {
    fontSize: 15,
    fontWeight: "500",
    color: TEXT_GRAY,
  },
  railItemTextActive: {
    fontWeight: "700",
    color: TEXT_DARK,
  },
  browseRailItem: {
    minHeight: 48,
    borderRadius: BROWSE_RAIL_RADIUS,
    paddingHorizontal: 12,
    paddingVertical: 14,
    justifyContent: "center",
  },
  browseRailGlass: {
    flex: 1,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  browseRailHighlight: {
    position: "absolute",
    top: 0,
    left: BROWSE_RAIL_INSET,
    right: BROWSE_RAIL_INSET,
  },
  browseRailItemText: {
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 20,
  },
  browseRailItemTextActive: {
    color: PRIMARY,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 24,
    paddingBottom: 12,
  },
  sectionHeaderTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: TEXT_DARK,
  },
  sectionHeaderMore: {
    fontSize: 13,
    color: TEXT_GRAY,
  },
  browseHeader: {
    paddingTop: 20,
    gap: 8,
  },
  skeletonHeader: {
    minHeight: 54,
  },
  browseHeaderTitle: {
    flexShrink: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  browseHeaderMore: {
    fontSize: 12,
    lineHeight: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: GRAY_100,
  },
  rowLabel: {
    flex: 1,
    fontSize: 16,
    color: TEXT_DARK,
  },
  rowCount: {
    fontSize: 13,
    color: TEXT_GRAY,
  },
  stateBox: {
    paddingVertical: 32,
    alignItems: "center",
    gap: 12,
    backgroundColor: GRAY_100,
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 12,
  },
  stateText: {
    fontSize: 13,
    color: TEXT_GRAY,
  },
  retry: {
    fontSize: 13,
    fontWeight: "700",
    color: TEXT_DARK,
  },
});
