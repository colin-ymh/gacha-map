import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { TouchableOpacity } from "react-native";
import Animated, {
  useSharedValue,
  withSpring,
  useAnimatedStyle,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { PRIMARY, TEXT_GRAY, TEXT_DARK } from "@/constants/colors";

interface WishHeartButtonProps {
  isWished: boolean;
  onPress: () => void;
  size?: number;
  hitSlop?: number;
  activeColor?: string;
  inactiveColor?: string;
}

export function WishHeartButton({
  isWished,
  onPress,
  size = 22,
  hitSlop = 8,
  activeColor = PRIMARY,
  inactiveColor = TEXT_DARK,
}: WishHeartButtonProps) {
  const { t } = useTranslation();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = useCallback(() => {
    scale.value = withSpring(1.3, { damping: 4, mass: 0.6 }, () => {
      scale.value = withSpring(1, { damping: 6 });
    });
    onPress();
  }, [onPress, scale]);

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        onPress={handlePress}
        hitSlop={hitSlop}
        accessibilityRole="button"
        accessibilityLabel={isWished ? t("wish.remove") : t("wish.add")}
      >
        <Ionicons
          name={isWished ? "heart" : "heart-outline"}
          size={size}
          color={isWished ? activeColor : inactiveColor}
        />
      </TouchableOpacity>
    </Animated.View>
  );
}

export function WishHeartButtonSmall({
  isWished,
  onPress,
}: Pick<WishHeartButtonProps, "isWished" | "onPress">) {
  return (
    <WishHeartButton
      isWished={isWished}
      onPress={onPress}
      size={20}
      activeColor={PRIMARY}
      inactiveColor={TEXT_GRAY}
    />
  );
}
