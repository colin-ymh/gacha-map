import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import type { GachaCategoryType } from "@gacha-map/shared";
import { GlassBackButton } from "@/components/ui/GlassBackButton";
import { useBrowseCategoryList } from "@/hooks/useGachaBrowseLists";
import { GRAY_100, TEXT_DARK, TEXT_GRAY, WHITE } from "@/constants/colors";

const TITLE_KEYS: Record<
  string,
  { key: string; fallback: string }
> = {
  product_type: { key: "browse.section.productType", fallback: "상품 종류" },
  subject: { key: "browse.section.subject", fallback: "소재" },
  genre: { key: "browse.section.genre", fallback: "장르" },
  line: { key: "browse.section.line", fallback: "제품 라인" },
};

/** 축(type)별 카테고리 전체 목록. 기획서 §4. */
export default function BrowseCategoriesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ type?: string }>();

  const type = (
    TITLE_KEYS[params.type ?? ""] ? params.type : "product_type"
  ) as GachaCategoryType;

  const { categories, loading, error, retry } = useBrowseCategoryList(type);
  const title = TITLE_KEYS[type];

  return (
    <View style={styles.root}>
      <View style={[styles.backWrap, { top: insets.top + 8 }]}>
        <GlassBackButton onPress={() => router.back()} />
      </View>

      <Text style={[styles.title, { top: insets.top + 20 }]}>
        {t(title.key, { defaultValue: title.fallback })}
      </Text>

      {loading ? (
        <View style={[styles.center, { paddingTop: insets.top + 120 }]}>
          <ActivityIndicator color={TEXT_GRAY} />
        </View>
      ) : error ? (
        <View style={[styles.center, { paddingTop: insets.top + 120 }]}>
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
          data={categories}
          keyExtractor={(item) => item.category_id}
          contentContainerStyle={{
            paddingTop: insets.top + 60,
            paddingBottom: insets.bottom + 24,
          }}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() =>
                router.push(`/browse/category/${item.category_id}`)
              }
              accessibilityRole="button"
            >
              <Text style={styles.rowName} numberOfLines={1}>
                {item.name_ko}
              </Text>
              <Text style={styles.rowCount}>
                {item.product_count.toLocaleString()}
              </Text>
            </Pressable>
          )}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
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
  center: { flex: 1, alignItems: "center", gap: 12 },
  stateText: { fontSize: 13, color: TEXT_GRAY },
  retry: { fontSize: 13, fontWeight: "700", color: TEXT_DARK },
  row: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  rowName: { flex: 1, fontSize: 14, fontWeight: "600", color: TEXT_DARK },
  rowCount: { fontSize: 13, color: TEXT_GRAY, marginLeft: 12 },
  sep: { height: 1, backgroundColor: GRAY_100, marginHorizontal: 16 },
});
