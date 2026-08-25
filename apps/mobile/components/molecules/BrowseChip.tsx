import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { GRAY_100, PRIMARY, PRIMARY_BG, TEXT_DARK, TEXT_GRAY } from "@/constants/colors";

interface Props {
  label: string;
  /** 우측 배지 숫자. 생략하면 라벨만 보인다. */
  count?: number;
  selected?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}

/**
 * 탐색 화면 공용 칩.
 *
 * 코드베이스에 공용 칩이 없어 SearchOverlay·GachaChangePickerModal 등에 개별 구현이
 * 흩어져 있었다. 탐색 화면은 칩을 대량으로 쓰므로 여기서 하나로 모은다.
 *
 * 치수는 Penpot 「가챠 카테고리·시리즈 탐색 기획」 §15-2 실측값이다.
 */
export function BrowseChip({
  label,
  count,
  selected = false,
  onPress,
  accessibilityLabel,
}: Props) {
  const content = (
    <View style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={1}>
        {label}
      </Text>
      {count != null && (
        <Text style={[styles.count, selected && styles.countSelected]}>
          {count.toLocaleString()}
        </Text>
      )}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      hitSlop={4}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 32,
    borderRadius: 16,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: GRAY_100,
  },
  chipSelected: {
    backgroundColor: PRIMARY_BG,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: TEXT_DARK,
  },
  labelSelected: {
    fontWeight: "700",
    color: PRIMARY,
  },
  count: {
    fontSize: 11,
    fontWeight: "400",
    color: TEXT_GRAY,
  },
  countSelected: {
    color: PRIMARY,
  },
});
