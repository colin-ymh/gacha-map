import React from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { SkeletonBone } from "@/components/ui/Skeleton";
import {
  GRAY_100,
  GRAY_200,
  GRAY_300,
  PRIMARY,
  SCRIM_LIGHT,
  TEXT_DARK,
  TEXT_GRAY,
  WHITE,
} from "@/constants/colors";

export interface AxisOption {
  id: string;
  label: string;
  count: number;
}

interface Props {
  visible: boolean;
  title: string;
  options: AxisOption[];
  /** 현재 선택된 id 들. 같은 축 안이므로 OR 로 결합된다. 기획서 §17-4. */
  selectedIds: string[];
  loading?: boolean;
  error?: boolean;
  /** 적용 버튼에 띄울 예상 결과 수. null 이면 개수를 숨긴다. */
  resultCount: number | null;
  onToggle: (id: string) => void;
  onReset: () => void;
  onRetry: () => void;
  onApply: () => void;
  onClose: () => void;
}

/**
 * 축 선택 바텀시트. 기획서 §18.
 *
 * 디자인 시스템상 바텀시트에 LiquidGlass 를 쓸 수 있지만 여기서는 목록 가독성이
 * 우선이라 불투명 흰색을 쓴다. 글래스는 지도 미니카드처럼 배경을 비춰야 의미가
 * 있는 경우로 한정한다.
 */
export function AxisPickerSheet({
  visible,
  title,
  options,
  selectedIds,
  loading = false,
  error = false,
  resultCount,
  onToggle,
  onReset,
  onRetry,
  onApply,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.dim}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t("common.cancel")}
      />

      <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.handle} />

        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {selectedIds.length > 0 && (
            <Text style={styles.selectedCount}>
              {t("browse.sheet.selectedCount", {
                count: selectedIds.length,
                defaultValue: `${selectedIds.length}개 선택됨`,
              })}
            </Text>
          )}
        </View>
        <View style={styles.headerSep} />

        {loading ? (
          <View
            style={styles.list}
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={t("browse.loading")}
            accessibilityState={{ busy: true }}
          >
            {[92, 120, 76].map((width) => (
              <View key={width} style={styles.row}>
                <SkeletonBone width={22} height={22} />
                <SkeletonBone width={width} height={14} />
              </View>
            ))}
          </View>
        ) : error ? (
          <View style={styles.listState}>
            <Text style={styles.rowCount}>{t("browse.loadError")}</Text>
            <Pressable onPress={onRetry} hitSlop={8} accessibilityRole="button">
              <Text style={styles.retry}>
                {t("common.retry", { defaultValue: "다시 시도" })}
              </Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            style={styles.list}
            data={options}
            extraData={selectedIds}
            keyExtractor={(item) => item.id}
            initialNumToRender={8}
            ItemSeparatorComponent={() => <View style={styles.rowSep} />}
            ListEmptyComponent={
              <View style={styles.listState}>
                <Text style={styles.rowCount}>{t("browse.empty")}</Text>
              </View>
            }
            renderItem={({ item: opt }) => {
              const on = selectedIds.includes(opt.id);
              return (
                <Pressable
                  style={styles.row}
                  onPress={() => onToggle(opt.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                >
                  <View style={[styles.checkbox, on && styles.checkboxOn]}>
                    {on && <Text style={styles.check}>✓</Text>}
                  </View>
                  <Text
                    style={[styles.rowLabel, on && styles.rowLabelOn]}
                    numberOfLines={1}
                  >
                    {opt.label}
                  </Text>
                  <Text style={styles.rowCount}>
                    {opt.count.toLocaleString()}
                  </Text>
                </Pressable>
              );
            }}
          />
        )}

        <View style={styles.footerSep} />
        <View style={styles.footer}>
          <Pressable style={styles.resetBtn} onPress={onReset}>
            <Text style={styles.resetText}>
              {t("browse.filter.reset", { defaultValue: "초기화" })}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.applyBtn, resultCount === 0 && styles.applyDisabled]}
            onPress={onApply}
            disabled={resultCount === 0}
          >
            <Text style={styles.applyText}>
              {resultCount == null
                ? t("browse.sheet.applyFilters")
                : resultCount === 0
                  ? t("browse.sheet.applyEmpty")
                  : t("browse.sheet.apply", { count: resultCount })}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: { flex: 1, backgroundColor: SCRIM_LIGHT },
  sheet: {
    backgroundColor: WHITE,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "50%",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: GRAY_300,
    alignSelf: "center",
    marginTop: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: { fontSize: 18, fontWeight: "700", color: TEXT_DARK },
  selectedCount: { fontSize: 13, color: TEXT_GRAY },
  headerSep: { height: 1, backgroundColor: GRAY_100, marginHorizontal: 16 },
  list: { flexGrow: 0, flexShrink: 1 },
  listState: { padding: 16, alignItems: "center", gap: 8 },
  retry: { color: TEXT_DARK, fontSize: 13, fontWeight: "700" },
  row: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: GRAY_200,
    backgroundColor: WHITE,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  check: { color: WHITE, fontSize: 13, fontWeight: "700" },
  rowLabel: { flex: 1, fontSize: 15, color: TEXT_DARK },
  rowLabelOn: { fontWeight: "600" },
  rowCount: { fontSize: 13, color: TEXT_GRAY },
  rowSep: { height: 1, backgroundColor: GRAY_100, marginLeft: 50 },
  footerSep: { height: 1, backgroundColor: GRAY_100 },
  footer: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  resetBtn: {
    width: 100,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GRAY_200,
    backgroundColor: WHITE,
    alignItems: "center",
    justifyContent: "center",
  },
  resetText: { fontSize: 15, fontWeight: "600", color: TEXT_GRAY },
  applyBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
  },
  applyDisabled: { backgroundColor: GRAY_100 },
  applyText: { fontSize: 15, fontWeight: "700", color: WHITE },
});
