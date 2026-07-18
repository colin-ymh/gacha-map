import { TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LiquidGlass } from "@/components/ui/LiquidGlass";
import { useLiquidGlassPress } from "@/hooks/useLiquidGlassPress";
import { TEXT_DARK } from "@/constants/colors";

interface Props {
  onPress: () => void;
  accessibilityLabel?: string;
}

export function GlassBackButton({ onPress, accessibilityLabel = "뒤로가기" }: Props) {
  const { onPressIn, animatedStyle, brightnessValue } = useLiquidGlassPress();
  return (
    <LiquidGlass borderRadius={22} style={animatedStyle} brightnessOpacity={brightnessValue}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onPressIn}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        hitSlop={8}
        style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}
        activeOpacity={1}
      >
        <Ionicons name="chevron-back" size={24} color={TEXT_DARK} />
      </TouchableOpacity>
    </LiquidGlass>
  );
}
