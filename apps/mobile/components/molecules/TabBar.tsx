import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { PRIMARY, TEXT_GRAY, WHITE, BORDER } from "@/constants/colors";

export type TabKey = "products" | "reviews";

export interface TabBarProps {
  tabs: { key: TabKey; label: string }[];
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
}

const TabBar = ({ tabs, activeTab, onTabChange }: TabBarProps) => (
  <View style={styles.bar}>
    {tabs.map(({ key, label }) => {
      const active = activeTab === key;
      return (
        <TouchableOpacity
          key={key}
          style={[styles.tab, active && styles.tabActive]}
          onPress={() => onTabChange(key)}
          activeOpacity={0.7}
        >
          <Text style={[styles.label, active && styles.labelActive]}>
            {label}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: WHITE,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: PRIMARY,
  },
  label: {
    fontSize: 14,
    color: TEXT_GRAY,
  },
  labelActive: {
    fontWeight: "600",
    color: PRIMARY,
  },
});

export default TabBar;
