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

interface GachaRollCardProps {
  item: GachaProductWithShops;
  onPress: () => void;
  onRollPress: () => void;
}

export default function GachaRollCard({
  item,
  onPress,
  onRollPress,
}: GachaRollCardProps) {
  const { t } = useTranslation();
  const displayName = item.name_ko ?? item.name_ja ?? item.name;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      {item.official_image_url ? (
        <Image
          source={{ uri: item.official_image_url }}
          style={styles.image}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]} />
      )}
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
    </TouchableOpacity>
  );
}

const CARD_WIDTH = 200;

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: WHITE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GRAY_200,
    overflow: "hidden",
    marginRight: 12,
  },
  image: {
    width: "100%",
    height: 160,
  },
  imagePlaceholder: {
    backgroundColor: THUMBNAIL_PLACEHOLDER,
  },
  info: {
    padding: 10,
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
    marginHorizontal: 10,
    marginBottom: 10,
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
