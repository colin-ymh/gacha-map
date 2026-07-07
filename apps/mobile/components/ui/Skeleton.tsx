import { useEffect } from "react";
import Animated, {
  useSharedValue,
  withRepeat,
  withTiming,
  useAnimatedStyle,
} from "react-native-reanimated";
import type { DimensionValue, ViewStyle } from "react-native";
import { SHIMMER_BASE } from "@/constants/colors";

interface BoneProps {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function SkeletonBone({
  width = "100%",
  height = 16,
  borderRadius = 6,
  style,
}: BoneProps) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.4, { duration: 700 }), -1, true);
  }, []);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor: SHIMMER_BASE },
        animStyle,
        style,
      ]}
    />
  );
}

export function SkeletonCircle({
  size = 40,
  style,
}: {
  size?: number;
  style?: ViewStyle;
}) {
  return (
    <SkeletonBone
      width={size}
      height={size}
      borderRadius={size / 2}
      style={style}
    />
  );
}
