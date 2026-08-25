import React from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import {
  GRAY_100,
  GRAY_200,
  PRIMARY,
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
  /** 적용 버튼에 띄울 예상 결과 수. null 이면 개수를 숨긴다. */
  resultCount: number | null;
  onToggle: (id: string) => void;
  onReset: () => void;
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
  resultCount,
  onToggle,
  onReset,
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
      <Pressable style={styles.dim} onPress={onClose} />

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

        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {options.map((opt, idx) => {
            const on = selectedIds.includes(opt.id);
            return (
              <View key={opt.id}>
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
                {idx < options.length - 1 && <View style={styles.rowSep} />}
              </View>
            );
          })}
        </ScrollView>

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
            {loading ? (
              <ActivityIndicator color={WHITE} />
            ) : (
              <Text style={styles.applyText}>
                {resultCount === 0
                  ? t("browse.sheet.applyEmpty", {
                      defaultValue: "조건에 맞는 상품 없음",
                    })
                  : t("browse.sheet.apply", {
                      count: resultCount ?? 0,
                      defaultValue: `${(resultCount ?? 0).toLocaleString()}개 상품 보기`,
                    })}
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    backgroundColor: WHITE,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "62%",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#DDDDDD",
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
  headerSep: { height: 1, backgroundColor: "#EEEEEE", marginHorizontal: 16 },
  list: { flexGrow: 0 },
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
  rowSep: { height: 1, backgroundColor: "#F5F5F5", marginLeft: 50 },
  footerSep: { height: 1, backgroundColor: "#EEEEEE" },
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
