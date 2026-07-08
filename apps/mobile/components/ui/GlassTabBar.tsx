import { TouchableOpacity, View, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { PRIMARY, TEXT_GRAY, GLASS_SPECULAR, BLACK } from "@/constants/colors";

const TAB_CONFIG: Record<
  string,
  { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }
> = {
  index: { active: "dice", inactive: "dice-outline" },
  map: { active: "map", inactive: "map-outline" },
  search: { active: "heart", inactive: "heart-outline" },
  profile: { active: "person", inactive: "person-outline" },
};

export default function GlassTabBar({ state, navigation }: BottomTabBarProps) {
  const visibleRoutes = state.routes.filter(
    (r) => !r.name.endsWith(".view"),
  );

  return (
    <SafeAreaView edges={["bottom"]} style={styles.safeArea} pointerEvents="box-none">
      <View style={styles.container}>
        <BlurView
          intensity={65}
          tint="systemUltraThinMaterialLight"
          style={styles.blur}
        >
          {/* specular highlight */}
          <View style={styles.specular} />
          <View style={styles.row}>
            {visibleRoutes.map((route) => {
              const isFocused =
                state.index === state.routes.indexOf(route);
              const config = TAB_CONFIG[route.name];
              if (!config) return null;

              const onPress = () => {
                const event = navigation.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              };

              return (
                <TouchableOpacity
                  key={route.key}
                  onPress={onPress}
                  style={styles.tab}
                  activeOpacity={0.6}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isFocused }}
                >
                  <Ionicons
                    name={isFocused ? config.active : config.inactive}
                    size={26}
                    color={isFocused ? PRIMARY : TEXT_GRAY}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        </BlurView>
      </View>
    </SafeAreaView>
  );
}

const PILL_RADIUS = 28;

const styles = StyleSheet.create({
  safeArea: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "transparent",
  },
  container: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: PILL_RADIUS,
    overflow: "hidden",
    shadowColor: BLACK,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 12,
  },
  specular: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: GLASS_SPECULAR,
  },
  blur: {
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    height: 56,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
