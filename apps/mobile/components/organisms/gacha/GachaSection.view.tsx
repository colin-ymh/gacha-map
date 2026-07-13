import { useState, useRef } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Dimensions,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GlassIconPill, type GlassIconPillAction } from "@/components/ui/LiquidGlass";
import ImageViewerModal from "@/components/molecules/ImageViewerModal";
import GachaPlaceholder from "@/components/ui/GachaPlaceholder";
import { SkeletonBone } from "@/components/ui/Skeleton";
import { useTranslation } from "react-i18next";
import type {
  ShopGachaProduct,
  ShopGachaProductAvailability,
  QuickReportKind,
} from "@gacha-map/shared";
import {
  TEXT_DARK,
  TEXT_GRAY,
  GRAY_100,
  GRAY_200,
  WHITE,
  SUCCESS_BG,
  SUCCESS_TEXT,
  BADGE_CLAIM_SHOP_BG,
  BADGE_CLAIM_SHOP_TEXT,
  STATUS_DEFAULT_BG,
  DANGER,
} from "@/constants/colors";

const THUMB = 88;
const THUMB_RADIUS = 12;
const SCREEN_W = Dimensions.get("window").width;
const SCREEN_H = Dimensions.get("window").height;

function formatUpdatedAt(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

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
      <View style={{ width: THUMB, height: THUMB, flexShrink: 0 }}>
        <GachaPlaceholder size={THUMB} borderRadius={THUMB_RADIUS} />
        {!!url && (
          <Image
            source={{ uri: url }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: THUMB,
              height: THUMB,
              borderRadius: THUMB_RADIUS,
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

function KebabButton({
  id,
  onOpen,
}: {
  id: string;
  onOpen: (id: string, pageX: number, pageY: number) => void;
}) {
  const ref = useRef<View>(null);
  return (
    <TouchableOpacity
      onPress={() => {
        ref.current?.measureInWindow((x, y, w, h) => {
          onOpen(id, x, y + h / 2);
        });
      }}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <View ref={ref} style={styles.kebabBtn}>
        <Ionicons name="ellipsis-vertical" size={18} color={TEXT_GRAY} />
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
  onDelete: (recordId: string) => void;
  onToggleUnavailable: (recordId: string) => void;
  onEditPrice: (recordId: string, currentPrice: number | null) => void;
  userQuickReport: QuickReportKind | null;
  viewerImageUrl: string | null;
  onImagePress: (url: string) => void;
  onCloseImage: () => void;
  onProductPress: (productId: string) => void;
}

const GachaSectionView = ({
  products,
  isLoading,
  isLoggedIn,
  onDelete,
  onToggleUnavailable,
  onEditPrice,
  userQuickReport,
  viewerImageUrl,
  onImagePress,
  onCloseImage,
  onProductPress,
}: GachaSectionViewProps) => {
  const { t } = useTranslation();
  const [kebabAnchor, setKebabAnchor] = useState<{
    id: string;
    pageX: number;
    pageY: number;
  } | null>(null);
  const kebabItem = products.find((p) => p.id === kebabAnchor?.id) ?? null;

  const pillScale = useRef(new Animated.Value(0.85)).current;
  const pillOpacity = useRef(new Animated.Value(0)).current;

  const openKebab = (id: string, pageX: number, pageY: number) => {
    pillScale.setValue(0.85);
    pillOpacity.setValue(0);
    setKebabAnchor({ id, pageX, pageY });
    Animated.parallel([
      Animated.spring(pillScale, {
        toValue: 1,
        damping: 14,
        mass: 0.7,
        useNativeDriver: true,
      }),
      Animated.timing(pillOpacity, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeKebab = () => setKebabAnchor(null);

  return (
    <View style={styles.container}>
      {!isLoading && products.length === 0 && (
        <View style={styles.centerPad}>
          <Text style={styles.emptyText}>{t("gacha.noProducts")}</Text>
        </View>
      )}

      {isLoading ? (
        <View style={styles.skeletonList}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.skeletonRow}>
              <SkeletonBone width={THUMB} height={THUMB} borderRadius={THUMB_RADIUS} />
              <View style={styles.skeletonInfo}>
                <SkeletonBone width="70%" height={15} style={{ marginBottom: 6 }} />
                <SkeletonBone width="45%" height={12} style={{ marginBottom: 6 }} />
                <SkeletonBone width="55%" height={12} />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View>
          {products.map((item) => {
            const statusStyle = STATUS_STYLE[item.availability_status];
            const isNavigable = item.gacha_product.source_type !== "user_manual";

            return (
              <View key={item.id}>
                <TouchableOpacity
                  activeOpacity={isNavigable ? 0.7 : 1}
                  onPress={isNavigable ? () => onProductPress(item.gacha_product.id) : undefined}
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
                      <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
                        <Text style={[styles.badgeText, { color: statusStyle.text }]}>
                          {t(`gacha.status${item.availability_status.split("_").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join("")}`)}
                        </Text>
                      </View>
                      {item.source === "shop_owner" && (
                        <View style={styles.ownerBadge}>
                          <Text style={styles.ownerBadgeText}>{t("gacha.badgeOwner")}</Text>
                        </View>
                      )}
                    </View>

                    <Text style={[styles.price, item.price_krw == null && styles.noPrice]}>
                      {item.price_krw != null
                        ? t("gacha.priceKrw", { price: item.price_krw.toLocaleString() })
                        : t("gacha.noPrice")}
                    </Text>

                    <Text style={styles.updatedAt}>
                      {(() => {
                        const nick =
                          item.availability_status === "sold_out"
                            ? item.unavailable_by_nickname
                            : item.reported_by_nickname;
                        return `${formatUpdatedAt(item.updated_at)}${nick ? ` ${nick}` : ""} 업데이트`;
                      })()}
                    </Text>
                  </View>

                  {isLoggedIn && (
                    <KebabButton id={item.id} onOpen={openKebab} />
                  )}
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

      <Modal
        visible={kebabAnchor !== null}
        transparent
        animationType="none"
        onRequestClose={closeKebab}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={closeKebab}
        />
        {kebabAnchor !== null && kebabItem !== null && (() => {
          const canDelete = isLoggedIn && kebabItem.is_mine && kebabItem.verified_at === null;
          const showEditPrice = kebabItem.availability_status === "seen";

          const actions: GlassIconPillAction[] = [
            {
              icon:
                kebabItem.availability_status === "sold_out"
                  ? "checkmark-circle-outline"
                  : "close-circle-outline",
              label:
                kebabItem.availability_status === "sold_out"
                  ? t("gacha.kebab.labelAvailable")
                  : t("gacha.kebab.labelSoldOut"),
              onPress: () => { onToggleUnavailable(kebabItem.id); closeKebab(); },
            },
            ...(showEditPrice
              ? [{
                  icon: "create-outline" as const,
                  label: t("gacha.kebab.labelEditPrice"),
                  onPress: () => { onEditPrice(kebabItem.id, kebabItem.price_krw); closeKebab(); },
                }]
              : []),
            ...(canDelete
              ? [{
                  icon: "trash-outline" as const,
                  label: t("gacha.kebab.labelDelete"),
                  onPress: () => { onDelete(kebabItem.id); closeKebab(); },
                  color: DANGER,
                }]
              : []),
          ];

          return (
            <Animated.View
              style={{
                position: "absolute",
                right: SCREEN_W - kebabAnchor.pageX + 8,
                top: Math.min(Math.max(kebabAnchor.pageY - 36, 80), SCREEN_H - 100),
                transform: [{ scale: pillScale }],
                opacity: pillOpacity,
              }}
            >
              <GlassIconPill actions={actions} />
            </Animated.View>
          );
        })()}
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {},
  emptyText: {
    fontSize: 14,
    color: TEXT_GRAY,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
    backgroundColor: WHITE,
  },
  info: {
    flex: 1,
    gap: 6,
  },
  productName: {
    fontSize: 15,
    fontWeight: "600",
    color: TEXT_DARK,
    lineHeight: 21,
  },
  manufacturerTag: {
    alignSelf: "flex-start",
    backgroundColor: GRAY_100,
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  manufacturerTagText: {
    fontSize: 12,
    color: TEXT_GRAY,
    fontWeight: "600",
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  ownerBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
    backgroundColor: GRAY_100,
  },
  ownerBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: TEXT_GRAY,
  },
  price: {
    fontSize: 14,
    color: TEXT_DARK,
    fontWeight: "600",
    marginTop: 2,
  },
  noPrice: {
    color: TEXT_GRAY,
    fontWeight: "400",
  },
  updatedAt: {
    fontSize: 11,
    color: TEXT_GRAY,
    marginTop: 4,
  },
  centerPad: {
    paddingVertical: 32,
    alignItems: "center",
  },
  skeletonList: {
    paddingVertical: 8,
  },
  skeletonRow: {
    flexDirection: "row" as const,
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  skeletonInfo: {
    flex: 1,
    justifyContent: "center" as const,
  },
  kebabBtn: {
    paddingTop: 2,
    alignSelf: "flex-start",
  },
});

export default GachaSectionView;
