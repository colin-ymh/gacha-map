import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  Animated,
} from "react-native";
import { useLiquidGlassPress } from "@/hooks/useLiquidGlassPress";
import { LiquidGlass } from "@/components/ui/LiquidGlass";
import { GlassBackButton } from "@/components/ui/GlassBackButton";
import * as Clipboard from "expo-clipboard";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  fetchShopDetail,
  formatOpeningHoursDisplay,
  getTodayHoursText,
  formatPhoneForDisplay,
  getPhoneTelUri,
} from "@gacha-map/shared";
import * as Linking from "expo-linking";
import { useAppSelector } from "@/store/hooks";
import LoginModal from "@/components/ui/LoginModal";
import { WishHeartButton } from "@/components/ui/WishHeartButton";
import { useWishDebounce } from "@/hooks/useWishDebounce";
import ReviewSection from "@/components/organisms/review/ReviewSection";
import GachaSection from "@/components/organisms/gacha/GachaSection";
import TabBar, { type TabKey } from "@/components/molecules/TabBar";
import ShopDetailSkeleton from "@/components/organisms/shop/ShopDetailSkeleton";
import type { ShopDetail, QuickReportKind } from "@gacha-map/shared";
import type { Review } from "@/types/review";
import { useTranslation } from "react-i18next";
import { useRecentShops } from "@/hooks/useRecentShops";
import {
  PRIMARY,
  PRIMARY_BG,
  TEXT_DARK,
  TEXT_GRAY,
  GRAY_100,
  BORDER,
  WHITE,
  BLACK,
  GLASS_BORDER,
} from "@/constants/colors";
import { WishToastProvider } from "@/components/ui/WishToast";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

export default function ShopDetailScreen() {
  const router = useRouter();
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const wishedShopIds = useAppSelector((s) => s.wishlist.shopIds);
  const isWished = wishedShopIds.includes(id ?? "");
  const { handleWishToggle: wishDebounce } = useWishDebounce();
  const isLoggedIn = useAppSelector((s) => s.auth.isLoggedIn);
  const currentUserId = useAppSelector((s) => s.auth.user?.id ?? null);
  const headerGlass = useLiquidGlassPress();
  const scrollY = useRef(new Animated.Value(0)).current;
  const tabBarThreshold = useRef(new Animated.Value(99999)).current;
  const relativeScroll = useRef(Animated.subtract(scrollY, tabBarThreshold)).current;
  const stickyTabOpacity = useRef(relativeScroll.interpolate({ inputRange: [-1, 0], outputRange: [0, 1], extrapolate: "clamp" })).current;
  const inScrollTabOpacity = useRef(relativeScroll.interpolate({ inputRange: [-1, 0], outputRange: [1, 0], extrapolate: "clamp" })).current;
  const thresholdVal = useRef(99999);
  const [stickyTab, setStickyTab] = useState(false); // pointerEvents 전용

  const [shop, setShop] = useState<ShopDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showKebab, setShowKebab] = useState(false);
  const [userQuickReport, setUserQuickReport] =
    useState<QuickReportKind | null>(null);

  const { addShop } = useRecentShops();

  const initialTab: TabKey = tab === "reviews" ? "reviews" : "products";
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [gachaRefreshToken, setGachaRefreshToken] = useState(0);
  const [visitedTabs, setVisitedTabs] = useState<Set<TabKey>>(
    new Set<TabKey>([initialTab]),
  );

  useEffect(() => {
    setActiveTab("products");
    setVisitedTabs(new Set<TabKey>(["products"]));
  }, [id]);

  const handleTabChange = useCallback((tab: TabKey) => {
    setActiveTab(tab);
    setVisitedTabs((prev) => new Set([...prev, tab]));
  }, []);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    fetchShopDetail(API_BASE, id)
      .then((data) => {
        if (cancelled) return;
        setShop(data);
        addShop({ id, name: data.name, address: data.address ?? undefined });
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, addShop]);

  const previousWishedRef = useRef(isWished);
  useEffect(() => {
    const wasWished = previousWishedRef.current;
    if (wasWished !== isWished) {
      setShop((prev) => {
        if (!prev) return prev;
        const currentCount = prev.wishlist_count ?? 0;
        return {
          ...prev,
          wishlist_count: isWished
            ? currentCount + 1
            : Math.max(0, currentCount - 1),
        };
      });
    }
    previousWishedRef.current = isWished;
  }, [isWished]);

  const handleWishToggle = useCallback(() => {
    if (!id) return;
    wishDebounce(id, () => {
      setShowLoginModal(true);
    });
  }, [id, wishDebounce]);

  const handleReportPress = useCallback(() => {
    const name = encodeURIComponent(shop?.name ?? "");
    router.push(`/report?shopId=${id}&shopName=${name}` as never);
  }, [router, id, shop?.name]);

  const handleGachaReportPress = useCallback(() => {
    if (!isLoggedIn) {
      setShowLoginModal(true);
      return;
    }
    setGachaRefreshToken((t) => t + 1);
    router.push(`/gacha-report?shopId=${id}` as never);
  }, [isLoggedIn, id, router]);

  const handleCopyAddress = useCallback(async () => {
    if (shop?.address) {
      await Clipboard.setStringAsync(shop.address);
      Alert.alert(t("shop.copiedTitle"), t("shop.copiedMessage"));
    }
  }, [shop?.address]);

  const handleCopyPhone = useCallback(async () => {
    if (shop?.phone) {
      await Clipboard.setStringAsync(shop.phone);
      Alert.alert(t("shop.copiedTitle"), t("shop.phoneCopiedMessage"));
    }
  }, [shop?.phone]);

  const handleCallPhone = useCallback(() => {
    const uri = getPhoneTelUri(shop?.phone);
    if (uri) Linking.openURL(uri);
  }, [shop?.phone]);

  const handleWriteReview = useCallback(() => {
    if (!isLoggedIn) {
      setShowLoginModal(true);
      return;
    }
    router.push(`/review-form?shopId=${id}` as never);
  }, [isLoggedIn, id, router]);

  const handleGalleryPress = useCallback(() => {
    router.push(`/review-images?shopId=${id}` as never);
  }, [id, router]);

  const handleClaimPress = useCallback(() => {
    setShowKebab(false);
    const name = encodeURIComponent(shop?.name ?? "");
    router.push(`/shop-application?shopId=${id}&shopName=${name}` as never);
  }, [router, id, shop?.name]);

  const handleEditReview = useCallback(
    (review: Review) => {
      const params = new URLSearchParams({
        shopId: id ?? "",
        reviewId: review.id,
        initialContent: review.content ?? "",
        initialImageUrls: JSON.stringify(review.image_urls),
      });
      router.push(`/review-form?${params.toString()}` as never);
    },
    [id, router],
  );

  const canClaim = isLoggedIn && shop && !shop.owner_id;

  const hoursText = formatOpeningHoursDisplay(shop?.opening_hours ?? null);
  const todayHoursText = getTodayHoursText(shop?.opening_hours ?? null);
  const canExpandHours = !!todayHoursText;
  const [isHoursExpanded, setIsHoursExpanded] = useState(false);

  const tabs = [
    { key: "products" as TabKey, label: t("shopDetail.tabProducts") },
    { key: "reviews" as TabKey, label: t("shopDetail.tabReviews") },
  ];

  const headerBgOpacity = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  if (loading) {
    return <ShopDetailSkeleton />;
  }

  if (!shop) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: WHITE }} edges={[]}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 14, color: TEXT_GRAY }}>{t("shop.loadError")}</Text>
        </View>
        <View style={[headerStyles.floatRow, { top: insets.top + 8 }]}>
          <GlassBackButton onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <WishToastProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: WHITE }} edges={[]}>
        {/* 스크롤 헤더 솔리드 배경 */}
        <Animated.View
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top + 60, backgroundColor: WHITE, opacity: headerBgOpacity, zIndex: 9 }}
          pointerEvents="none"
        />
        {/* 플로팅 헤더 버튼 */}
        <View style={[headerStyles.floatRow, { top: insets.top + 8 }]}>
          <GlassBackButton onPress={() => router.back()} />
          <View style={{ flex: 1 }} />
          {/* 우측 아이콘 그룹 */}
          <LiquidGlass
            borderRadius={26}
            style={headerGlass.animatedStyle}
            brightnessOpacity={headerGlass.brightnessValue}
          >
            <View style={{ flexDirection: "row" }}>
              <View style={headerStyles.btnSlot}>
                <WishHeartButton isWished={isWished} onPress={handleWishToggle} onPressIn={headerGlass.onPressIn} size={22} hitSlop={0} />
              </View>
              <View style={headerStyles.divider} />
              <TouchableOpacity style={headerStyles.btnSlot} onPressIn={headerGlass.onPressIn} onPress={handleReportPress} accessibilityRole="button" accessibilityLabel={t("shopDetail.reportBtn")}>
                <Ionicons name="megaphone-outline" size={22} color={TEXT_DARK} />
              </TouchableOpacity>
              {canClaim && (
                <>
                  <View style={headerStyles.divider} />
                  <TouchableOpacity style={headerStyles.btnSlot} onPressIn={headerGlass.onPressIn} onPress={() => setShowKebab(true)} accessibilityRole="button" accessibilityLabel={t("shopDetail.showMore")}>
                    <Ionicons name="ellipsis-vertical" size={22} color={TEXT_DARK} />
                  </TouchableOpacity>
                </>
              )}
            </View>
          </LiquidGlass>
        </View>

        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingTop: insets.top + 64 }}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true, listener: (e: any) => { setStickyTab(e.nativeEvent.contentOffset.y >= thresholdVal.current); } })}
          scrollEventThrottle={16}
        >
          {/* 이름 + 뱃지 + 찜 수 */}
          <View style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
              <Text
                style={{ fontSize: 24, fontWeight: "700", color: TEXT_DARK, flex: 1, lineHeight: 30 }}
                numberOfLines={2}
              >
                {shop.name}
              </Text>
              <View style={{ alignItems: "flex-end", gap: 4, marginLeft: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Ionicons name="heart" size={14} color={PRIMARY} />
                  <Text style={{ fontSize: 13, color: PRIMARY, fontWeight: "600" }}>
                    {shop.wishlist_count ?? 0}
                  </Text>
                </View>
                {userQuickReport !== null && (
                  <Text style={{ fontSize: 11, color: PRIMARY, fontWeight: "600" }}>
                    {t("gacha.quickReport.visitComplete")}
                  </Text>
                )}
              </View>
            </View>
            {shop.is_authorized && (
              <View
                style={{
                  alignSelf: "flex-start",
                  backgroundColor: PRIMARY_BG,
                  borderRadius: 9999,
                  paddingHorizontal: 10,
                  paddingVertical: 3,
                  marginTop: 8,
                }}
              >
                <Text style={{ fontSize: 11, color: PRIMARY }}>
                  {t("shop.officialBadge")}
                </Text>
              </View>
            )}
          </View>

          {/* 기본 정보 */}
          <View style={{ paddingBottom: 8 }}>

            {/* 주소 */}
            <View style={infoStyles.row}>
              <Ionicons name="location-outline" size={18} color={TEXT_GRAY} style={infoStyles.rowIcon} />
              <Text style={[infoStyles.rowText, { color: shop.address ? TEXT_DARK : TEXT_GRAY }]} numberOfLines={2}>
                {shop.address || t("shopDetail.noInfo")}
              </Text>
              {shop.address && (
                <TouchableOpacity onPress={handleCopyAddress} hitSlop={8} style={infoStyles.iconBtn}>
                  <Ionicons name="copy-outline" size={16} color={TEXT_GRAY} />
                </TouchableOpacity>
              )}
              {Number.isFinite(shop.lat) && Number.isFinite(shop.lng) && (
                <TouchableOpacity
                  onPress={() => router.push({ pathname: "/(tabs)/map" as never, params: { focusLat: String(shop.lat), focusLng: String(shop.lng), focusTs: String(Date.now()) } })}
                  hitSlop={8}
                  style={infoStyles.iconBtn}
                >
                  <Ionicons name="map-outline" size={16} color={TEXT_GRAY} />
                </TouchableOpacity>
              )}
            </View>

            {/* 전화번호 */}
            {shop.phone && (
              <>
                <View style={infoStyles.divider} />
                <View style={infoStyles.row}>
                  <Ionicons name="call-outline" size={18} color={TEXT_GRAY} style={infoStyles.rowIcon} />
                  <Text style={infoStyles.rowText}>{formatPhoneForDisplay(shop.phone)}</Text>
                  <TouchableOpacity onPress={handleCallPhone} hitSlop={8} style={[infoStyles.iconBtn, { backgroundColor: PRIMARY_BG }]}>
                    <Ionicons name="call" size={16} color={PRIMARY} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleCopyPhone} hitSlop={8} style={infoStyles.iconBtn}>
                    <Ionicons name="copy-outline" size={16} color={TEXT_GRAY} />
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* 운영시간 */}
            {hoursText && (
              <>
                <View style={infoStyles.divider} />
                <TouchableOpacity
                  activeOpacity={canExpandHours ? 0.7 : 1}
                  onPress={canExpandHours ? () => setIsHoursExpanded((v) => !v) : undefined}
                  style={infoStyles.row}
                >
                  <Ionicons name="time-outline" size={18} color={TEXT_GRAY} style={[infoStyles.rowIcon, { marginTop: 1 }]} />
                  <Text style={[infoStyles.rowText, { lineHeight: 20 }]}>
                    {canExpandHours && !isHoursExpanded ? todayHoursText : hoursText}
                  </Text>
                  {canExpandHours && (
                    <Ionicons name={isHoursExpanded ? "chevron-up" : "chevron-down"} size={16} color={TEXT_GRAY} />
                  )}
                </TouchableOpacity>
              </>
            )}

            {/* 설명 */}
            {shop.description && (
              <>
                <View style={infoStyles.divider} />
                <View style={[infoStyles.row, { alignItems: "flex-start" }]}>
                  <Ionicons name="document-text-outline" size={18} color={TEXT_GRAY} style={[infoStyles.rowIcon, { marginTop: 2 }]} />
                  <Text style={[infoStyles.rowText, { lineHeight: 22 }]}>{shop.description}</Text>
                </View>
              </>
            )}

          </View>

          {/* 탭바 — native driver opacity로 sticky와 크로스페이드 */}
          <Animated.View
            onLayout={(e) => {
              const t = e.nativeEvent.layout.y - (insets.top + 60);
              thresholdVal.current = t;
              tabBarThreshold.setValue(t);
            }}
            style={{ opacity: inScrollTabOpacity }}
          >
            <TabBar
              tabs={tabs}
              activeTab={activeTab}
              onTabChange={handleTabChange}
            />
          </Animated.View>

          {/* 상품 탭 */}
          {visitedTabs.has("products") && (
            <View
              style={{ display: activeTab === "products" ? "flex" : "none" }}
            >
              {id && (
                <GachaSection
                  shopId={id}
                  shopLat={shop.lat}
                  shopLng={shop.lng}
                  isLoggedIn={isLoggedIn ?? false}
                  onLoginRequired={() => {
                    setShowLoginModal(true);
                  }}
                  onUserQuickReportChange={setUserQuickReport}
                  refreshToken={gachaRefreshToken}
                />
              )}
            </View>
          )}

          {/* 리뷰 탭 */}
          {visitedTabs.has("reviews") && (
            <View
              style={{ display: activeTab === "reviews" ? "flex" : "none" }}
            >
              {id && (
                <ReviewSection
                  shopId={id}
                  currentUserId={currentUserId}
                  onEditPress={handleEditReview}
                />
              )}
            </View>
          )}
        </Animated.ScrollView>

        {/* 고정 탭바 — native driver opacity, 이격 없음 */}
        <Animated.View
          style={{
            position: "absolute",
            top: insets.top + 60,
            left: 0,
            right: 0,
            zIndex: 8,
            backgroundColor: WHITE,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: BORDER,
            opacity: stickyTabOpacity,
          }}
          pointerEvents={stickyTab ? "auto" : "none"}
        >
          <TabBar tabs={tabs} activeTab={activeTab} onTabChange={handleTabChange} />
        </Animated.View>

        {/* 가챠 제보 FAB */}
        {activeTab === "products" && (
          <GachaFab onPress={handleGachaReportPress} bottom={insets.bottom + 20} />
        )}

        {/* 리뷰 FAB */}
        {activeTab === "reviews" && (
          <>
            <ReviewFab
              icon="images-outline"
              label="모음"
              onPress={handleGalleryPress}
              bottom={insets.bottom + 84}
            />
            <ReviewFab
              icon="create-outline"
              label="리뷰"
              onPress={handleWriteReview}
              bottom={insets.bottom + 20}
              isPrimary
            />
          </>
        )}

        {/* Kebab 메뉴 모달 */}
        <Modal
          visible={showKebab}
          transparent
          animationType="fade"
          onRequestClose={() => setShowKebab(false)}
        >
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: `${BLACK}4D` }}
            activeOpacity={1}
            onPress={() => setShowKebab(false)}
          >
            <View
              style={{
                position: "absolute",
                top: 64,
                right: 16,
                backgroundColor: WHITE,
                borderRadius: 8,
                minWidth: 180,
                shadowColor: BLACK,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.15,
                shadowRadius: 8,
                elevation: 8,
              }}
            >
              <TouchableOpacity
                onPress={handleClaimPress}
                style={{ paddingHorizontal: 16, paddingVertical: 14 }}
              >
                <Text style={{ fontSize: 14, color: TEXT_DARK }}>
                  {t("shopDetail.claimMenu")}
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        <LoginModal
          visible={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          onLoginPress={() => {
            setShowLoginModal(false);
            router.push("/login" as never);
          }}
        />
      </SafeAreaView>
    </WishToastProvider>
  );
}

function ReviewFab({
  icon,
  label,
  onPress,
  bottom,
  isPrimary,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
  bottom: number;
  isPrimary?: boolean;
}) {
  const { onPressIn, animatedStyle, brightnessValue } = useLiquidGlassPress();
  const iconColor = isPrimary ? PRIMARY : TEXT_DARK;
  return (
    <LiquidGlass
      borderRadius={26}
      style={[fabStyles.fab, { bottom }, animatedStyle]}
      brightnessOpacity={brightnessValue}
      overlayColor={isPrimary ? "rgba(233, 75, 140, 0.04)" : undefined}
    >
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onPressIn}
        style={fabStyles.fabInner}
        activeOpacity={1}
      >
        <Ionicons name={icon} size={22} color={iconColor} />
        <Text style={[fabStyles.fabLabel, { color: iconColor }]}>{label}</Text>
      </TouchableOpacity>
    </LiquidGlass>
  );
}

function GachaFab({ onPress, bottom }: { onPress: () => void; bottom: number }) {
  const { onPressIn, animatedStyle, brightnessValue } = useLiquidGlassPress();
  return (
    <LiquidGlass
      borderRadius={26}
      style={[fabStyles.fab, { bottom }, animatedStyle]}
      brightnessOpacity={brightnessValue}
      overlayColor="rgba(233, 75, 140, 0.04)"
    >
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onPressIn}
        style={fabStyles.fabInner}
        activeOpacity={1}
      >
        <Ionicons name="create-outline" size={22} color={PRIMARY} />
        <Text style={[fabStyles.fabLabel, { color: PRIMARY }]}>제보</Text>
      </TouchableOpacity>
    </LiquidGlass>
  );
}


const headerStyles = StyleSheet.create({
  floatRow: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 10,
  },
  btnSlot: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 52,
    backgroundColor: GLASS_BORDER,
  },
});

const infoStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowIcon: {
    width: 20,
  },
  rowText: {
    flex: 1,
    fontSize: 14,
    color: TEXT_DARK,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: GRAY_100,
    alignItems: "center",
    justifyContent: "center",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BORDER,
    marginHorizontal: 16,
  },
});

const fabStyles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 20,
  },
  fabInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    height: 48,
    gap: 6,
  },
  fabLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: TEXT_DARK,
  },
});
