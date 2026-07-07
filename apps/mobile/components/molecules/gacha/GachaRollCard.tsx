import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
} from "react-native";
import { useTranslation } from "react-i18next";
import type { GachaProductWithShops } from "@gacha-map/shared";
import {
  WHITE,
  GRAY_200,
  TEXT_DARK,
  TEXT_GRAY,
  PRIMARY,
  THUMBNAIL_PLACEHOLDER,
} from "@/constants/colors";

export const CARD_HEIGHT = 280;

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
      activeOpacity={0.85}
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
      <View style={styles.bottom}>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={2}>
            {displayName}
          </Text>
          {item.available_shop_count > 0 && (
            <Text style={styles.shopCount}>
              {t("roll.shopCount", { count: item.available_shop_count })}
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.rollButton}
          onPress={onRollPress}
          activeOpacity={0.8}
        >
          <Text style={styles.rollButtonText}>{t("roll.rollButton")}</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    height: CARD_HEIGHT,
    backgroundColor: WHITE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GRAY_200,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: 160,
  },
  imagePlaceholder: {
    backgroundColor: THUMBNAIL_PLACEHOLDER,
  },
  bottom: {
    flex: 1,
    flexDirection: "column",
    justifyContent: "space-between",
    padding: 10,
  },
  info: {
    gap: 4,
  },
  name: {
    fontSize: 13,
    fontWeight: "600",
    color: TEXT_DARK,
    lineHeight: 18,
  },
  shopCount: {
    fontSize: 12,
    color: TEXT_GRAY,
  },
  rollButton: {
    paddingVertical: 8,
    backgroundColor: PRIMARY,
    borderRadius: 8,
    alignItems: "center",
  },
  rollButtonText: {
    color: WHITE,
    fontSize: 13,
    fontWeight: "700",
  },
});
