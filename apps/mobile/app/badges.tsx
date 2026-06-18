import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import type { BadgeDefinition, UserBadge } from "@gacha-map/shared";
import { getAuthHeaders } from "@/lib/supabase";
import { useAppDispatch } from "@/store/hooks";
import { setProfileMainBadge } from "@/store/slices/auth.slice";
import {
  PRIMARY,
  PRIMARY_BG,
  TEXT_DARK,
  TEXT_GRAY,
  WHITE,
  GRAY_100,
  GRAY_200,
  GRAY_400,
  BORDER,
} from "@/constants/colors";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

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
}: {
  iconUrl: string;
  size?: number;
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
        backgroundColor: GRAY_100,
      }}
    >
      <Text style={{ fontSize: size * 0.6 }}>{iconUrl || "🏅"}</Text>
    </View>
  );
}

export default function BadgesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [data, setData] = useState<BadgesPageData | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/users/badges`, { headers });
      if (res.ok) setData(await res.json());
    })();
  }, []);

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
    data?.earned.filter(
      (b) =>
        (b.badge_definitions as BadgeDefinition).track !== "operator" &&
        (b.badge_definitions as BadgeDefinition).track !== "admin",
    ) ?? [];
  const lockedBadges = data
    ? computeLockedBadges(data.definitions, data.earned)
    : [];
  const mainUserBadge = regularBadges.find((b) => b.id === data?.main_badge_id);
  const mainDef = mainUserBadge
    ? (mainUserBadge.badge_definitions as BadgeDefinition)
    : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: WHITE }} edges={["top"]}>
      {/* Header */}
      <View
        style={{
          height: 52,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 8,
          borderBottomWidth: 1,
          borderBottomColor: GRAY_100,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          style={{ padding: 8 }}
          hitSlop={8}
        >
          <Text style={{ fontSize: 22, color: TEXT_DARK }}>‹</Text>
        </Pressable>
        <Text
          style={{
            flex: 1,
            textAlign: "center",
            fontSize: 16,
            fontWeight: "700",
            color: TEXT_DARK,
            marginRight: 40,
          }}
        >
          {t("gacha.badge.pageTitle")}
        </Text>
      </View>

      {!data ? (
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator color={PRIMARY} />
          <Text style={{ marginTop: 8, fontSize: 13, color: TEXT_GRAY }}>
            {t("gacha.badge.loading")}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
          {/* Motivation text */}
          <Text style={{ fontSize: 13, color: TEXT_GRAY, marginBottom: 12 }}>
            {t("gacha.badge.motivationText")}
          </Text>

          {/* Main badge section */}
          <View
            style={{
              borderRadius: 12,
              backgroundColor: mainDef ? PRIMARY_BG : GRAY_100,
              borderWidth: 1,
              borderColor: mainDef ? PRIMARY : GRAY_200,
              padding: 14,
              marginBottom: 8,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: mainDef ? 10 : 0,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "700", color: PRIMARY }}>
                {t("gacha.badge.mainSection")}
              </Text>
              <Pressable onPress={() => setModalOpen(true)}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: PRIMARY,
                  }}
                >
                  {mainDef
                    ? t("gacha.badge.changeMain")
                    : t("gacha.badge.setMain")}
                </Text>
              </Pressable>
            </View>
            {mainDef ? (
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <BadgeIconDisplay iconUrl={mainDef.icon_url} size={44} />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "700",
                      color: TEXT_DARK,
                    }}
                  >
                    {mainDef.name}
                  </Text>
                  {mainDef.description && (
                    <Text
                      style={{
                        fontSize: 12,
                        color: TEXT_GRAY,
                        marginTop: 2,
                        lineHeight: 17,
                      }}
                    >
                      {mainDef.description}
                    </Text>
                  )}
                </View>
              </View>
            ) : (
              <Text style={{ fontSize: 13, color: TEXT_GRAY }}>
                {t("gacha.badge.noMainBadge")}
              </Text>
            )}
          </View>

          {/* Admin badge */}
          {adminBadge && (
            <>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  color: TEXT_GRAY,
                  letterSpacing: 0.5,
                  marginTop: 12,
                  marginBottom: 4,
                }}
              >
                {t("gacha.badge.adminSection")}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  backgroundColor: WHITE,
                  borderRadius: 12,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: GRAY_200,
                  marginBottom: 8,
                }}
              >
                <BadgeIconDisplay
                  iconUrl={
                    (adminBadge.badge_definitions as BadgeDefinition).icon_url
                  }
                  size={44}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "700",
                      color: TEXT_DARK,
                    }}
                  >
                    {(adminBadge.badge_definitions as BadgeDefinition).name}
                  </Text>
                  {(adminBadge.badge_definitions as BadgeDefinition)
                    .description && (
                    <Text
                      style={{
                        fontSize: 12,
                        color: TEXT_GRAY,
                        marginTop: 2,
                        lineHeight: 17,
                      }}
                    >
                      {
                        (adminBadge.badge_definitions as BadgeDefinition)
                          .description
                      }
                    </Text>
                  )}
                </View>
              </View>
            </>
          )}

          {/* Operator badge */}
          {operatorBadge && (
            <>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  color: TEXT_GRAY,
                  letterSpacing: 0.5,
                  marginTop: 12,
                  marginBottom: 4,
                }}
              >
                {t("gacha.badge.operatorSection")}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  backgroundColor: WHITE,
                  borderRadius: 12,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: GRAY_200,
                  marginBottom: 8,
                }}
              >
                <BadgeIconDisplay
                  iconUrl={
                    (operatorBadge.badge_definitions as BadgeDefinition)
                      .icon_url
                  }
                  size={44}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "700",
                      color: TEXT_DARK,
                    }}
                  >
                    {(operatorBadge.badge_definitions as BadgeDefinition).name}
                  </Text>
                  {(operatorBadge.badge_definitions as BadgeDefinition)
                    .description && (
                    <Text
                      style={{
                        fontSize: 12,
                        color: TEXT_GRAY,
                        marginTop: 2,
                        lineHeight: 17,
                      }}
                    >
                      {
                        (operatorBadge.badge_definitions as BadgeDefinition)
                          .description
                      }
                    </Text>
                  )}
                </View>
              </View>
            </>
          )}

          {/* Earned badges */}
          {regularBadges.length > 0 && (
            <>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  color: TEXT_GRAY,
                  letterSpacing: 0.5,
                  marginTop: 12,
                  marginBottom: 4,
                }}
              >
                {t("gacha.badge.earnedSection")}
              </Text>
              {regularBadges.map((userBadge) => {
                const def = userBadge.badge_definitions as BadgeDefinition;
                const isMain = userBadge.id === data.main_badge_id;
                return (
                  <Pressable
                    key={userBadge.id}
                    onPress={() => {
                      if (regularBadges.length > 0) setModalOpen(true);
                    }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      backgroundColor: WHITE,
                      borderRadius: 12,
                      padding: 14,
                      borderWidth: 1,
                      borderColor: isMain ? PRIMARY : GRAY_200,
                      marginBottom: 8,
                    }}
                  >
                    <BadgeIconDisplay iconUrl={def.icon_url} size={44} />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "700",
                          color: TEXT_DARK,
                        }}
                      >
                        {def.name}
                      </Text>
                      {def.description && (
                        <Text
                          style={{
                            fontSize: 12,
                            color: TEXT_GRAY,
                            marginTop: 2,
                            lineHeight: 17,
                          }}
                        >
                          {def.description}
                        </Text>
                      )}
                    </View>
                    {isMain && (
                      <View
                        style={{
                          backgroundColor: PRIMARY_BG,
                          borderRadius: 6,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: "700",
                            color: PRIMARY,
                          }}
                        >
                          {t("gacha.badge.isMain")}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </>
          )}

          {/* Locked badges */}
          {lockedBadges.length > 0 && (
            <>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  color: TEXT_GRAY,
                  letterSpacing: 0.5,
                  marginTop: 12,
                  marginBottom: 4,
                }}
              >
                {t("gacha.badge.lockedSection")}
              </Text>
              {lockedBadges.map((def) => (
                <View
                  key={def.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    backgroundColor: WHITE,
                    borderRadius: 12,
                    padding: 14,
                    borderWidth: 1,
                    borderColor: GRAY_200,
                    marginBottom: 8,
                    opacity: 0.5,
                  }}
                >
                  <View style={{ filter: "grayscale(1)" } as never}>
                    <BadgeIconDisplay iconUrl={def.icon_url} size={44} />
                  </View>
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 14,
                      fontWeight: "600",
                      color: GRAY_400,
                    }}
                  >
                    {def.name}
                  </Text>
                  <Text style={{ fontSize: 16 }}>🔒</Text>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      )}

      {/* Main badge selection modal */}
      <Modal
        visible={modalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setModalOpen(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.4)",
            justifyContent: "flex-end",
          }}
          onPress={() => setModalOpen(false)}
        >
          <SafeAreaView style={{ backgroundColor: WHITE }} edges={["bottom"]}>
            <Pressable>
              <View
                style={{
                  paddingHorizontal: 16,
                  paddingTop: 16,
                  paddingBottom: 8,
                  borderBottomWidth: 1,
                  borderBottomColor: GRAY_100,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "700",
                    color: TEXT_DARK,
                  }}
                >
                  {t("gacha.badge.selectModalTitle")}
                </Text>
                <Pressable onPress={() => setModalOpen(false)}>
                  <Text style={{ fontSize: 22, color: TEXT_GRAY }}>✕</Text>
                </Pressable>
              </View>
              <ScrollView style={{ maxHeight: 400 }}>
                {regularBadges.map((userBadge, idx) => {
                  const def = userBadge.badge_definitions as BadgeDefinition;
                  const isSelected = userBadge.id === data?.main_badge_id;
                  return (
                    <Pressable
                      key={userBadge.id}
                      onPress={() => setMainBadge(userBadge.id)}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                        borderTopWidth: idx === 0 ? 0 : 1,
                        borderTopColor: GRAY_100,
                      }}
                    >
                      <BadgeIconDisplay iconUrl={def.icon_url} size={40} />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: "600",
                            color: TEXT_DARK,
                          }}
                        >
                          {def.name}
                        </Text>
                        {def.description && (
                          <Text
                            style={{
                              fontSize: 12,
                              color: TEXT_GRAY,
                              marginTop: 2,
                            }}
                          >
                            {def.description}
                          </Text>
                        )}
                      </View>
                      <View
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 10,
                          borderWidth: 2,
                          borderColor: isSelected ? PRIMARY : GRAY_400,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {isSelected && (
                          <View
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: 5,
                              backgroundColor: PRIMARY,
                            }}
                          />
                        )}
                      </View>
                    </Pressable>
                  );
                })}
                {data?.main_badge_id && (
                  <Pressable
                    onPress={() => setMainBadge(null)}
                    style={{
                      alignItems: "center",
                      paddingVertical: 14,
                      borderTopWidth: 1,
                      borderTopColor: BORDER,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        color: TEXT_GRAY,
                        fontWeight: "500",
                      }}
                    >
                      {t("gacha.badge.removeMain")}
                    </Text>
                  </Pressable>
                )}
              </ScrollView>
            </Pressable>
          </SafeAreaView>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
