import { Modal, View, Text, Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { LiquidGlass } from "@/components/ui/LiquidGlass";
import {
  PRIMARY,
  PRIMARY_BG,
  TEXT_DARK,
  TEXT_GRAY,
  WHITE,
  BLACK,
  GLASS_WHITE_STRONG,
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
          backgroundColor: `${BLACK}59`,
          alignItems: "center",
          justifyContent: "center",
          padding: 32,
        }}
      >
        <LiquidGlass
          borderRadius={28}
          overlayColor={GLASS_WHITE_STRONG}
          style={{ width: "100%", maxWidth: 320 }}
        >
          <View style={{ padding: 32, alignItems: "center" }}>
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: PRIMARY_BG,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <Ionicons name="hourglass-outline" size={40} color={PRIMARY} />
            </View>

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
                marginTop: 8,
                marginBottom: 24,
                textAlign: "center",
                lineHeight: 20,
              }}
            >
              {t("gacha.roll.dailyLimitShareHint")}
            </Text>

            <Pressable
              onPress={onClose}
              style={{
                backgroundColor: PRIMARY,
                // 카드가 28이라 버튼도 알약 형태로 맞춘다.
                borderRadius: 999,
                paddingVertical: 14,
                paddingHorizontal: 32,
                width: "100%",
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: "700", color: WHITE }}>
                {t("common.confirm")}
              </Text>
            </Pressable>
          </View>
        </LiquidGlass>
      </View>
    </Modal>
  );
}
