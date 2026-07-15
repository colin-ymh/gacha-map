import React from "react";
import { View, StyleSheet, Platform, type StyleProp, type ViewStyle } from "react-native";
import { BlurView, type BlurViewProps } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

type Props = BlurViewProps & {
  /** Unused on Android 12+ (real blur available). Kept for API compatibility. */
  androidFallbackColor?: string;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * BlurView on both iOS and Android (API 31+).
 * Android gets extra light-bloom gradient overlays on top of real blur.
 */
export function BlurViewCompat({ androidFallbackColor, style, children, ...rest }: Props) {
  if (Platform.OS === "ios") {
    return (
      <BlurView style={style} {...rest}>
        {children}
      </BlurView>
    );
  }

  // Android: real BlurView (RenderEffect, API 31+) + light bloom overlays
  return (
    <BlurView style={style} {...rest}>
      {/* Top light bloom */}
      <LinearGradient
        colors={["rgba(255,255,255,0.72)", "rgba(255,255,255,0.18)", "rgba(255,255,255,0.0)"]}
        locations={[0, 0.28, 0.60]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* Diagonal light refraction */}
      <LinearGradient
        colors={["rgba(255,255,255,0.0)", "rgba(255,255,255,0.20)", "rgba(255,255,255,0.0)"]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {children}
      {/* Specular hairline */}
      <View style={styles.specular} pointerEvents="none" />
    </BlurView>
  );
}

const styles = StyleSheet.create({
  specular: {
    ...StyleSheet.absoluteFillObject,
    bottom: undefined,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.92)",
  },
});
