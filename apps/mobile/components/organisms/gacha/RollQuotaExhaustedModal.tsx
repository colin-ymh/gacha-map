import { Modal, View, Text, TouchableOpacity } from "react-native";
import { useTranslation } from "react-i18next";
import { LiquidGlass } from "@/components/ui/LiquidGlass";
import { useLiquidGlassPress } from "@/hooks/useLiquidGlassPress";
import {
  PRIMARY,
  TEXT_DARK,
  TEXT_GRAY,
  BLACK,
  GLASS_WHITE,
  primaryAlpha,
} from "@/constants/colors";

interface Props {
  visible: boolean;
  /** 오늘의 총 뽑기 횟수(기본 + 초대 보너스). 모르면 안내 문구를 생략한다. */
  dailyTotal: number | null;
  onClose: () => void;
}

/**
 * 오늘 뽑기를 모두 쓴 상태를 알린다.
 *
 * 여기에 공유 CTA는 두지 않는다. 소진 시점에는 뽑은 결과가 없어서 공유할
 * 대상 자체가 없다. 초대 유도는 결과 화면의 자랑하기 버튼이 담당한다.
 */
export default function RollQuotaExhaustedModal({
  visible,
  dailyTotal,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const { onPressIn, animatedStyle, brightnessValue } = useLiquidGlassPress();

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      {/* 유리가 유리로 보이려면 뒤가 비쳐야 한다. 스크림을 옅게 둔다. */}
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
          style={{ width: "100%", maxWidth: 320 }}
        >
          <View style={{ padding: 28, alignItems: "center" }}>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "700",
                color: TEXT_DARK,
                marginBottom: 8,
                textAlign: "center",
              }}
            >
              {t("gacha.roll.dailyLimitTitle")}
            </Text>

            {dailyTotal !== null && (
              <Text
                style={{
                  fontSize: 14,
                  color: TEXT_GRAY,
                  textAlign: "center",
                  lineHeight: 20,
                }}
              >
                {t("gacha.roll.dailyLimitSubtitle", { limit: dailyTotal })}
              </Text>
            )}

            <Text
              style={{
                fontSize: 14,
                color: TEXT_GRAY,
                marginTop: 2,
                marginBottom: 22,
                textAlign: "center",
                lineHeight: 20,
              }}
            >
              {t("gacha.roll.dailyLimitShareHint")}
            </Text>

            <LiquidGlass
              borderRadius={999}
              overlayColor={primaryAlpha(0.15)}
              style={[animatedStyle, { width: "100%" }]}
              brightnessOpacity={brightnessValue}
            >
              <TouchableOpacity
                onPress={onClose}
                onPressIn={onPressIn}
                activeOpacity={1}
                style={{
                  width: "100%",
                  height: 52,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{ fontSize: 16, fontWeight: "700", color: PRIMARY }}
                >
                  {t("common.confirm")}
                </Text>
              </TouchableOpacity>
            </LiquidGlass>
          </View>
        </LiquidGlass>
      </View>
    </Modal>
  );
}
