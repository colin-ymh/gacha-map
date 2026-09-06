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
import type {
  BrowsableCategoryType,
  GachaBrowseCategory,
  GachaBrowseSeries,
} from "@gacha-map/shared";
import { GRAY_100, TEXT_DARK, TEXT_GRAY, WHITE } from "@/constants/colors";
import { useGachaBrowse } from "@/hooks/useGachaBrowse";
import { useBrowseCategoryList } from "@/hooks/useGachaBrowseLists";

interface Props {
  /** 가챠 탭이 열려 있고 검색어가 비어 있을 때만 true. 그때만 데이터를 받는다. */
  enabled: boolean;
  onCategoryPress: (category: GachaBrowseCategory) => void;
  onSeriesPress: (series: GachaBrowseSeries) => void;
  onMoreSeries: () => void;
  onMoreCategories: (type: BrowsableCategoryType) => void;
  /** 오른쪽 목록 맨 아래 여백. 하단 탭바에 가려지지 않게 호출부가 넘긴다. */
  bottomPadding?: number;
}

type RailKey = "series" | "product_type" | "subject" | "genre" | "line";

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
}: Props) {
  const { t } = useTranslation();
  const { series, loading, error, retry } = useGachaBrowse(enabled);
  const productTypes = useBrowseCategoryList("product_type");
  const subjects = useBrowseCategoryList("subject");
  const genres = useBrowseCategoryList("genre");
  const lines = useBrowseCategoryList("line");

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
    const pickCategory = (pool: GachaBrowseCategory[], take = 1) => {
      let taken = 0;
      for (const c of pool) {
        if (taken >= take) return;
        const img = c.representative_image_url;
        if (!img || usedImages.has(img)) continue;
        usedImages.add(img);
        items.push({
          id: `category-${c.category_id}`,
          label: c.name_ko,
          imageUrl: img,
          onPress: () => onCategoryPress(c),
        });
        taken += 1;
      }
    };

    // 쿼터: 시리즈 2 + 제품 라인 3 = 5개.
    //
    // 이 두 축만 쓰는 이유는 이용자가 실제로 찾는 단위가 IP와 가챠 종류이기
    // 때문이다. 상품 종류·소재·장르는 범위가 넓어 대표 항목이 "마스코트",
    // "동물"처럼 뭉뚱그려진 값이 되어 바로가기로서 변별력이 없다.
    //
    // 이름을 박지 않고 축별 상위에서 뽑는다. 택소노미가 바뀌면 목록도 따라
    // 움직여야 하고, 고정 id는 항목이 사라질 때 죽은 링크가 된다.
    pickSeries(series, 2);
    pickCategory(lines.categories, 3);

    // 빈 축이 있어 5개가 안 되면 시리즈에서 채운다.
    if (items.length < SHORTCUT_SIZE) {
      pickSeries(series, SHORTCUT_SIZE - items.length);
    }

    return items.slice(0, SHORTCUT_SIZE);
  }, [series, lines.categories, onSeriesPress, onCategoryPress]);

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
          {/*
            섹션은 RAIL_KEYS 순서를 그대로 따라 그린다. 예전에는 각 축을 JSX에
            직접 나열했는데, 그러면 순서가 RAIL_KEYS와 JSX 두 곳에 존재해
            한쪽만 바뀌면 좌측 레일과 본문 순서가 어긋난다(실제로 그랬다).
            스크롤스파이도 visibleKeys 순서로 offsets를 훑으므로 같이 깨진다.
          */}
          {visibleKeys.map((key) => (
            <View
              key={key}
              onLayout={(e) => handleLayout(key)(e.nativeEvent.layout.y)}
            >
              <SectionHeader
                title={railLabels[key]}
                onPress={
                  key === "series" ? onMoreSeries : () => onMoreCategories(key)
                }
              />
              {key === "series"
                ? series.map((s) => (
                    <Row
                      key={s.series_id}
                      label={s.name_ko}
                      count={s.rollup_product_count}
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
                        onPress={() => onCategoryPress(c)}
                      />
                    ))}
            </View>
          ))}
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
