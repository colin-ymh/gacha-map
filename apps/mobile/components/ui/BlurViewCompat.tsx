import React from "react";
import { View, StyleSheet, Platform, type StyleProp, type ViewStyle } from "react-native";
import { BlurView, type BlurViewProps } from "expo-blur";

type Props = BlurViewProps & {
  /** Fallback bg color on Android (no blur). Default: rgba(255,255,255,0.82) */
  androidFallbackColor?: string;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * BlurView on iOS, frosted-glass-simulated View on Android.
 * Android cannot do real blur in this dev client, so we layer:
 *   1. semi-transparent white base (androidFallbackColor)
 *   2. subtle top specular line
 * to approximate iOS frosted glass.
 */
export function BlurViewCompat({ androidFallbackColor = "rgba(255,255,255,0.82)", style, children, ...rest }: Props) {
  if (Platform.OS === "ios") {
    return (
      <BlurView style={style} {...rest}>
        {children}
      </BlurView>
    );
  }
  return (
    <View style={[styles.androidBase, { backgroundColor: androidFallbackColor }, style]}>
      <View style={styles.specular} pointerEvents="none" />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  androidBase: {
    overflow: "hidden",
  },
  specular: {
    ...StyleSheet.absoluteFillObject,
    top: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.9)",
  },
});
