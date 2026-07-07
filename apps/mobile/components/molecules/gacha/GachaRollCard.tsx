import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import type { GachaProductWithShops } from "@gacha-map/shared";
import {
  WHITE,
  GRAY_200,
  PRIMARY,
  THUMBNAIL_PLACEHOLDER,
} from "@/constants/colors";

export const CARD_HEIGHT = 220;

interface GachaRollCardProps {
  item: GachaProductWithShops;
  width: number;
  onPress: () => void;
  onRollPress: () => void;
  onImageError: () => void;
}

export default function GachaRollCard({
  item,
  width,
  onPress,
  onRollPress,
  onImageError,
}: GachaRollCardProps) {
  const { t } = useTranslation();
  const displayName = item.name_ko ?? item.name_ja ?? item.name;

  return (
    <TouchableOpacity
      style={[styles.card, { width }]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      {item.official_image_url ? (
        <Image
          source={{ uri: item.official_image_url }}
          style={styles.image}
          resizeMode="cover"
          onError={onImageError}
        />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]} />
      )}

      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.85)"]}
        style={styles.gradient}
      >
        <Text style={styles.name} numberOfLines={2}>
          {displayName}
        </Text>
        <TouchableOpacity
          style={styles.rollButton}
          onPress={onRollPress}
          activeOpacity={0.8}
        >
          <Text style={styles.rollButtonText}>{t("roll.rollButton")}</Text>
        </TouchableOpacity>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    height: CARD_HEIGHT,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GRAY_200,
    overflow: "hidden",
    backgroundColor: THUMBNAIL_PLACEHOLDER,
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  imagePlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: THUMBNAIL_PLACEHOLDER,
  },
  gradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingTop: 40,
    paddingBottom: 10,
    gap: 8,
  },
  name: {
    fontSize: 13,
    fontWeight: "700",
    color: WHITE,
    lineHeight: 18,
  },
  rollButton: {
    paddingVertical: 7,
    backgroundColor: PRIMARY,
    borderRadius: 7,
    alignItems: "center",
  },
  rollButtonText: {
    color: WHITE,
    fontSize: 12,
    fontWeight: "700",
  },
});
