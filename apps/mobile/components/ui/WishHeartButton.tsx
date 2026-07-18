import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Text, TouchableOpacity, View } from "react-native";
import Animated, {
  useSharedValue,
  withSpring,
  useAnimatedStyle,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { PRIMARY, TEXT_GRAY, TEXT_DARK } from "@/constants/colors";
import { LiquidGlass } from "@/components/ui/LiquidGlass";
import { useLiquidGlassPress } from "@/hooks/useLiquidGlassPress";

interface WishHeartButtonProps {
  isWished: boolean;
  onPress: () => void;
  onPressIn?: () => void;
  size?: number;
  hitSlop?: number;
  activeColor?: string;
  inactiveColor?: string;
  /** LiquidGlass press effect instead of the spring-scale animation. */
  glass?: boolean;
  /** LiquidGlass variant only: borderRadius of the glass container. */
  glassBorderRadius?: number;
  /** LiquidGlass variant only: optional count shown below the icon. */
  count?: number;
}

function GlassWishHeartButton({
  isWished,
  onPress,
  size = 22,
  hitSlop = 4,
  activeColor = PRIMARY,
  inactiveColor = TEXT_DARK,
  glassBorderRadius = 22,
  count,
}: WishHeartButtonProps) {
  const { t } = useTranslation();
  const { onPressIn, animatedStyle, brightnessValue } = useLiquidGlassPress();

  return (
    <View style={{ alignItems: "center", gap: 4 }}>
      <LiquidGlass
        borderRadius={glassBorderRadius}
        style={animatedStyle}
        brightnessOpacity={brightnessValue}
        overlayColor={isWished ? "rgba(233,75,140,0.15)" : undefined}
      >
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            onPress();
          }}
          onPressIn={onPressIn}
          activeOpacity={1}
          hitSlop={hitSlop}
          accessibilityRole="button"
          accessibilityLabel={isWished ? t("wish.remove") : t("wish.add")}
          style={{
            width: 40,
            height: 40,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons
            name={isWished ? "heart" : "heart-outline"}
            size={size}
            color={isWished ? activeColor : inactiveColor}
          />
        </TouchableOpacity>
      </LiquidGlass>
      {typeof count === "number" && count > 0 && (
        <Text
          style={{
            fontSize: 10,
            color: isWished ? activeColor : inactiveColor,
          }}
        >
          {count}
        </Text>
      )}
    </View>
  );
}

function SpringWishHeartButton({
  isWished,
  onPress,
  onPressIn,
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
        onPressIn={onPressIn}
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

export function WishHeartButton(props: WishHeartButtonProps) {
  return props.glass ? (
    <GlassWishHeartButton {...props} />
  ) : (
    <SpringWishHeartButton {...props} />
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
