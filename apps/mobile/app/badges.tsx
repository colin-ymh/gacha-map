import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import type { BadgeDefinition, UserBadge } from "@gacha-map/shared";
import { getAuthHeaders } from "@/lib/supabase";
import {
  PRIMARY,
  PRIMARY_BG,
  TEXT_DARK,
  TEXT_GRAY,
  WHITE,
  GRAY_100,
  GRAY_200,
  SURFACE_SUBTLE,
} from "@/constants/colors";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

const TRACKS = [
  "quick_report",
  "shop_review",
  "new_shop_report",
  "closed_shop_report",
  "fix_info_report",
  "wishlist",
] as const;

type Track = (typeof TRACKS)[number];

const TRACK_I18N_KEYS: Record<Track, string> = {
  quick_report: "tracks.quickReport",
  shop_review: "tracks.shopReview",
  new_shop_report: "tracks.newShopReport",
  closed_shop_report: "tracks.closedShopReport",
  fix_info_report: "tracks.fixInfoReport",
  wishlist: "tracks.wishlist",
};

interface BadgesPageData {
  definitions: BadgeDefinition[];
  earned: UserBadge[];
  main_badge_id: string | null;
}

function BadgeIcon({ iconUrl }: { iconUrl: string }) {
  if (iconUrl && iconUrl.startsWith("http")) {
    return (
      <Image
        source={{ uri: iconUrl }}
        style={{ width: 32, height: 32 }}
        resizeMode="contain"
      />
    );
  }
  return <Text style={{ fontSize: 28 }}>{iconUrl || "🏅"}</Text>;
}

export default function BadgesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [data, setData] = useState<BadgesPageData | null>(null);

  useEffect(() => {
    (async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/users/badges`, { headers });
      if (res.ok) setData(await res.json());
    })();
  }, []);

  async function toggleMainBadge(userBadgeId: string) {
    if (!data) return;
    const newId = userBadgeId === data.main_badge_id ? null : userBadgeId;
    const headers = await getAuthHeaders();
    await fetch(`${API_BASE}/api/users/badges/main`, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ badge_id: newId }),
    });
    setData((prev) => (prev ? { ...prev, main_badge_id: newId } : prev));
  }

  const earnedMap = data
    ? new Map(data.earned.map((b) => [b.badge_definition_id, b]))
    : null;
  const operatorBadge = data?.earned.find(
    (b) => (b.badge_definitions as BadgeDefinition).track === "operator",
  );

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
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color={PRIMARY} />
          <Text style={{ marginTop: 8, fontSize: 13, color: TEXT_GRAY }}>
            {t("gacha.badge.loading")}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {/* Operator badge */}
          {operatorBadge && (
            <View
              style={{
                marginBottom: 24,
                padding: 16,
                borderRadius: 12,
                backgroundColor: PRIMARY_BG,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "600",
                  color: PRIMARY,
                  marginBottom: 8,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                {t("gacha.badge.operatorSection")}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <BadgeIcon
                  iconUrl={
                    (operatorBadge.badge_definitions as BadgeDefinition).icon_url
                  }
                />
                <Text style={{ fontSize: 14, fontWeight: "600", color: TEXT_DARK }}>
                  {(operatorBadge.badge_definitions as BadgeDefinition).name}
                </Text>
              </View>
            </View>
          )}

          {/* Track sections */}
          {TRACKS.map((track) => {
            const trackDefs = data.definitions.filter((d) => d.track === track);
            if (trackDefs.length === 0) return null;
            return (
              <View key={track} style={{ marginBottom: 24 }}>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: TEXT_DARK,
                    marginBottom: 12,
                  }}
                >
                  {t(`gacha.badge.${TRACK_I18N_KEYS[track]}`)}
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                  {trackDefs.map((def) => {
                    const userBadge = earnedMap!.get(def.id);
                    const earned = !!userBadge;
                    const isMain = userBadge?.id === data.main_badge_id;
                    return (
                      <Pressable
                        key={def.id}
                        onPress={() => {
                          if (!earned || !userBadge) return;
                          toggleMainBadge(userBadge.id);
                        }}
                        style={{
                          width: 80,
                          paddingVertical: 12,
                          paddingHorizontal: 8,
                          borderRadius: 12,
                          alignItems: "center",
                          opacity: earned ? 1 : 0.4,
                          borderWidth: 2,
                          borderColor: isMain ? PRIMARY : "transparent",
                          backgroundColor: earned ? WHITE : GRAY_200,
                        }}
                      >
                        <View
                          style={{
                            width: 36,
                            height: 36,
                            alignItems: "center",
                            justifyContent: "center",
                            marginBottom: 4,
                          }}
                        >
                          {earned ? (
                            <BadgeIcon iconUrl={def.icon_url} />
                          ) : (
                            <Text style={{ fontSize: 28 }}>🔒</Text>
                          )}
                        </View>
                        {earned ? (
                          <>
                            <Text
                              style={{
                                fontSize: 10,
                                fontWeight: "500",
                                color: TEXT_DARK,
                                textAlign: "center",
                                lineHeight: 13,
                              }}
                            >
                              {def.name}
                            </Text>
                            {isMain && (
                              <Text
                                style={{
                                  fontSize: 9,
                                  color: PRIMARY,
                                  fontWeight: "600",
                                  marginTop: 2,
                                }}
                              >
                                {t("gacha.badge.mainLabel")}
                              </Text>
                            )}
                          </>
                        ) : (
                          <Text style={{ fontSize: 10, color: TEXT_GRAY }}>
                            {t("gacha.badge.locked")}
                          </Text>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
