import { useEffect, useState } from "react";
import { SkeletonBone } from "@/components/ui/Skeleton";
import {
  View,
  Text,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { GlassBackButton } from "@/components/ui/GlassBackButton";
import { GlassSwitch } from "@/components/ui/GlassSwitch";
import { getAuthHeaders } from "@/lib/supabase";
import {
  TEXT_DARK,
  TEXT_GRAY,
  WHITE,
  GRAY_100,
  GRAY_200,
  DANGER_BRIGHT,
} from "@/constants/colors";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

interface NotificationPreferences {
  report_result: boolean;
  shop_owner_activity: boolean;
  wishlist_news: boolean;
  badge: boolean;
  shop_owner_update: boolean;
  wishlist_product_update: boolean;
  product_wishlist_restock: boolean;
  gacha_bonus: boolean;
}

const CATEGORIES: {
  key: keyof NotificationPreferences;
  labelKey: string;
  descKey: string;
}[] = [
  {
    key: "report_result",
    labelKey: "notificationSettings.reportResult",
    descKey: "notificationSettings.reportResultDesc",
  },
  {
    key: "shop_owner_activity",
    labelKey: "notificationSettings.shopOwnerActivity",
    descKey: "notificationSettings.shopOwnerActivityDesc",
  },
  {
    key: "wishlist_news",
    labelKey: "notificationSettings.wishlistNews",
    descKey: "notificationSettings.wishlistNewsDesc",
  },
  {
    key: "badge",
    labelKey: "notificationSettings.badge",
    descKey: "notificationSettings.badgeDesc",
  },
  {
    key: "shop_owner_update",
    labelKey: "notificationSettings.shopOwnerUpdate",
    descKey: "notificationSettings.shopOwnerUpdateDesc",
  },
  {
    key: "wishlist_product_update",
    labelKey: "notificationSettings.wishlistProductUpdate",
    descKey: "notificationSettings.wishlistProductUpdateDesc",
  },
  {
    key: "product_wishlist_restock",
    labelKey: "notificationSettings.productWishlistRestock",
    descKey: "notificationSettings.productWishlistRestockDesc",
  },
  {
    key: "gacha_bonus",
    labelKey: "notificationSettings.gachaBonus",
    descKey: "notificationSettings.gachaBonusDesc",
  },
];

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${API_BASE}/api/notifications/preferences`, {
          headers,
        });
        if (!res.ok) {
          setLoadError(true);
          return;
        }
        const json = await res.json();
        setPrefs(json.preferences);
      } catch {
        setLoadError(true);
      }
    })();
  }, []);

  async function toggle(key: keyof NotificationPreferences, value: boolean) {
    if (!prefs) return;
    const prev = prefs;
    setSaveError(false);
    setPrefs({ ...prefs, [key]: value });
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/notifications/preferences`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      if (!res.ok) {
        setPrefs(prev);
        setSaveError(true);
      }
    } catch {
      setPrefs(prev);
      setSaveError(true);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: GRAY_100 }}>
      {/* 플로팅 뒤로가기 */}
      <View style={{ position: "absolute", left: 16, top: insets.top + 8, zIndex: 10 }}>
        <GlassBackButton onPress={() => router.back()} />
      </View>

      {!prefs ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingTop: insets.top + 60, paddingHorizontal: 16, paddingBottom: insets.bottom + 20 }}
        >
          {loadError ? (
            <View style={{ alignItems: "center", paddingTop: 40 }}>
              <Text style={{ fontSize: 14, color: DANGER_BRIGHT }}>
                {t("notificationSettings.loadError")}
              </Text>
            </View>
          ) : (
            <View
              style={{
                backgroundColor: WHITE,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: GRAY_200,
                overflow: "hidden",
              }}
            >
              {[0, 1, 2, 3].map((i) => (
                <View key={i}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      paddingHorizontal: 20,
                      paddingVertical: 18,
                    }}
                  >
                    <View style={{ gap: 6 }}>
                      <SkeletonBone width={140} height={15} borderRadius={5} />
                      <SkeletonBone width={100} height={12} borderRadius={4} />
                    </View>
                    <SkeletonBone width={44} height={26} borderRadius={13} />
                  </View>
                  {i < 3 && (
                    <View style={{ height: 1, backgroundColor: GRAY_100, marginHorizontal: 20 }} />
                  )}
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: insets.top + 60, paddingHorizontal: 16, paddingBottom: insets.bottom + 20 }}
        >
          {saveError && (
            <Text
              style={{
                fontSize: 13,
                color: DANGER_BRIGHT,
                marginBottom: 12,
              }}
            >
              {t("notificationSettings.saveError")}
            </Text>
          )}
          <View
            style={{
              backgroundColor: WHITE,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: GRAY_200,
              overflow: "hidden",
            }}
          >
            {CATEGORIES.map((cat, index) => (
              <View key={cat.key}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingLeft: 20,
                    paddingRight: 16,
                    paddingVertical: 18,
                  }}
                >
                  <View style={{ flex: 1, marginRight: 16 }}>
                    <Text style={{ fontSize: 15, fontWeight: "600", color: TEXT_DARK }}>
                      {t(cat.labelKey)}
                    </Text>
                    <Text style={{ fontSize: 13, color: TEXT_GRAY, marginTop: 4 }}>
                      {t(cat.descKey)}
                    </Text>
                  </View>
                  <GlassSwitch
                    value={prefs[cat.key]}
                    onValueChange={(value) => toggle(cat.key, value)}
                  />
                </View>
                {index < CATEGORIES.length - 1 && (
                  <View
                    style={{
                      height: 1,
                      backgroundColor: GRAY_100,
                      marginHorizontal: 20,
                    }}
                  />
                )}
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
