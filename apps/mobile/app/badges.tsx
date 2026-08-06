import { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Image,
  Modal,
  Dimensions,
  StyleSheet,
  PanResponder,
  Animated,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { GlassBackButton } from "@/components/ui/GlassBackButton";
import { LiquidGlass } from "@/components/ui/LiquidGlass";
import { useLiquidGlassPress } from "@/hooks/useLiquidGlassPress";
import { Ionicons } from "@expo/vector-icons";
import type { BadgeDefinition, UserBadge } from "@gacha-map/shared";
import { getAuthHeaders } from "@/lib/supabase";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setProfileMainBadge } from "@/store/slices/auth.slice";
import { SkeletonCircle, SkeletonBone } from "@/components/ui/Skeleton";
import LoginModal from "@/components/ui/LoginModal";
import {
  PRIMARY,
  PRIMARY_BG,
  TEXT_DARK,
  TEXT_GRAY,
  WHITE,
  GRAY_100,
  GRAY_200,
  GRAY_400,
} from "@/constants/colors";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";
const SCREEN_WIDTH = Dimensions.get("window").width;
const H_PAD = 16;
const CARD_PAD = 20;
const GRID_GAP = 10;
const GRID_ITEM_W =
  (SCREEN_WIDTH - H_PAD * 2 - CARD_PAD * 2 - GRID_GAP * 2) / 3;

interface BadgesPageData {
  earned: UserBadge[];
  main_badge_id: string | null;
  definitions: BadgeDefinition[];
}

const BADGE_TRACKS = [
  "quick_report",
  "shop_review",
  "new_shop_report",
  "closed_shop_report",
  "fix_info_report",
  "wishlist",
  "gacha_roll_variety",
  "gacha_roll_days",
] as const;

function computeLockedBadges(
  definitions: BadgeDefinition[],
  earned: UserBadge[],
): BadgeDefinition[] {
  const earnedDefIds = new Set(earned.map((b) => b.badge_definition_id));
  return BADGE_TRACKS.map((track) =>
    definitions
      .filter((d) => d.track === track)
      .sort((a, b) => a.tier - b.tier)
      .find((d) => !earnedDefIds.has(d.id)),
  ).filter((d): d is BadgeDefinition => d !== undefined);
}

function BadgeIconDisplay({
  iconUrl,
  size = 44,
  bgColor = GRAY_100,
}: {
  iconUrl: string;
  size?: number;
  bgColor?: string;
}) {
  if (iconUrl && iconUrl.startsWith("http")) {
    return (
      <Image
        source={{ uri: iconUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        resizeMode="contain"
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: bgColor,
      }}
    >
      <Text style={{ fontSize: size * 0.55 }}>{iconUrl || "🏅"}</Text>
    </View>
  );
}

function BadgeGridItem({
  iconUrl,
  name,
  tier,
  isEarned,
  isMain,
  onPress,
}: {
  iconUrl: string;
  name: string;
  tier: number;
  isEarned: boolean;
  isMain?: boolean;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={isEarned ? 0.7 : 1}
      style={[styles.gridItem, { width: GRID_ITEM_W }]}
    >
      <View style={styles.gridIconWrap}>
        <View style={{ opacity: isEarned ? 1 : 0.3 }}>
          <BadgeIconDisplay iconUrl={iconUrl} size={72} />
        </View>
        {!isEarned && (
          <View style={styles.lockBadge}>
            <Text style={{ fontSize: 11 }}>🔒</Text>
          </View>
        )}
        {isMain && <View style={styles.mainDot} />}
      </View>
      <Text
        style={[styles.gridName, !isEarned && { color: GRAY_400 }]}
        numberOfLines={2}
      >
        {name}
      </Text>
      <Text style={styles.gridTier}>Lv.{tier}</Text>
    </TouchableOpacity>
  );
}

export default function BadgesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isLoggedIn = useAppSelector((s) => s.auth.isLoggedIn);
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<BadgesPageData | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const {
    onPressIn: changePressIn,
    onPressOut: changePressOut,
    animatedStyle: changeAnimStyle,
    brightnessValue: changeBrightness,
  } = useLiquidGlassPress();
  const {
    onPressIn: removePressIn,
    onPressOut: removePressOut,
    animatedStyle: removeAnimStyle,
    brightnessValue: removeBrightness,
  } = useLiquidGlassPress();

  const sheetTranslateY = useRef(new Animated.Value(600)).current;
  const sheetPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (e) => e.nativeEvent.locationY < 52,
      onMoveShouldSetPanResponder: (e, { dy }) =>
        e.nativeEvent.locationY < 52 && dy > 2,
      onPanResponderMove: (_, { dy }) => {
        if (dy > 0) sheetTranslateY.setValue(dy);
      },
      onPanResponderRelease: (_, { dy, vy }) => {
        sheetTranslateY.stopAnimation();
        if (dy > 80 || vy > 0.5) {
          Animated.timing(sheetTranslateY, {
            toValue: 600,
            duration: 200,
            useNativeDriver: true,
          }).start(() => setModalOpen(false));
        } else {
          Animated.spring(sheetTranslateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        }
      },
    }),
  ).current;

  useEffect(() => {
    if (modalOpen) {
      sheetTranslateY.stopAnimation();
      sheetTranslateY.setValue(600);
      Animated.spring(sheetTranslateY, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 4,
      }).start();
    }
  }, [modalOpen]);

  useEffect(() => {
    if (!isLoggedIn) {
      setShowLoginModal(true);
      return;
    }
    (async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/users/badges`, { headers });
      if (res.ok) setData(await res.json());
    })();
  }, [isLoggedIn]);

  async function setMainBadge(userBadgeId: string | null) {
    if (!data) return;
    const prev = data;
    setData((d) => (d ? { ...d, main_badge_id: userBadgeId } : d));
    setModalOpen(false);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/users/badges/main`, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ badge_id: userBadgeId }),
      });
      if (!res.ok) {
        setData(prev);
        return;
      }
      if (userBadgeId === null) {
        dispatch(setProfileMainBadge(null));
      } else {
        const userBadge = data.earned.find((b) => b.id === userBadgeId);
        if (userBadge) {
          const def = userBadge.badge_definitions as BadgeDefinition;
          dispatch(
            setProfileMainBadge({
              id: def.id,
              name: def.name,
              icon_url: def.icon_url,
            }),
          );
        }
      }
    } catch {
      setData(prev);
    }
  }

  const adminBadge = data?.earned.find(
    (b) => (b.badge_definitions as BadgeDefinition).track === "admin",
  );
  const operatorBadge = data?.earned.find(
    (b) => (b.badge_definitions as BadgeDefinition).track === "operator",
  );
  const regularBadges =
    data?.earned.filter((b) => {
      const track = (b.badge_definitions as BadgeDefinition).track;
      return track !== "operator" && track !== "admin";
    }) ?? [];
  const lockedBadges = data
    ? computeLockedBadges(data.definitions, data.earned)
    : [];
  const mainUserBadge = regularBadges.find((b) => b.id === data?.main_badge_id);
  const mainDef = mainUserBadge
    ? (mainUserBadge.badge_definitions as BadgeDefinition)
    : null;

  return (
    <View style={styles.container}>
      {/* Floating back button */}
      <View style={[styles.backBtn, { top: insets.top + 8 }]}>
        <GlassBackButton onPress={() => router.back()} />
      </View>

      {/* Floating change badge button */}
      <View style={[styles.changeBtn, { top: insets.top + 8 }]}>
        <LiquidGlass
          borderRadius={20}
          style={changeAnimStyle}
          overlayColor="rgba(233,75,140,0.12)"
          brightnessOpacity={changeBrightness}
        >
          <TouchableOpacity
            onPressIn={changePressIn}
            onPressOut={changePressOut}
            onPress={() => setModalOpen(true)}
            activeOpacity={1}
            style={styles.changeBtnInner}
          >
            <Ionicons name="repeat" size={14} color={PRIMARY} />
            <Text style={styles.changeBtnText}>배지 변경</Text>
          </TouchableOpacity>
        </LiquidGlass>
      </View>

      {!data ? (
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 64, paddingBottom: insets.bottom + 32 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Main badge card skeleton */}
          <View style={styles.card}>
            <View style={styles.cardInner}>
              <SkeletonBone width={72} height={13} borderRadius={6} />
              <View style={styles.mainBadgeInner}>
                <SkeletonCircle size={64} />
                <View style={{ flex: 1, gap: 8 }}>
                  <SkeletonBone width="65%" height={15} />
                  <SkeletonBone width="85%" height={12} />
                  <SkeletonBone width="50%" height={12} />
                </View>
              </View>
            </View>
          </View>

          {/* Earned grid skeleton */}
          <View style={styles.card}>
            <View style={styles.cardInner}>
              <SkeletonBone width={96} height={13} borderRadius={6} />
              <View style={styles.gridWrap}>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <View
                    key={i}
                    style={[styles.gridItem, { width: GRID_ITEM_W }]}
                  >
                    <SkeletonCircle size={72} />
                    <SkeletonBone
                      width="70%"
                      height={12}
                      style={{ marginTop: 10 }}
                    />
                    <SkeletonBone
                      width="40%"
                      height={11}
                      style={{ marginTop: 3 }}
                    />
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* Locked grid skeleton */}
          <View style={[styles.card, { opacity: 0.5 }]}>
            <View style={styles.cardInner}>
              <SkeletonBone width={80} height={13} borderRadius={6} />
              <View style={styles.gridWrap}>
                {[0, 1, 2].map((i) => (
                  <View
                    key={i}
                    style={[styles.gridItem, { width: GRID_ITEM_W }]}
                  >
                    <SkeletonCircle size={72} />
                    <SkeletonBone
                      width="70%"
                      height={12}
                      style={{ marginTop: 10 }}
                    />
                    <SkeletonBone
                      width="40%"
                      height={11}
                      style={{ marginTop: 3 }}
                    />
                  </View>
                ))}
              </View>
            </View>
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 64, paddingBottom: insets.bottom + 32 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Main badge card */}
          <View style={styles.card}>
            <View style={styles.cardInner}>
              <Text style={styles.cardLabel}>
                {t("gacha.badge.mainSection")}
              </Text>
              {mainDef ? (
                <LiquidGlass
                  borderRadius={14}
                  overlayColor="rgba(233,75,140,0.08)"
                >
                  <View style={styles.mainBadgeInner}>
                    <BadgeIconDisplay
                      iconUrl={mainDef.icon_url}
                      size={64}
                      bgColor="transparent"
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.mainBadgeName}>{mainDef.name}</Text>
                      {mainDef.description && (
                        <Text style={styles.mainBadgeDesc} numberOfLines={2}>
                          {mainDef.description}
                        </Text>
                      )}
                    </View>
                  </View>
                </LiquidGlass>
              ) : (
                <Text style={styles.noMainText}>
                  {t("gacha.badge.noMainBadge")}
                </Text>
              )}
            </View>
          </View>

          {/* Special badges (admin / operator) */}
          {(adminBadge || operatorBadge) && (
            <View style={styles.specialRow}>
              {adminBadge && (
                <View style={styles.specialCard}>
                  <View style={styles.specialCardInner}>
                    <BadgeIconDisplay
                      iconUrl={
                        (adminBadge.badge_definitions as BadgeDefinition)
                          .icon_url
                      }
                      size={40}
                    />
                    <Text style={styles.specialName} numberOfLines={1}>
                      {(adminBadge.badge_definitions as BadgeDefinition).name}
                    </Text>
                    <Text style={styles.specialTrack}>
                      {t("gacha.badge.adminSection")}
                    </Text>
                  </View>
                </View>
              )}
              {operatorBadge && (
                <View style={styles.specialCard}>
                  <View style={styles.specialCardInner}>
                    <BadgeIconDisplay
                      iconUrl={
                        (operatorBadge.badge_definitions as BadgeDefinition)
                          .icon_url
                      }
                      size={40}
                    />
                    <Text style={styles.specialName} numberOfLines={1}>
                      {
                        (operatorBadge.badge_definitions as BadgeDefinition)
                          .name
                      }
                    </Text>
                    <Text style={styles.specialTrack}>
                      {t("gacha.badge.operatorSection")}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Earned badges grid */}
          {regularBadges.length > 0 && (
            <View style={styles.card}>
              <View style={styles.cardInner}>
                <Text style={styles.cardLabel}>
                  {t("gacha.badge.earnedSection")} {regularBadges.length}
                </Text>
                <View style={styles.gridWrap}>
                  {regularBadges.map((userBadge) => {
                    const def = userBadge.badge_definitions as BadgeDefinition;
                    return (
                      <BadgeGridItem
                        key={userBadge.id}
                        iconUrl={def.icon_url}
                        name={def.name}
                        tier={def.tier}
                        isEarned
                        isMain={userBadge.id === data.main_badge_id}
                        onPress={() => setModalOpen(true)}
                      />
                    );
                  })}
                </View>
              </View>
            </View>
          )}

          {/* Locked badges grid */}
          {lockedBadges.length > 0 && (
            <View style={styles.card}>
              <View style={styles.cardInner}>
                <Text style={styles.cardLabel}>
                  {t("gacha.badge.lockedSection")}
                </Text>
                <View style={styles.gridWrap}>
                  {lockedBadges.map((def) => (
                    <BadgeGridItem
                      key={def.id}
                      iconUrl={def.icon_url}
                      name={def.name}
                      tier={def.tier}
                      isEarned={false}
                    />
                  ))}
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {/* Main badge selection modal */}
      <Modal
        visible={modalOpen}
        transparent
        animationType="none"
        onRequestClose={() => setModalOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => {
            sheetTranslateY.stopAnimation();
            Animated.timing(sheetTranslateY, {
              toValue: 600,
              duration: 200,
              useNativeDriver: true,
            }).start(() => setModalOpen(false));
          }}
        >
          <Animated.View
            style={{ transform: [{ translateY: sheetTranslateY }] }}
            {...sheetPanResponder.panHandlers}
          >
            <Pressable onPress={() => {}}>
              <LiquidGlass
                borderRadius={24}
                tint="systemMaterialLight"
                overlayColor="rgba(255,255,255,0.35)"
              >
                <View style={styles.sheetHandleVisual}>
                  <View style={styles.sheetHandle} />
                </View>

                {/* header */}
                <View style={styles.sheetHeader}>
                  <Text style={styles.sheetTitle}>
                    {t("gacha.badge.selectModalTitle")}
                  </Text>
                  <LiquidGlass borderRadius={18}>
                    <TouchableOpacity
                      onPress={() => setModalOpen(false)}
                      style={styles.sheetCloseBtn}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="close" size={18} color={TEXT_GRAY} />
                    </TouchableOpacity>
                  </LiquidGlass>
                </View>

                <ScrollView
                  style={{ maxHeight: 400 }}
                  showsVerticalScrollIndicator={false}
                >
                  {regularBadges.map((userBadge) => {
                    const def = userBadge.badge_definitions as BadgeDefinition;
                    const isSelected = userBadge.id === data?.main_badge_id;
                    return (
                      <TouchableOpacity
                        key={userBadge.id}
                        onPress={() => setMainBadge(userBadge.id)}
                        style={styles.sheetRow}
                      >
                        <BadgeIconDisplay iconUrl={def.icon_url} size={52} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.sheetRowName}>{def.name}</Text>
                          {def.description && (
                            <Text style={styles.sheetRowDesc} numberOfLines={1}>
                              {def.description}
                            </Text>
                          )}
                        </View>
                        <View
                          style={[
                            styles.radioOuter,
                            { borderColor: isSelected ? PRIMARY : GRAY_400 },
                          ]}
                        >
                          {isSelected && <View style={styles.radioInner} />}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                  {data?.main_badge_id && (
                    <View style={styles.removeBtnWrap}>
                      <LiquidGlass
                        borderRadius={24}
                        style={[removeAnimStyle, styles.removeLiquidGlass]}
                        overlayColor="rgba(0,0,0,0.06)"
                        brightnessOpacity={removeBrightness}
                      >
                        <TouchableOpacity
                          onPressIn={removePressIn}
                          onPressOut={removePressOut}
                          onPress={() => setMainBadge(null)}
                          activeOpacity={1}
                          style={styles.removeBtnInner}
                        >
                          <Ionicons
                            name="close-circle-outline"
                            size={16}
                            color={TEXT_GRAY}
                          />
                          <Text style={styles.removeBtnText}>
                            {t("gacha.badge.removeMain")}
                          </Text>
                        </TouchableOpacity>
                      </LiquidGlass>
                    </View>
                  )}
                </ScrollView>

                <View style={{ height: insets.bottom + 8 }} />
              </LiquidGlass>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>

      <LoginModal
        visible={showLoginModal}
        onClose={() => {
          setShowLoginModal(false);
          router.back();
        }}
        onLoginPress={() => {
          setShowLoginModal(false);
          router.push("/login" as never);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: GRAY_100 },
  backBtn: { position: "absolute", left: H_PAD, zIndex: 10 },
  changeBtn: { position: "absolute", right: H_PAD, zIndex: 10 },
  scrollContent: { paddingHorizontal: H_PAD, gap: 12 },

  // White section card
  card: { backgroundColor: WHITE, borderRadius: 16 },

  // Card inner padding
  cardInner: { padding: CARD_PAD },
  cardLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: TEXT_DARK,
    letterSpacing: 0,
    marginBottom: 14,
  },

  changeBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    height: 40,
  },
  changeBtnText: { fontSize: 13, fontWeight: "700", color: PRIMARY },
  mainBadgeInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
  },
  mainBadgeName: { fontSize: 15, fontWeight: "700", color: TEXT_DARK },
  mainBadgeDesc: {
    fontSize: 12,
    color: TEXT_GRAY,
    marginTop: 3,
    lineHeight: 17,
  },
  noMainText: { fontSize: 13, color: TEXT_GRAY },

  // Special badges
  specialRow: { flexDirection: "row", gap: 12 },
  specialCard: { flex: 1, backgroundColor: WHITE, borderRadius: 14 },
  specialCardInner: {
    padding: 14,
    alignItems: "center",
    gap: 6,
  },
  specialName: {
    fontSize: 12,
    fontWeight: "700",
    color: TEXT_DARK,
    textAlign: "center",
  },
  specialTrack: { fontSize: 10, color: TEXT_GRAY },

  // Grid
  gridWrap: { flexDirection: "row", flexWrap: "wrap", gap: GRID_GAP },
  gridItem: { alignItems: "center", paddingVertical: 8 },
  gridIconWrap: { position: "relative", marginBottom: 10 },
  gridName: {
    fontSize: 12,
    fontWeight: "600",
    color: TEXT_DARK,
    textAlign: "center",
    lineHeight: 17,
  },
  gridTier: { fontSize: 11, color: TEXT_GRAY, marginTop: 3 },
  lockBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: WHITE,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  mainDot: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: PRIMARY,
    borderWidth: 2,
    borderColor: WHITE,
  },

  // Bottom sheet modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "transparent",
    justifyContent: "flex-end",
  },
  sheetHandleVisual: {
    paddingTop: 12,
    paddingBottom: 8,
    alignItems: "center",
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sheetTitle: { fontSize: 16, fontWeight: "700", color: TEXT_DARK },
  sheetCloseBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  sheetRowName: { fontSize: 16, fontWeight: "700", color: TEXT_DARK },
  sheetRowDesc: { fontSize: 13, color: TEXT_GRAY, marginTop: 3 },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: PRIMARY,
  },
  removeBtnWrap: {
    alignItems: "center",
    paddingVertical: 12,
    paddingBottom: 4,
  },
  removeLiquidGlass: { shadowOpacity: 0, elevation: 0 },
  removeBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 11,
  },
  removeBtnText: { fontSize: 13, fontWeight: "600", color: TEXT_GRAY },
});
