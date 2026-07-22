import { forwardRef } from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import type { GachaRollResult } from "@gacha-map/shared";
import GachaPlaceholder from "@/components/ui/GachaPlaceholder";
import { PRIMARY, PRIMARY_BG, WHITE, TEXT_DARK, TEXT_GRAY } from "@/constants/colors";

export const SHARE_CARD_WIDTH = 360;
export const SHARE_CARD_HEIGHT = 640;

interface Props {
  result: GachaRollResult;
}

// Off-screen capture target for react-native-view-shot — never shown on
// screen directly, only rendered so captureRef() has something to snapshot.
const GachaShareCard = forwardRef<View, Props>(({ result }, ref) => {
  const { t } = useTranslation();
  const displayName = result.variant.name_ko ?? result.variant.name;
  const ownedCount =
    result.stats.variantStats.find((v) => v.variantId === result.variant.id)
      ?.count ?? 1;

  return (
    <View ref={ref} style={styles.card} collapsable={false}>
      <LinearGradient colors={[WHITE, PRIMARY_BG]} style={StyleSheet.absoluteFill} />

      <Text style={styles.wordmark}>GACHA MAP</Text>

      <View style={styles.imageWrap}>
        {result.variant.image_url ? (
          <Image
            source={{ uri: result.variant.image_url }}
            style={styles.image}
            resizeMode="contain"
          />
        ) : (
          <GachaPlaceholder size={180} borderRadius={16} />
        )}
      </View>

      <Text style={styles.name} numberOfLines={2}>
        {displayName}
      </Text>

      <Text style={styles.stats}>
        {t("gacha.roll.totalAttempts", { count: result.stats.totalCount })}
        {" · "}
        {t("gacha.roll.variantOwnedCount", { count: ownedCount })}
      </Text>

      <Text style={styles.caption}>
        {t("gacha.roll.shareCaption", {
          defaultValue: "가챠맵에서 오늘의 가챠 운세를 확인해보세요",
        })}
      </Text>
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
    paddingTop: 48,
    paddingBottom: 40,
    paddingHorizontal: 24,
    justifyContent: "space-between",
  },
  wordmark: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 2,
    color: PRIMARY,
  },
  imageWrap: {
    width: 220,
    height: 220,
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  name: {
    fontSize: 22,
    fontWeight: "800",
    color: TEXT_DARK,
    textAlign: "center",
  },
  stats: {
    fontSize: 14,
    color: TEXT_GRAY,
    marginTop: 4,
  },
  caption: {
    fontSize: 13,
    color: TEXT_GRAY,
    textAlign: "center",
  },
});
