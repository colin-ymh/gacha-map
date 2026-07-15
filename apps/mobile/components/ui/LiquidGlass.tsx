import React, { useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { GLASS_BORDER, BLACK, TEXT_DARK } from "@/constants/colors";

interface LiquidGlassProps {
  children: React.ReactNode;
  borderRadius?: number;
  /** Extra styles for the outer shadow/animated layer */
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  /** BlurView tint. Default: systemUltraThinMaterialLight */
  tint?: React.ComponentProps<typeof BlurView>["tint"];
  /** Overlay color on top of blur. Default: rgba(0,0,0,0.04) */
  overlayColor?: string;
  /** Animated.Value for white brightness flash on press (0–1 opacity) */
  brightnessOpacity?: Animated.Value;
  /** When true, container and BlurView stretch flex:1 to fill outer view */
  fill?: boolean;
}

/**
 * Base Liquid Glass container.
 * Outer layer is Animated.View so callers can animate scale/opacity directly via style.
 * Layers: Animated shadow → overflow:hidden border View → BlurView → dark overlay → [brightness overlay] → children
 */
export function LiquidGlass({
  children,
  borderRadius = 16,
  style,
  intensity = 40,
  tint = "systemUltraThinMaterialLight",
  overlayColor = "rgba(0,0,0,0.04)",
  brightnessOpacity,
  fill = false,
}: LiquidGlassProps) {
  const innerStyle = fill ? { flex: 1 } : undefined;

  return (
    <Animated.View style={[styles.shadow, { borderRadius }, style]}>
      <View style={[styles.container, { borderRadius }, fill && { flex: 1 }]}>
        {Platform.OS === "ios" ? (
          <BlurView intensity={intensity} tint={tint} style={innerStyle}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: overlayColor }]} />
            {brightnessOpacity !== undefined && (
              <Animated.View
                style={[StyleSheet.absoluteFill, { backgroundColor: "white", borderRadius }, { opacity: brightnessOpacity }]}
                pointerEvents="none"
              />
            )}
            {children}
          </BlurView>
        ) : (
          <View style={[innerStyle, { backgroundColor: "rgba(255,255,255,0.82)" }]}>
            {/* overlayColor tint */}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: overlayColor, borderRadius }]} pointerEvents="none" />
            {/* Top light bloom */}
            <LinearGradient
              colors={["rgba(255,255,255,0.58)", "rgba(255,255,255,0.0)"]}
              locations={[0, 0.45]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            {/* Diagonal light refraction */}
            <LinearGradient
              colors={["rgba(255,255,255,0.0)", "rgba(255,255,255,0.12)", "rgba(255,255,255,0.0)"]}
              start={{ x: 0.1, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            {children}
            {/* Specular hairline */}
            <View style={[StyleSheet.absoluteFill, { bottom: undefined, height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.92)", borderRadius }]} pointerEvents="none" />
            {brightnessOpacity !== undefined && (
              <Animated.View
                style={[StyleSheet.absoluteFill, { backgroundColor: "white", borderRadius }, { opacity: brightnessOpacity }]}
                pointerEvents="none"
              />
            )}
          </View>
        )}
      </View>
    </Animated.View>
  );
}

export interface GlassIconPillAction {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
  color?: string;
}

interface GlassIconPillProps {
  actions: GlassIconPillAction[];
  /** When true, each button stretches flex:1 to fill available width */
  stretch?: boolean;
  /** When true, hides labels and uses compact (FAB-sized) button dimensions */
  iconOnly?: boolean;
  /** Extra styles for the outer shadow/animated layer */
  style?: StyleProp<ViewStyle>;
}

/**
 * Horizontal Liquid Glass pill with icon (+ optional label) buttons separated by hairline dividers.
 * Press feedback matches shop detail header: scale bounce + white brightness flash.
 * - `stretch`: buttons fill available width equally
 * - `iconOnly`: hides labels, compact FAB-sized (52px) buttons
 */
export function GlassIconPill({
  actions,
  stretch = false,
  iconOnly = false,
  style,
}: GlassIconPillProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const brightness = useRef(new Animated.Value(0)).current;

  const onPressIn = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.05, duration: 80, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    Animated.sequence([
      Animated.timing(brightness, { toValue: 0.35, duration: 80, useNativeDriver: true }),
      Animated.timing(brightness, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  return (
    <LiquidGlass
      borderRadius={26}
      style={[{ transform: [{ scale }] }, style]}
      brightnessOpacity={brightness}
    >
      <View style={[styles.pillRow, iconOnly && styles.pillRowCompact]}>
        {actions.map((action, i) => (
          <React.Fragment key={action.label}>
            {i > 0 && <View style={[styles.pillDivider, iconOnly && styles.pillDividerCompact]} />}
            <TouchableOpacity
              style={[
                styles.pillBtn,
                iconOnly && styles.pillBtnCompact,
                stretch && styles.pillBtnStretch,
              ]}
              activeOpacity={1}
              onPressIn={onPressIn}
              onPress={action.onPress}
            >
              <Ionicons
                name={action.icon}
                size={iconOnly ? 28 : 22}
                color={action.color ?? TEXT_DARK}
              />
              {!iconOnly && (
                <Text
                  style={[
                    styles.pillLabel,
                    action.color ? { color: action.color } : null,
                  ]}
                >
                  {action.label}
                </Text>
              )}
            </TouchableOpacity>
          </React.Fragment>
        ))}
      </View>
    </LiquidGlass>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: BLACK,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 8,
  },
  container: {
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS_BORDER,
  },
  pillRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 72,
  },
  pillRowCompact: {
    height: 52,
  },
  pillBtn: {
    width: 64,
    height: 72,
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
  },
  pillBtnCompact: {
    width: 52,
    height: 52,
  },
  pillBtnStretch: {
    width: undefined,
    flex: 1,
  },
  pillLabel: {
    fontSize: 11,
    color: TEXT_DARK,
    fontWeight: "500",
    textAlign: "center",
  },
  pillDivider: {
    width: StyleSheet.hairlineWidth,
    height: 36,
    backgroundColor: "rgba(0,0,0,0.12)",
  },
  pillDividerCompact: {
    height: 26,
  },
});
