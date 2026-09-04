import React, { useCallback, useMemo, useRef, useState } from "react";
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
import { useTranslation } from "react-i18next";
import type { GachaBrowseCategory, GachaBrowseSeries } from "@gacha-map/shared";
import { GRAY_100, TEXT_DARK, TEXT_GRAY, WHITE } from "@/constants/colors";
import { useGachaBrowse } from "@/hooks/useGachaBrowse";
import { useBrowseCategoryList } from "@/hooks/useGachaBrowseLists";

interface Props {
  /** 가챠 탭이 열려 있고 검색어가 비어 있을 때만 true. 그때만 데이터를 받는다. */
  enabled: boolean;
  onCategoryPress: (category: GachaBrowseCategory) => void;
  onSeriesPress: (series: GachaBrowseSeries) => void;
  onMoreSeries: () => void;
  onMoreCategories: (type: "product_type" | "subject" | "genre") => void;
  /** 오른쪽 목록 맨 아래 여백. 하단 탭바에 가려지지 않게 호출부가 넘긴다. */
  bottomPadding?: number;
}

type RailKey = "series" | "product_type" | "subject" | "genre";

const RAIL_KEYS: RailKey[] = ["series", "product_type", "subject", "genre"];

/** 카테고리 축 미리보기 개수. 나머지는 "전체" 눌러 별도 화면에서 본다. */
const CATEGORY_PREVIEW_SIZE = 8;

/** 검색창 아래 바로가기 칩 개수. */
const SHORTCUT_SIZE = 5;

/** 스크롤 위치가 섹션 상단을 이 값만큼 지나야 그 섹션을 활성으로 본다. */
const ACTIVE_OFFSET = 24;

function Row({
  label,
  count,
  onPress,
}: {
  label: string;
  count: number;
  onPress: () => void;
}) {
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
}: {
  title: string;
  onPress?: () => void;
}) {
  const { t } = useTranslation();

  if (!onPress) {
    return (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderTitle}>{title}</Text>
      </View>
    );
  }

  return (
    <Pressable
      style={styles.sectionHeader}
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
    >
      <Text style={styles.sectionHeaderTitle}>{title}</Text>
      <Text style={styles.sectionHeaderMore}>
        {t("browse.all", { defaultValue: "전체" })} ›
      </Text>
    </Pressable>
  );
}

/**
 * 둘러보기 화면. 왼쪽 레일(시리즈/상품 종류/소재/장르) + 오른쪽 스크롤 목록.
 *
 * 레일을 누르면 그 섹션으로 스크롤하고, 스크롤하면 레일이 따라 강조된다(스크롤스파이).
 * 축 4개가 서로 독립적(계층 아님)이라 데일리샷류 카테고리 화면과 달리 상위-하위 관계는
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
}: Props) {
  const { t } = useTranslation();
  const { series, loading, error, retry } = useGachaBrowse(enabled);
  const productTypes = useBrowseCategoryList("product_type");
  const subjects = useBrowseCategoryList("subject");
  const genres = useBrowseCategoryList("genre");

  const scrollRef = useRef<ScrollView>(null);
  const offsets = useRef<Partial<Record<RailKey, number>>>({});
  const [activeKey, setActiveKey] = useState<RailKey>("series");

  const railLabels: Record<RailKey, string> = useMemo(
    () => ({
      series: t("browse.section.popularSeries", { defaultValue: "시리즈" }),
      product_type: t("browse.section.productType", {
        defaultValue: "상품 종류",
      }),
      subject: t("browse.section.subject", { defaultValue: "소재" }),
      genre: t("browse.section.genre", { defaultValue: "장르" }),
    }),
    [t],
  );

  const visibleKeys = RAIL_KEYS.filter((key) => {
    if (key === "series") return series.length > 0;
    if (key === "product_type") return productTypes.categories.length > 0;
    if (key === "subject") return subjects.categories.length > 0;
    return genres.categories.length > 0;
  });

  /**
   * 검색창 바로 아래 붙는 바로가기 카드.
   *
   * 목록을 스크롤하지 않고도 가장 많이 찾을 항목으로 바로 가게 한다. 고정 id를
   * 박아두면 택소노미가 바뀔 때 죽은 링크가 되므로, 이미 받아둔 데이터에서
   * 축별 상위 항목을 뽑아 구성한다. 상품 수는 축을 넘나들며 비교할 수 없어서
   * (마스코트 1,578 vs 산리오 388) 전체 정렬 대신 축별 쿼터를 준다.
   *
   * 대표 이미지는 "가장 최신 릴리스"로 뽑히기 때문에 넓은 축일수록 같은 상품을
   * 물어온다 — dev 실측에서 산리오/동물/애니메이션/유아동/파우치/패션이 전부 같은
   * 이미지였다. 카드 5장 중 3장이 같은 썸네일이면 안 되므로, 이미 쓴 이미지가
   * 나오면 그 축의 다음 항목으로 넘어간다. 1위 대신 2위가 뜨는 건 감수한다.
   */
  const shortcuts = useMemo(() => {
    const items: {
      id: string;
      label: string;
      imageUrl: string;
      onPress: () => void;
    }[] = [];
    const usedImages = new Set<string>();

    /** 이미지가 있고 아직 안 쓰인 첫 항목을 집는다. */
    const pickSeries = (pool: GachaBrowseSeries[], take: number) => {
      let taken = 0;
      for (const s of pool) {
        if (taken >= take) return;
        const img = s.representative_image_url;
        if (!img || usedImages.has(img)) continue;
        usedImages.add(img);
        items.push({
          id: `series-${s.series_id}`,
          label: s.name_ko,
          imageUrl: img,
          onPress: () => onSeriesPress(s),
        });
        taken += 1;
      }
    };
    const pickCategory = (pool: GachaBrowseCategory[]) => {
      for (const c of pool) {
        const img = c.representative_image_url;
        if (!img || usedImages.has(img)) continue;
        usedImages.add(img);
        items.push({
          id: `category-${c.category_id}`,
          label: c.name_ko,
          imageUrl: img,
          onPress: () => onCategoryPress(c),
        });
        return;
      }
    };

    // 쿼터: 시리즈 2 + 나머지 축 각 1 = 5개.
    pickSeries(series, 2);
    pickCategory(productTypes.categories);
    pickCategory(subjects.categories);
    pickCategory(genres.categories);

    // 빈 축이 있어 5개가 안 되면 시리즈에서 채운다.
    if (items.length < SHORTCUT_SIZE) {
      pickSeries(series, SHORTCUT_SIZE - items.length);
    }

    return items.slice(0, SHORTCUT_SIZE);
  }, [
    series,
    productTypes.categories,
    subjects.categories,
    genres.categories,
    onSeriesPress,
    onCategoryPress,
  ]);

  const handleLayout = useCallback(
    (key: RailKey) => (y: number) => {
      offsets.current[key] = y;
    },
    [],
  );

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y + ACTIVE_OFFSET;
      let next: RailKey = visibleKeys[0] ?? "series";
      for (const key of visibleKeys) {
        const offset = offsets.current[key];
        if (offset !== undefined && offset <= y) next = key;
      }
      setActiveKey((prev) => (prev === next ? prev : next));
    },
    [visibleKeys],
  );

  const handleRailPress = useCallback((key: RailKey) => {
    setActiveKey(key);
    const y = offsets.current[key];
    if (y !== undefined) {
      scrollRef.current?.scrollTo({ y, animated: true });
    }
  }, []);

  if (!enabled) return null;

  if (loading) {
    return (
      <View style={styles.stateBox}>
        <ActivityIndicator color={TEXT_GRAY} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.stateBox}>
        <Text style={styles.stateText}>
          {t("browse.loadError", {
            defaultValue: "목록을 불러오지 못했습니다.",
          })}
        </Text>
        <Pressable onPress={retry} hitSlop={8} accessibilityRole="button">
          <Text style={styles.retry}>
            {t("common.retry", { defaultValue: "다시 시도" })}
          </Text>
        </Pressable>
      </View>
    );
  }

  if (visibleKeys.length === 0) return null;

  return (
    <View style={styles.wrap}>
      {shortcuts.length > 0 && (
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
            >
              <Image
                source={{ uri: item.imageUrl }}
                style={styles.shortcutImage}
              />
              <Text style={styles.shortcutLabel} numberOfLines={1}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <View style={styles.root}>
        <View style={styles.rail}>
          {visibleKeys.map((key) => (
            <Pressable
              key={key}
              style={[
                styles.railItem,
                activeKey === key && styles.railItemActive,
              ]}
              onPress={() => handleRailPress(key)}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.railItemText,
                  activeKey === key && styles.railItemTextActive,
                ]}
                numberOfLines={1}
              >
                {railLabels[key]}
              </Text>
            </Pressable>
          ))}
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.content}
          contentContainerStyle={{ paddingBottom: bottomPadding + 24 }}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          {visibleKeys.includes("series") && (
            <View
              onLayout={(e) => handleLayout("series")(e.nativeEvent.layout.y)}
            >
              <SectionHeader title={railLabels.series} onPress={onMoreSeries} />
              {series.map((s) => (
                <Row
                  key={s.series_id}
                  label={s.name_ko}
                  count={s.rollup_product_count}
                  onPress={() => onSeriesPress(s)}
                />
              ))}
            </View>
          )}

          {visibleKeys.includes("product_type") && (
            <View
              onLayout={(e) =>
                handleLayout("product_type")(e.nativeEvent.layout.y)
              }
            >
              <SectionHeader
                title={railLabels.product_type}
                onPress={() => onMoreCategories("product_type")}
              />
              {productTypes.categories
                .slice(0, CATEGORY_PREVIEW_SIZE)
                .map((c) => (
                  <Row
                    key={c.category_id}
                    label={c.name_ko}
                    count={c.product_count}
                    onPress={() => onCategoryPress(c)}
                  />
                ))}
            </View>
          )}

          {visibleKeys.includes("subject") && (
            <View
              onLayout={(e) => handleLayout("subject")(e.nativeEvent.layout.y)}
            >
              <SectionHeader
                title={railLabels.subject}
                onPress={() => onMoreCategories("subject")}
              />
              {subjects.categories.slice(0, CATEGORY_PREVIEW_SIZE).map((c) => (
                <Row
                  key={c.category_id}
                  label={c.name_ko}
                  count={c.product_count}
                  onPress={() => onCategoryPress(c)}
                />
              ))}
            </View>
          )}

          {visibleKeys.includes("genre") && (
            <View
              onLayout={(e) => handleLayout("genre")(e.nativeEvent.layout.y)}
            >
              <SectionHeader
                title={railLabels.genre}
                onPress={() => onMoreCategories("genre")}
              />
              {genres.categories.slice(0, CATEGORY_PREVIEW_SIZE).map((c) => (
                <Row
                  key={c.category_id}
                  label={c.name_ko}
                  count={c.product_count}
                  onPress={() => onCategoryPress(c)}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const RAIL_WIDTH = 104;

/** 바로가기 카드의 정사각 썸네일 한 변. 5장 중 4장 남짓이 화면에 걸쳐 보인다. */
const SHORTCUT_IMAGE_SIZE = 76;

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
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
    gap: 6,
  },
  shortcutImage: {
    width: SHORTCUT_IMAGE_SIZE,
    height: SHORTCUT_IMAGE_SIZE,
    borderRadius: 12,
    backgroundColor: GRAY_100,
  },
  shortcutLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: TEXT_DARK,
    textAlign: "center",
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
