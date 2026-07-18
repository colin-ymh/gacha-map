import React from "react";
import { View, StyleSheet, Platform, type StyleProp, type ViewStyle } from "react-native";
import { BlurView, type BlurViewProps } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { LiquidGlassView } from "@uginy/react-native-liquid-glass";

type Props = BlurViewProps & {
  androidFallbackColor?: string;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function BlurViewCompat({ androidFallbackColor, style, children, intensity = 65, ...rest }: Props) {
  if (Platform.OS === "ios") {
    return (
      <BlurView style={style} intensity={intensity} {...rest}>
        {children}
      </BlurView>
    );
  }

  return (
    <View style={[styles.androidBase, style]}>
      <LiquidGlassView
        style={StyleSheet.absoluteFill}
        blurRadius={40}
        lightIntensity={0.18}
        glassOpacity={0.72}
      />
      <LinearGradient
        colors={["rgba(255,255,255,0.35)", "rgba(255,255,255,0.0)"]}
        locations={[0, 0.45]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {children}
      <View style={styles.specular} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  androidBase: {
    backgroundColor: "rgba(255,255,255,0.82)",
    overflow: "hidden",
  },
  specular: {
    ...StyleSheet.absoluteFillObject,
    bottom: undefined,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.92)",
  },
});
