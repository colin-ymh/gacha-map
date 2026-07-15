import { TouchableOpacity, View, StyleSheet, Animated, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { TEXT_DARK, TEXT_GRAY, BLACK, GLASS_BORDER, GLASS_SPECULAR } from "@/constants/colors";
import { useAppSelector } from "@/store/hooks";
import { useLiquidGlassPress } from "@/hooks/useLiquidGlassPress";
import { BlurViewCompat } from "@/components/ui/BlurViewCompat";

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
  const visibleRoutes = state.routes.filter((r) => !r.name.endsWith(".view"));
  const selectedShopId = useAppSelector((s) => s.shops.selectedShopId);
  const { onPressIn, animatedStyle } = useLiquidGlassPress();

  return (
    <SafeAreaView
      edges={["bottom"]}
      style={[styles.safeArea, { opacity: selectedShopId ? 0 : 1 }]}
      pointerEvents={selectedShopId ? "none" : "box-none"}
    >
      <Animated.View style={[styles.shadow, animatedStyle]}>
        <View style={styles.container}>
          <BlurViewCompat
            intensity={65}
            tint="systemUltraThinMaterialLight"
            androidFallbackColor="rgba(255,255,255,0.75)"
            style={styles.blur}
          >
            <View style={styles.specular} />
          <View style={styles.row}>
            {visibleRoutes.map((route) => {
              const isFocused = state.index === state.routes.indexOf(route);
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
                  onPressIn={onPressIn}
                  style={styles.tab}
                  activeOpacity={1}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isFocused }}
                >
                  <Ionicons
                    name={isFocused ? config.active : config.inactive}
                    size={26}
                    color={isFocused ? TEXT_DARK : TEXT_GRAY}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
          </BlurViewCompat>
        </View>
      </Animated.View>
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
  shadow: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: PILL_RADIUS,
    shadowColor: BLACK,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: Platform.OS === "android" ? 18 : 12,
  },
  container: {
    borderRadius: PILL_RADIUS,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS_BORDER,
  },
  blur: {
    borderRadius: PILL_RADIUS,
  },
  specular: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: GLASS_SPECULAR,
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
