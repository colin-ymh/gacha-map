import { useState } from "react";
import { Text, Share } from "react-native";
import { useTranslation } from "react-i18next";
import { GlassModal, GlassModalButton } from "@/components/ui/GlassModal";
import { SHARE_WEB_ORIGIN, SHARE_LOCALES } from "@/constants/share";
import { TEXT_DARK, TEXT_GRAY } from "@/constants/colors";

interface Props {
  visible: boolean;
  /** 오늘의 기본 뽑기 한도(base). 보너스와 무관하게 고정값. 모르면 안내 문구를 생략한다. */
  dailyTotal: number | null;
  /** 구걸 링크에 붙일 초대 코드. 없으면 링크만 붙이고 코드는 생략한다. */
  referralCode: string | null;
  onClose: () => void;
}

/**
 * 오늘 뽑기를 모두 쓴 상태를 알린다.
 *
 * 뽑은 결과가 없어 결과 공유는 못 하지만, 친구에게 기회를 구걸하는 용도의
 * 링크 공유는 가능하다 — 결과 화면 자랑하기 버튼과는 목적이 다르다.
 */
export default function RollQuotaExhaustedModal({
  visible,
  dailyTotal,
  referralCode,
  onClose,
}: Props) {
  const { t, i18n } = useTranslation();
  const [isSharing, setIsSharing] = useState(false);

  const handleBegShare = async () => {
    if (isSharing) return;
    setIsSharing(true);
    try {
      const lang = SHARE_LOCALES.includes(i18n.language) ? i18n.language : "ko";
      const query = referralCode ? `?ref=${referralCode}` : "";
      // 루트(`/${lang}`)엔 ReferralPing이 없어 ref가 추적되지 않는다 — 실존
      // 상품이 없어도 되는 자리표시자 slug로 /r/[variantId] 페이지를 태운다.
      // parseSlug가 UUID가 아니면 variantId를 null로 두고 넘어가므로 페이지는
      // 익명(leadAnon) 카드로 정상 렌더되고, ReferralPing은 그대로 동작한다.
      const url = `${SHARE_WEB_ORIGIN}/${lang}/r/beg${query}`;
      const text = t("gacha.roll.dailyLimitBegMessage");
      await Share.share({ message: `${text}\n\n${url}` });
    } catch {
      // 구걸 링크 공유는 부가 기능이라 실패해도 조용히 넘긴다 — 소진 안내
      // 자체는 이미 모달로 전달됐다.
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <GlassModal visible={visible} onRequestClose={onClose}>
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

      {/* 활동 보너스 안내. 오늘 보너스를 이미 다 채운 유저에게도 뜨지만,
          잔여 슬롯은 quota API가 내려주지 않아 구분하지 않는다. */}
      <Text
        style={{
          fontSize: 14,
          color: TEXT_GRAY,
          marginTop: 2,
          textAlign: "center",
          lineHeight: 20,
        }}
      >
        {t("gacha.roll.dailyLimitActionHint")}
      </Text>

      <Text
        style={{
          fontSize: 14,
          color: TEXT_GRAY,
          marginTop: 10,
          marginBottom: 22,
          textAlign: "center",
          lineHeight: 20,
        }}
      >
        {t("gacha.roll.dailyLimitShareHint")}
      </Text>

      <GlassModalButton
        label={t("gacha.roll.dailyLimitBegBtn")}
        onPress={handleBegShare}
        disabled={isSharing}
        style={{ marginBottom: 10 }}
      />
      <GlassModalButton
        label={t("common.confirm")}
        onPress={onClose}
        variant="neutral"
      />
    </GlassModal>
  );
}
