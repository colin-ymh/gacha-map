import { ActivityIndicator, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LiquidGlass } from "@/components/ui/LiquidGlass";
import { useLiquidGlassPress } from "@/hooks/useLiquidGlassPress";
import { PRIMARY, TEXT_DARK } from "@/constants/colors";

interface Props {
  onPress: () => void;
  isLoading?: boolean;
  enabled?: boolean;
  accessibilityLabel?: string;
}

export function GlassSubmitButton({
  onPress,
  isLoading = false,
  enabled = true,
  accessibilityLabel,
}: Props) {
  const { onPressIn, onPressOut, animatedStyle, brightnessValue } = useLiquidGlassPress();
  const color = enabled ? PRIMARY : TEXT_DARK;
  return (
    <LiquidGlass
      borderRadius={22}
      style={[animatedStyle, { opacity: enabled ? 1 : 0.4 }]}
      brightnessOpacity={brightnessValue}
      overlayColor={enabled ? "rgba(233,75,140,0.10)" : undefined}
    >
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={!enabled || isLoading}
        activeOpacity={1}
        accessibilityLabel={accessibilityLabel}
        style={{
          width: 40,
          height: 40,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={color} />
        ) : (
          <Ionicons name="checkmark" size={24} color={color} />
        )}
      </TouchableOpacity>
    </LiquidGlass>
  );
}
