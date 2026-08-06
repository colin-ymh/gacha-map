import type { ReactNode } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { LiquidGlass } from "@/components/ui/LiquidGlass";
import { useLiquidGlassPress } from "@/hooks/useLiquidGlassPress";
import {
  BLACK,
  PRIMARY,
  TEXT_GRAY,
  GLASS_WHITE,
  primaryAlpha,
  grayAlpha,
} from "@/constants/colors";

interface GlassModalProps {
  visible: boolean;
  onRequestClose: () => void;
  children: ReactNode;
  maxWidth?: number;
}

/**
 * 확인/알림류 팝업의 공통 셸. 뒷배경 스크림 + LiquidGlass 카드.
 * 로그인 필요 안내, 뱃지 획득, 뽑기 소진 팝업이 모두 이 컴포넌트를 공유한다.
 */
export function GlassModal({
  visible,
  onRequestClose,
  children,
  maxWidth = 320,
}: GlassModalProps) {
  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onRequestClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: `${BLACK}40`,
          alignItems: "center",
          justifyContent: "center",
          padding: 32,
        }}
      >
        <LiquidGlass
          borderRadius={28}
          overlayColor={GLASS_WHITE}
          style={{ width: "100%", maxWidth }}
        >
          <View style={{ padding: 28, alignItems: "center" }}>{children}</View>
        </LiquidGlass>
      </View>
    </Modal>
  );
}

interface GlassModalButtonProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "neutral";
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** GlassModal 내부에서 쓰는 공통 필 버튼. primary = 강조, neutral = 보조/닫기. */
export function GlassModalButton({
  label,
  onPress,
  variant = "primary",
  disabled,
  style,
}: GlassModalButtonProps) {
  const { onPressIn, onPressOut, animatedStyle, brightnessValue } =
    useLiquidGlassPress();
  const isPrimary = variant === "primary";

  return (
    <LiquidGlass
      borderRadius={999}
      overlayColor={isPrimary ? primaryAlpha(0.15) : grayAlpha(0.04)}
      style={[animatedStyle, { width: "100%" }, style]}
      brightnessOpacity={brightnessValue}
    >
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
        disabled={disabled}
        style={{
          width: "100%",
          height: 40,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            fontSize: isPrimary ? 16 : 15,
            fontWeight: isPrimary ? "700" : "600",
            color: isPrimary ? PRIMARY : TEXT_GRAY,
          }}
        >
          {label}
        </Text>
      </TouchableOpacity>
    </LiquidGlass>
  );
}
