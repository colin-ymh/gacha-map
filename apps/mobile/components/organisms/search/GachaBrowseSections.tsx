import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { GachaBrowseCategory, GachaBrowseSeries } from "@gacha-map/shared";
import { BrowseChip } from "@/components/molecules/BrowseChip";
import { GRAY_100, TEXT_DARK, TEXT_GRAY } from "@/constants/colors";
import { useGachaBrowse } from "@/hooks/useGachaBrowse";

interface Props {
  /** 가챠 탭이 열려 있고 검색어가 비어 있을 때만 true. 그때만 데이터를 받는다. */
  enabled: boolean;
  onCategoryPress: (category: GachaBrowseCategory) => void;
  onSeriesPress: (series: GachaBrowseSeries) => void;
  onMoreCategories: (type: "product_type" | "subject" | "genre") => void;
  onMoreSeries: () => void;
}

interface SectionProps {
  title: string;
  onMore: () => void;
  children: React.ReactNode;
}

/** 섹션 헤더 + 더보기. 기존 코드베이스에 없던 패턴이라 여기서 정의한다. 기획서 §15-3. */
function Section({ title, onMore, children }: SectionProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Pressable onPress={onMore} hitSlop={8} accessibilityRole="button">
          <Text style={styles.more}>
            {t("browse.more", { defaultValue: "더보기" })} ›
          </Text>
        </Pressable>
      </View>
      <View style={styles.chipWrap}>{children}</View>
    </View>
  );
}

/**
 * 검색 오버레이 가챠 탭의 둘러보기 섹션.
 *
 * 노션 「가챠 카테고리·시리즈 탐색 기획」 §3.
 * 상품 수가 0인 값은 API 단에서 이미 빠지므로 여기서 다시 거르지 않는다.
 */
export function GachaBrowseSections({
  enabled,
  onCategoryPress,
  onSeriesPress,
  onMoreCategories,
  onMoreSeries,
}: Props) {
  const { t } = useTranslation();
  const { data, loading, error, retry } = useGachaBrowse(enabled);

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
          {t("browse.loadError", { defaultValue: "목록을 불러오지 못했습니다." })}
        </Text>
        <Pressable onPress={retry} hitSlop={8} accessibilityRole="button">
          <Text style={styles.retry}>
            {t("common.retry", { defaultValue: "다시 시도" })}
          </Text>
        </Pressable>
      </View>
    );
  }

  const hasAnything =
    data.productTypes.length > 0 ||
    data.subjects.length > 0 ||
    data.genres.length > 0 ||
    data.popularSeries.length > 0;

  if (!hasAnything) return null;

  return (
    <View style={styles.root}>
      <Text style={styles.heading}>
        {t("browse.title", { defaultValue: "둘러보기" })}
      </Text>

      {data.productTypes.length > 0 && (
        <Section
          title={t("browse.section.productType", { defaultValue: "상품 종류" })}
          onMore={() => onMoreCategories("product_type")}
        >
          {data.productTypes.map((c) => (
            <BrowseChip
              key={c.category_id}
              label={c.name_ko}
              count={c.product_count}
              onPress={() => onCategoryPress(c)}
            />
          ))}
        </Section>
      )}

      {data.subjects.length > 0 && (
        <Section
          title={t("browse.section.subject", { defaultValue: "소재" })}
          onMore={() => onMoreCategories("subject")}
        >
          {data.subjects.map((c) => (
            <BrowseChip
              key={c.category_id}
              label={c.name_ko}
              count={c.product_count}
              onPress={() => onCategoryPress(c)}
            />
          ))}
        </Section>
      )}

      {data.genres.length > 0 && (
        <Section
          title={t("browse.section.genre", { defaultValue: "장르" })}
          onMore={() => onMoreCategories("genre")}
        >
          {data.genres.map((c) => (
            <BrowseChip
              key={c.category_id}
              label={c.name_ko}
              count={c.product_count}
              onPress={() => onCategoryPress(c)}
            />
          ))}
        </Section>
      )}

      {data.popularSeries.length > 0 && (
        <Section
          title={t("browse.section.popularSeries", {
            defaultValue: "인기 시리즈",
          })}
          onMore={onMoreSeries}
        >
          {data.popularSeries.map((s) => (
            <BrowseChip
              key={s.series_id}
              label={s.name_ko}
              count={s.rollup_product_count}
              onPress={() => onSeriesPress(s)}
            />
          ))}
        </Section>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 16,
    gap: 24,
  },
  heading: {
    fontSize: 15,
    fontWeight: "700",
    color: TEXT_DARK,
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: TEXT_DARK,
  },
  more: {
    fontSize: 12,
    fontWeight: "400",
    color: TEXT_GRAY,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
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
