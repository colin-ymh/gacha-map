import { useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import ImageViewerModal from "@/components/molecules/ImageViewerModal";
import GachaPlaceholder from "@/components/ui/GachaPlaceholder";
import { SkeletonBone } from "@/components/ui/Skeleton";
import { useTranslation } from "react-i18next";
import type {
  ShopGachaProduct,
  ShopGachaProductAvailability,
  QuickReportKind,
} from "@gacha-map/shared";
import QuickReportButtons from "@/components/molecules/gacha/QuickReportButtons";
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

function GachaProductThumb({
  url,
  onPress,
}: {
  url: string | null;
  onPress?: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <TouchableOpacity
      onPress={url ? onPress : undefined}
      activeOpacity={url ? 0.85 : 1}
      disabled={!url}
    >
      <View style={{ width: 56, height: 56, flexShrink: 0 }}>
        <GachaPlaceholder size={56} borderRadius={8} />
        {!!url && (
          <Image
            source={{ uri: url }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: 56,
              height: 56,
              borderRadius: 8,
              opacity: loaded ? 1 : 0,
            }}
            resizeMode="cover"
            onLoad={() => setLoaded(true)}
          />
        )}
      </View>
    </TouchableOpacity>
  );
}

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
  onToggleUnavailable: (recordId: string) => void;
  userQuickReport: QuickReportKind | null;
  locationEnabled: boolean;
  quickReportSubmitting: boolean;
  onQuickReport: (kind: QuickReportKind) => void;
  viewerImageUrl: string | null;
  onImagePress: (url: string) => void;
  onCloseImage: () => void;
  onProductPress: (productId: string) => void;
}

const GachaSectionView = ({
  products,
  isLoading,
  isLoggedIn,
  onReportPress,
  onDelete,
  onToggleUnavailable,
  userQuickReport,
  locationEnabled,
  quickReportSubmitting,
  onQuickReport,
  viewerImageUrl,
  onImagePress,
  onCloseImage,
  onProductPress,
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

      {!isLoading && products.length === 0 && userQuickReport === null && (
        <QuickReportButtons
          locationEnabled={locationEnabled}
          alreadyReported={false}
          submitting={quickReportSubmitting}
          onReport={onQuickReport}
        />
      )}

      {!isLoading && products.length === 0 && userQuickReport !== null && (
        <View style={styles.centerPad}>
          <Text style={styles.completeText}>
            {t("gacha.quickReport.visitComplete")}
          </Text>
          <Text style={[styles.emptyText, { marginTop: 6 }]}>
            {t("gacha.noProducts")}
          </Text>
        </View>
      )}

      {!isLoading && products.length > 0 && userQuickReport !== null && (
        <View style={styles.visitStrip}>
          <Text
            style={[
              styles.visitLabel,
              { color: SUCCESS_TEXT, fontWeight: "600" },
            ]}
          >
            {t("gacha.quickReport.visitComplete")}
          </Text>
        </View>
      )}

      {!isLoading && products.length > 0 && userQuickReport === null && (
        <View style={styles.visitStrip}>
          <Text style={styles.visitLabel}>
            {t("gacha.quickReport.visitSubtitle")}
          </Text>
          <View style={styles.visitButtons}>
            {quickReportSubmitting ? (
              <ActivityIndicator color={PRIMARY} size="small" />
            ) : (
              <>
                <TouchableOpacity
                  style={[
                    styles.visitBtn,
                    styles.visitBtnPresent,
                    !locationEnabled && styles.visitBtnDisabled,
                  ]}
                  onPress={() =>
                    locationEnabled && onQuickReport("gacha_present")
                  }
                  disabled={!locationEnabled}
                >
                  <Text style={styles.visitBtnPresentText}>
                    {t("gacha.quickReport.present")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.visitBtn,
                    styles.visitBtnAbsent,
                    !locationEnabled && styles.visitBtnDisabled,
                  ]}
                  onPress={() =>
                    locationEnabled && onQuickReport("gacha_absent")
                  }
                  disabled={!locationEnabled}
                >
                  <Text style={styles.visitBtnAbsentText}>
                    {t("gacha.quickReport.absent")}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      )}

      {isLoading ? (
        <View style={styles.skeletonList}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.skeletonRow}>
              <SkeletonBone width={56} height={56} borderRadius={8} />
              <View style={styles.skeletonInfo}>
                <SkeletonBone
                  width="70%"
                  height={15}
                  style={{ marginBottom: 6 }}
                />
                <SkeletonBone
                  width="45%"
                  height={12}
                  style={{ marginBottom: 6 }}
                />
                <SkeletonBone width="55%" height={12} />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View>
          {products.map((item, index) => {
            const statusStyle = STATUS_STYLE[item.availability_status];
            const canDelete =
              isLoggedIn && item.is_mine && item.verified_at === null;
            const isNavigable =
              item.gacha_product.source_type !== "user_manual";

            return (
              <View key={item.id}>
                {index > 0 && (
                  <View style={{ height: 1, backgroundColor: BORDER }} />
                )}
                <TouchableOpacity
                  activeOpacity={isNavigable ? 0.7 : 1}
                  onPress={
                    isNavigable
                      ? () => onProductPress(item.gacha_product.id)
                      : undefined
                  }
                  style={styles.row}
                >
                  <GachaProductThumb
                    url={item.gacha_product.official_image_url}
                    onPress={() =>
                      item.gacha_product.official_image_url &&
                      onImagePress(item.gacha_product.official_image_url)
                    }
                  />

                  <View style={styles.info}>
                    <Text style={styles.productName} numberOfLines={2}>
                      {item.gacha_product.name_ko ??
                        item.gacha_product.name_ja ??
                        item.gacha_product.name}
                    </Text>
                    <View style={styles.badges}>
                      <View style={styles.manufacturerTag}>
                        <Text style={styles.manufacturerTagText}>
                          {item.gacha_product.manufacturer}
                        </Text>
                      </View>
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
                    {item.reported_by_nickname && (
                      <Text style={styles.reporterText}>
                        {item.reported_by_nickname}님 제보
                      </Text>
                    )}
                    {item.availability_status === "sold_out" &&
                      item.unavailable_by_nickname && (
                        <Text style={styles.unavailableByText}>
                          {item.unavailable_by_nickname}님이 없음 표시
                        </Text>
                      )}
                  </View>

                  <View style={styles.actionCol}>
                    {isLoggedIn && (
                      <TouchableOpacity
                        onPress={() => onToggleUnavailable(item.id)}
                        style={styles.toggleBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={styles.toggleBtnText}>
                          {item.availability_status === "sold_out"
                            ? "있음"
                            : "없음"}
                        </Text>
                      </TouchableOpacity>
                    )}
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
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}
      <ImageViewerModal
        images={viewerImageUrl ? [viewerImageUrl] : []}
        initialIndex={0}
        visible={viewerImageUrl !== null}
        onClose={onCloseImage}
      />
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
    lineHeight: 16,
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
  completeText: {
    fontSize: 15,
    fontWeight: "700",
    color: SUCCESS_TEXT,
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
  manufacturerTag: {
    alignSelf: "flex-start",
    backgroundColor: GRAY_100,
    borderRadius: 99,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  manufacturerTagText: {
    fontSize: 11,
    color: TEXT_GRAY,
    fontWeight: "500",
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  tagChip: {
    backgroundColor: GRAY_100,
    borderRadius: 99,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  tagChipText: {
    fontSize: 10,
    color: TEXT_GRAY,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 4,
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
  actionCol: {
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 6,
    paddingTop: 2,
  },
  toggleBtn: {},
  toggleBtnText: {
    fontSize: 11,
    color: TEXT_GRAY,
    textDecorationLine: "underline",
  },
  reporterText: {
    fontSize: 11,
    color: TEXT_GRAY,
    marginTop: 2,
  },
  unavailableByText: {
    fontSize: 11,
    color: TEXT_GRAY,
    marginTop: 2,
  },
  deleteBtn: {
    paddingTop: 0,
  },
  deleteBtnText: {
    fontSize: 11,
    color: TEXT_GRAY,
    textDecorationLine: "underline",
  },
  centerPad: {
    paddingVertical: 32,
    alignItems: "center",
  },
  visitStrip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: WHITE,
  },
  visitLabel: {
    flex: 1,
    fontSize: 13,
    color: TEXT_GRAY,
  },
  visitButtons: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    minHeight: 32,
  },
  visitBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  visitBtnPresent: {
    backgroundColor: PRIMARY,
  },
  visitBtnAbsent: {
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
  },
  visitBtnDisabled: {
    backgroundColor: GRAY_200,
    borderColor: GRAY_200,
  },
  visitBtnPresentText: {
    fontSize: 12,
    fontWeight: "600",
    color: WHITE,
  },
  visitBtnAbsentText: {
    fontSize: 12,
    color: TEXT_GRAY,
  },
  skeletonList: {
    paddingVertical: 8,
  },
  skeletonRow: {
    flexDirection: "row" as const,
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  skeletonInfo: {
    flex: 1,
    justifyContent: "center" as const,
  },
});

export default GachaSectionView;
