import { TouchableOpacity, Text, View, StyleSheet, Animated, type StyleProp, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { GRAY_100, TEXT_GRAY, BLACK, GLASS_BORDER } from "@/constants/colors";
import { useLiquidGlassPress } from "@/hooks/useLiquidGlassPress";

interface SearchBarProps {
  placeholder: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  glass?: boolean;
}

const SearchBar = ({ placeholder, onPress, style, glass = false }: SearchBarProps) => {
  const { onPressIn, animatedStyle, brightnessStyle } = useLiquidGlassPress();

  if (glass) {
    return (
      <Animated.View
        style={[
          {
            borderRadius: 22,
            shadowColor: BLACK,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.14,
            shadowRadius: 16,
            elevation: 8,
          },
          style,
          animatedStyle,
        ]}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={onPress}
          onPressIn={onPressIn}
          style={{ borderRadius: 22, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, borderColor: GLASS_BORDER }}
        >
          <BlurView intensity={55} tint="systemMaterialLight">
            <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "white", borderRadius: 22 }, brightnessStyle]} pointerEvents="none" />
            <View style={styles.glassInner}>
              <View style={styles.glassOverlay} />
              <Ionicons name="search" size={18} color={TEXT_GRAY} />
              <Text style={styles.placeholder}>{placeholder}</Text>
            </View>
          </BlurView>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <TouchableOpacity style={[styles.bar, style]} activeOpacity={1} onPress={onPress}>
      <Ionicons name="search" size={18} color={TEXT_GRAY} />
      <Text style={styles.placeholder}>{placeholder}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  bar: {
    height: 44,
    backgroundColor: GRAY_100,
    borderRadius: 22,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 8,
    shadowColor: BLACK,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  glassInner: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 8,
  },
  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  placeholder: {
    flex: 1,
    fontSize: 14,
    color: TEXT_GRAY,
  },
});

export default SearchBar;
