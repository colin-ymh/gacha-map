import React from "react";
import { View, StyleSheet, Platform, type StyleProp, type ViewStyle } from "react-native";
import { BlurView, type BlurViewProps } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

type Props = BlurViewProps & {
  androidFallbackColor?: string;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function BlurViewCompat({ androidFallbackColor = "rgba(255,255,255,0.78)", style, children, ...rest }: Props) {
  if (Platform.OS === "ios") {
    return (
      <BlurView style={style} {...rest}>
        {children}
      </BlurView>
    );
  }
  return (
    <View style={[styles.androidBase, { backgroundColor: androidFallbackColor }, style]}>
      {/* Top light bloom — simulates glass catching light from above */}
      <LinearGradient
        colors={["rgba(255,255,255,0.62)", "rgba(255,255,255,0.0)"]}
        locations={[0, 0.45]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* Diagonal light refraction streak */}
      <LinearGradient
        colors={["rgba(255,255,255,0.0)", "rgba(255,255,255,0.13)", "rgba(255,255,255,0.0)"]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {children}
      {/* Specular hairline at top edge */}
      <View style={styles.specular} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  androidBase: {
    overflow: "hidden",
  },
  specular: {
    ...StyleSheet.absoluteFillObject,
    bottom: undefined,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.92)",
  },
});
