import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Switch,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { getAuthHeaders } from "@/lib/supabase";
import {
  PRIMARY,
  TEXT_DARK,
  TEXT_GRAY,
  WHITE,
  GRAY_100,
  GRAY_300,
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
];

export default function NotificationSettingsScreen() {
  const router = useRouter();
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
          {t("notificationSettings.title")}
        </Text>
      </View>

      {!prefs ? (
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          {loadError ? (
            <Text style={{ fontSize: 13, color: DANGER_BRIGHT }}>
              {t("notificationSettings.loadError")}
            </Text>
          ) : (
            <ActivityIndicator color={PRIMARY} />
          )}
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingVertical: 8 }}>
          {saveError && (
            <Text
              style={{
                fontSize: 12,
                color: DANGER_BRIGHT,
                paddingHorizontal: 16,
                paddingVertical: 8,
              }}
            >
              {t("notificationSettings.saveError")}
            </Text>
          )}
          {CATEGORIES.map((cat, index) => (
            <View key={cat.key}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                }}
              >
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={{ fontSize: 15, color: TEXT_DARK }}>
                    {t(cat.labelKey)}
                  </Text>
                  <Text
                    style={{ fontSize: 12, color: TEXT_GRAY, marginTop: 3 }}
                  >
                    {t(cat.descKey)}
                  </Text>
                </View>
                <Switch
                  value={prefs[cat.key]}
                  onValueChange={(value) => toggle(cat.key, value)}
                  trackColor={{ false: GRAY_300, true: PRIMARY }}
                  thumbColor={WHITE}
                />
              </View>
              {index < CATEGORIES.length - 1 && (
                <View
                  style={{
                    height: 1,
                    backgroundColor: GRAY_100,
                    marginHorizontal: 16,
                  }}
                />
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
