import { useRef } from "react";
import { Animated } from "react-native";

export function useLiquidGlassPress() {
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

  return {
    onPressIn,
    animatedStyle: { transform: [{ scale }] } as const,
    brightnessStyle: { opacity: brightness } as const,
    brightnessValue: brightness,
  };
}
