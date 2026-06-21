import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { SafeAreaView } from "react-native-safe-area-context";
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
import type { ShopDetail, QuickReportKind } from "@gacha-map/shared";
import type { Review } from "@/types/review";
import { useTranslation } from "react-i18next";
import {
  PRIMARY,
  PRIMARY_BG,
  TEXT_DARK,
  TEXT_GRAY,
  GRAY_200,
  BORDER,
  WHITE,
  BLACK,
} from "@/constants/colors";
import { WishToastProvider } from "@/components/ui/WishToast";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

export default function ShopDetailScreen() {
  const router = useRouter();
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const { t } = useTranslation();
  const wishedShopIds = useAppSelector((s) => s.wishlist.shopIds);
  const isWished = wishedShopIds.includes(id ?? "");
  const { handleWishToggle: wishDebounce } = useWishDebounce();
  const isLoggedIn = useAppSelector((s) => s.auth.isLoggedIn);
  const currentUserId = useAppSelector((s) => s.auth.user?.id ?? null);

  const [shop, setShop] = useState<ShopDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginModalFeature, setLoginModalFeature] = useState<
    "wish" | "review" | "application"
  >("wish");
  const [showKebab, setShowKebab] = useState(false);
  const [userQuickReport, setUserQuickReport] =
    useState<QuickReportKind | null>(null);

  const initialTab: TabKey = tab === "reviews" ? "reviews" : "products";
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
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
    fetchShopDetail(API_BASE, id)
      .then(setShop)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

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
      setLoginModalFeature("wish");
      setShowLoginModal(true);
    });
  }, [id, wishDebounce]);

  const handleReportPress = useCallback(() => {
    const name = encodeURIComponent(shop?.name ?? "");
    router.push(`/report?shopId=${id}&shopName=${name}` as never);
  }, [router, id, shop?.name]);

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
      setLoginModalFeature("review");
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

  if (loading) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: WHITE,
          alignItems: "center",
          justifyContent: "center",
        }}
        edges={["top"]}
      >
        <ActivityIndicator color={PRIMARY} />
      </SafeAreaView>
    );
  }

  if (!shop) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: WHITE }} edges={["top"]}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            height: 58,
            paddingBottom: 6,
            borderBottomWidth: 1,
            borderBottomColor: GRAY_200,
          }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t("shopDetail.back")}
            hitSlop={8}
            style={{
              width: 40,
              height: 40,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 24, color: TEXT_DARK }}>‹</Text>
          </TouchableOpacity>
        </View>
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ fontSize: 14, color: TEXT_GRAY }}>
            {t("shop.loadError")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <WishToastProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: WHITE }} edges={["top"]}>
        {/* 상단바 */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            height: 58,
            paddingBottom: 6,
            borderBottomWidth: 1,
            borderBottomColor: GRAY_200,
          }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t("shopDetail.back")}
            hitSlop={8}
            style={{
              width: 40,
              height: 40,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 24, color: TEXT_DARK }}>‹</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <View
            style={{
              marginRight: 8,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <WishHeartButton
              isWished={isWished}
              onPress={handleWishToggle}
              size={22}
            />
          </View>
          <TouchableOpacity
            onPress={handleReportPress}
            accessibilityRole="button"
            accessibilityLabel={t("shopDetail.reportBtn")}
            hitSlop={8}
            style={{
              width: 40,
              height: 40,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="megaphone-outline" size={22} color={TEXT_DARK} />
          </TouchableOpacity>
          {canClaim && (
            <TouchableOpacity
              onPress={() => setShowKebab(true)}
              accessibilityRole="button"
              accessibilityLabel={t("shopDetail.showMore")}
              hitSlop={8}
              style={{
                width: 40,
                height: 40,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="ellipsis-vertical" size={22} color={TEXT_DARK} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
          {/* 이름 + 뱃지 + 찜 수 */}
          <View
            style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 0 }}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: "700",
                  color: TEXT_DARK,
                  flex: 1,
                }}
                numberOfLines={1}
              >
                {shop.name}
              </Text>
              <Text style={{ fontSize: 13, color: PRIMARY, marginLeft: 8 }}>
                ♥ {shop.wishlist_count ?? 0}
              </Text>
              {userQuickReport !== null && (
                <Text
                  style={{
                    fontSize: 12,
                    color: PRIMARY,
                    fontWeight: "600",
                    marginLeft: 6,
                  }}
                >
                  {t("gacha.quickReport.visitComplete")}
                </Text>
              )}
            </View>
            {shop.is_authorized && (
              <View
                style={{
                  alignSelf: "flex-start",
                  backgroundColor: PRIMARY_BG,
                  borderRadius: 9999,
                  paddingHorizontal: 10,
                  paddingVertical: 3,
                  marginTop: 6,
                }}
              >
                <Text style={{ fontSize: 11, color: PRIMARY }}>
                  {t("shop.officialBadge")}
                </Text>
              </View>
            )}
          </View>

          {/* 기본 정보 (고정) */}
          <View
            style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 }}
          >
            {/* 주소 */}
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Text
                style={{
                  flex: 1,
                  fontSize: 14,
                  color: shop.address ? TEXT_DARK : TEXT_GRAY,
                }}
              >
                {shop.address || t("shopDetail.noInfo")}
              </Text>
              {shop.address && (
                <TouchableOpacity
                  onPress={handleCopyAddress}
                  hitSlop={8}
                  style={{
                    borderWidth: 1,
                    borderColor: BORDER,
                    borderRadius: 6,
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                  }}
                >
                  <Text style={{ fontSize: 12, color: TEXT_GRAY }}>
                    {t("shop.copy")}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* 전화번호 */}
            {shop.phone && (
              <>
                <View
                  style={{
                    height: 1,
                    backgroundColor: BORDER,
                    marginVertical: 12,
                  }}
                />
                <View
                  style={{ flexDirection: "row", gap: 8, alignItems: "center" }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "600",
                      color: TEXT_GRAY,
                      minWidth: 64,
                    }}
                  >
                    {t("shopDetail.phone")}
                  </Text>
                  <Text style={{ fontSize: 14, color: TEXT_DARK, flex: 1 }}>
                    {formatPhoneForDisplay(shop.phone)}
                  </Text>
                  <TouchableOpacity
                    onPress={handleCallPhone}
                    style={{
                      borderWidth: 1,
                      borderColor: GRAY_200,
                      borderRadius: 6,
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                    }}
                  >
                    <Text style={{ fontSize: 12, color: TEXT_GRAY }}>
                      {t("shop.call")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleCopyPhone}
                    style={{
                      borderWidth: 1,
                      borderColor: GRAY_200,
                      borderRadius: 6,
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                    }}
                  >
                    <Text style={{ fontSize: 12, color: TEXT_GRAY }}>
                      {t("shop.copy")}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* 운영시간 */}
            {hoursText && (
              <>
                <View
                  style={{
                    height: 1,
                    backgroundColor: BORDER,
                    marginVertical: 12,
                  }}
                />
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "600",
                      color: TEXT_GRAY,
                      minWidth: 64,
                    }}
                  >
                    {t("shopDetail.openingHours")}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, color: TEXT_DARK }}>
                      {canExpandHours && !isHoursExpanded
                        ? todayHoursText
                        : hoursText}
                    </Text>
                    {canExpandHours && (
                      <TouchableOpacity
                        onPress={() => setIsHoursExpanded((v) => !v)}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            color: TEXT_GRAY,
                            marginTop: 2,
                          }}
                        >
                          {isHoursExpanded
                            ? t("shopDetail.hideHours")
                            : t("shopDetail.showAllHours")}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </>
            )}

            {/* 설명 */}
            {shop.description && (
              <>
                <View
                  style={{
                    height: 1,
                    backgroundColor: BORDER,
                    marginVertical: 12,
                  }}
                />
                <Text
                  style={{ fontSize: 14, color: TEXT_DARK, lineHeight: 22 }}
                >
                  {shop.description}
                </Text>
              </>
            )}
          </View>

          {/* 탭바 */}
          <TabBar
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={handleTabChange}
          />

          {/* 상품 탭 */}
          {visitedTabs.has("products") && (
            <View
              style={{ display: activeTab === "products" ? "flex" : "none" }}
            >
              {id && (
                <GachaSection
                  shopId={id}
                  isLoggedIn={isLoggedIn ?? false}
                  onLoginRequired={() => {
                    setLoginModalFeature("wish");
                    setShowLoginModal(true);
                  }}
                  onUserQuickReportChange={setUserQuickReport}
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
                  onWritePress={handleWriteReview}
                  onGalleryPress={handleGalleryPress}
                  onEditPress={handleEditReview}
                />
              )}
            </View>
          )}
        </ScrollView>

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
          feature={loginModalFeature}
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
