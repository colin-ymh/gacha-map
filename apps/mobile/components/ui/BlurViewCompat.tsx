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
export function BlurViewCompat({ androidFallbackColor, style, children, intensity = 65, ...rest }: Props) {
  if (Platform.OS === "ios") {
    return (
      <BlurView style={style} intensity={intensity} {...rest}>
        {children}
      </BlurView>
    );
  }

  // Android: very high intensity to distort/smear background colors (not whiten)
  const androidIntensity = 100;

  return (
    <BlurView style={style} intensity={androidIntensity} {...rest}>
      {/* White vibrancy layer — blur distorts forms, this desaturates to color-hints only (iOS material behavior) */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(255,255,255,0.60)" }]} pointerEvents="none" />
      {/* Top bloom */}
      <LinearGradient
        colors={["rgba(255,255,255,0.38)", "rgba(255,255,255,0.0)"]}
        locations={[0, 0.40]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
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
