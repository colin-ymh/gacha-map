import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  StyleSheet,
} from "react-native";
import { useTranslation } from "react-i18next";
import type {
  ShopGachaProduct,
  ShopGachaProductAvailability,
} from "@gacha-map/shared";
import {
  PRIMARY,
  TEXT_DARK,
  TEXT_GRAY,
  BORDER,
  GRAY_100,
  GRAY_200,
  WHITE,
  SUCCESS_BG,
  SUCCESS_TEXT,
  BADGE_CLAIM_SHOP_BG,
  BADGE_CLAIM_SHOP_TEXT,
  STATUS_DEFAULT_BG,
  THUMBNAIL_PLACEHOLDER,
} from "@/constants/colors";

const STATUS_STYLE: Record<
  ShopGachaProductAvailability,
  { bg: string; text: string }
> = {
  available: { bg: SUCCESS_BG, text: SUCCESS_TEXT },
  seen: { bg: BADGE_CLAIM_SHOP_BG, text: BADGE_CLAIM_SHOP_TEXT },
  sold_out: { bg: GRAY_200, text: TEXT_GRAY },
  unknown: { bg: STATUS_DEFAULT_BG, text: TEXT_GRAY },
};

interface GachaSectionViewProps {
  products: ShopGachaProduct[];
  isLoading: boolean;
  isLoggedIn: boolean;
  onReportPress: () => void;
  onDelete: (recordId: string) => void;
}

const GachaSectionView = ({
  products,
  isLoading,
  isLoggedIn,
  onReportPress,
  onDelete,
}: GachaSectionViewProps) => {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {t("gacha.productCount", { count: products.length })}
        </Text>
        <TouchableOpacity onPress={onReportPress} style={styles.reportBtn}>
          <Text style={styles.reportBtnText}>{t("gacha.reportBtn")}</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={PRIMARY} />
        </View>
      ) : products.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>{t("gacha.empty")}</Text>
        </View>
      ) : (
        <View>
          {products.map((item, index) => {
            const statusStyle = STATUS_STYLE[item.availability_status];
            const canDelete =
              isLoggedIn &&
              item.source === "user_report" &&
              item.verified_at === null;

            return (
              <View key={item.id}>
                {index > 0 && (
                  <View style={{ height: 1, backgroundColor: BORDER }} />
                )}
                <View style={styles.row}>
                  {item.gacha_product.official_image_url ? (
                    <Image
                      source={{ uri: item.gacha_product.official_image_url }}
                      style={styles.thumbnail}
                    />
                  ) : (
                    <View
                      style={[styles.thumbnail, styles.thumbnailPlaceholder]}
                    />
                  )}

                  <View style={styles.info}>
                    <Text style={styles.productName} numberOfLines={2}>
                      {item.gacha_product.name_ko ??
                        item.gacha_product.name_ja ??
                        item.gacha_product.name}
                    </Text>
                    <Text style={styles.manufacturer}>
                      {item.gacha_product.manufacturer}
                    </Text>

                    <View style={styles.badges}>
                      <View
                        style={[
                          styles.badge,
                          { backgroundColor: statusStyle.bg },
                        ]}
                      >
                        <Text
                          style={[
                            styles.badgeText,
                            { color: statusStyle.text },
                          ]}
                        >
                          {t(
                            `gacha.status${item.availability_status
                              .split("_")
                              .map(
                                (s) => s.charAt(0).toUpperCase() + s.slice(1),
                              )
                              .join("")}`,
                          )}
                        </Text>
                      </View>

                      {item.source === "shop_owner" && (
                        <View style={styles.ownerBadge}>
                          <Text style={styles.ownerBadgeText}>
                            {t("gacha.badgeOwner")}
                          </Text>
                        </View>
                      )}
                    </View>

                    {item.price_krw != null && (
                      <Text style={styles.price}>
                        {t("gacha.priceKrw", {
                          price: item.price_krw.toLocaleString(),
                        })}
                      </Text>
                    )}
                  </View>

                  {canDelete && (
                    <TouchableOpacity
                      onPress={() => onDelete(item.id)}
                      style={styles.deleteBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.deleteBtnText}>
                        {t("gacha.deleteBtn")}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 6,
    borderTopColor: GRAY_200,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: TEXT_DARK,
  },
  reportBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  reportBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: WHITE,
  },
  center: {
    paddingVertical: 32,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: TEXT_GRAY,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    gap: 12,
    backgroundColor: WHITE,
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: 8,
  },
  thumbnailPlaceholder: {
    backgroundColor: THUMBNAIL_PLACEHOLDER,
  },
  info: {
    flex: 1,
    gap: 4,
  },
  productName: {
    fontSize: 13,
    fontWeight: "600",
    color: TEXT_DARK,
    lineHeight: 18,
  },
  manufacturer: {
    fontSize: 11,
    color: TEXT_GRAY,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 99,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  ownerBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 99,
    backgroundColor: GRAY_100,
  },
  ownerBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: TEXT_GRAY,
  },
  price: {
    fontSize: 12,
    color: TEXT_DARK,
    fontWeight: "600",
    marginTop: 2,
  },
  deleteBtn: {
    paddingTop: 2,
  },
  deleteBtnText: {
    fontSize: 11,
    color: TEXT_GRAY,
    textDecorationLine: "underline",
  },
});

export default GachaSectionView;
