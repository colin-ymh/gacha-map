import { useRef } from "react";
import { Animated, TouchableOpacity, TouchableOpacityProps } from "react-native";

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

/**
 * Drop-in replacement for TouchableOpacity/Pressable that adds a scale-down
 * press effect. Use for any touch target that currently has no press feedback.
 */
export function PressableScale({
  style,
  onPressIn,
  onPressOut,
  activeOpacity = 0.85,
  children,
  ...props
}: TouchableOpacityProps) {
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <AnimatedTouchableOpacity
      activeOpacity={activeOpacity}
      onPressIn={(e) => {
        Animated.spring(scale, {
          toValue: 0.96,
          useNativeDriver: true,
          speed: 50,
          bounciness: 0,
        }).start();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          speed: 30,
          bounciness: 6,
        }).start();
        onPressOut?.(e);
      }}
      style={[{ transform: [{ scale }] }, style]}
      {...props}
    >
      {children}
    </AnimatedTouchableOpacity>
  );
}
