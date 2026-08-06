import { forwardRef } from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import type { GachaRollResult } from "@gacha-map/shared";
import GachaPlaceholder from "@/components/ui/GachaPlaceholder";
import {
  PRIMARY_BG,
  WHITE,
  TEXT_DARK,
  TEXT_GRAY,
  GLASS_WHITE_STRONG,
  GLASS_BORDER,
  DIVIDER_SUBTLE,
  BLACK,
} from "@/constants/colors";

// 9:16, sized 1.5x the on-screen card so the capture lands at 1080x1920 even
// on 2x devices (captureRef snapshots at the device pixel ratio; its width/
// height options only resize afterwards, which would not add detail).
export const SHARE_CARD_WIDTH = 540;
export const SHARE_CARD_HEIGHT = 960;

interface Props {
  result: GachaRollResult;
}

// Off-screen capture target for react-native-view-shot — never shown on
// screen directly, only rendered so captureRef() has something to snapshot.
//
// Mirrors the on-screen result card, but uses a solid translucent surface
// instead of LiquidGlass: BlurView does not survive captureRef on iOS, so a
// real glass layer would come out blank in the image.
const GachaShareCard = forwardRef<View, Props>(({ result }, ref) => {
  const { t } = useTranslation();
  const displayName = result.variant.name_ko ?? result.variant.name;
  const ownedCount =
    result.stats.variantStats.find((v) => v.variantId === result.variant.id)
      ?.count ?? 1;

  return (
    <View ref={ref} style={styles.card} collapsable={false}>
      <LinearGradient
        colors={[WHITE, PRIMARY_BG]}
        style={StyleSheet.absoluteFill}
      />

      <Text style={styles.lead}>{t("gacha.roll.resultLeadTitleAnon")}</Text>

      <View style={styles.resultCard}>
        <Text style={styles.name} numberOfLines={2}>
          {displayName}
        </Text>
        {result.variant.name_ko && (
          <Text style={styles.subName} numberOfLines={1}>
            {result.variant.name}
          </Text>
        )}

        {result.variant.image_url ? (
          <Image
            source={{ uri: result.variant.image_url }}
            style={styles.image}
            resizeMode="contain"
          />
        ) : (
          <GachaPlaceholder size={300} borderRadius={24} />
        )}

        <View style={styles.divider} />

        <View style={styles.statRow}>
          <Text style={styles.statLabel}>
            {t("gacha.roll.statGachaTriesLabel")}
          </Text>
          <Text style={styles.statValue}>
            {t("gacha.roll.statCountUnit", { count: result.stats.totalCount })}
          </Text>
        </View>

        <View style={styles.statRow}>
          <Text style={styles.statLabel}>
            {t("gacha.roll.statVariantTriesLabel")}
          </Text>
          <Text style={styles.statValue}>
            {t("gacha.roll.statCountUnit", { count: ownedCount })}
          </Text>
        </View>
      </View>

      <Image
        source={require("../../../assets/images/gacha-map-logo-transparent.png")}
        style={styles.logo}
        resizeMode="contain"
      />
    </View>
  );
});

GachaShareCard.displayName = "GachaShareCard";

export default GachaShareCard;

const styles = StyleSheet.create({
  card: {
    width: SHARE_CARD_WIDTH,
    height: SHARE_CARD_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },
  resultCard: {
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
    gap: 10,
    paddingVertical: 28,
    paddingHorizontal: 24,
    borderRadius: 32,
    backgroundColor: GLASS_WHITE_STRONG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS_BORDER,
    shadowColor: BLACK,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
  },
  lead: {
    fontSize: 32,
    fontWeight: "700",
    color: TEXT_DARK,
    textAlign: "center",
    marginBottom: 44,
  },
  // 카드 바깥 하단 브랜딩. 원본 713x122(여백 크롭 완료) 비율에 맞춘 크기.
  logo: {
    width: 140,
    height: 24,
    marginTop: 52,
  },
  name: {
    fontSize: 28,
    fontWeight: "800",
    color: TEXT_DARK,
    textAlign: "center",
  },
  subName: {
    fontSize: 18,
    color: TEXT_GRAY,
    textAlign: "center",
  },
  image: {
    width: 260,
    height: 260,
    marginVertical: 10,
  },
  divider: {
    width: "100%",
    height: StyleSheet.hairlineWidth,
    backgroundColor: DIVIDER_SUBTLE,
    marginVertical: 6,
  },
  statRow: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  statLabel: {
    fontSize: 19,
    color: TEXT_GRAY,
  },
  statValue: {
    fontSize: 23,
    fontWeight: "700",
    color: TEXT_DARK,
  },
});
