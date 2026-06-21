import { useCallback, useEffect, useState } from "react";
import { Alert, Modal, View, Text, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { useTranslation } from "react-i18next";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { clearAuth } from "@/store/slices/auth.slice";
import { clearWishlist } from "@/store/slices/wishlist.slice";
import { changeLanguage } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import {
  TEXT_DARK,
  TEXT_GRAY,
  GRAY_100,
  WHITE,
  PRIMARY,
  BORDER,
} from "@/constants/colors";
import { unregisterPushNotifications } from "@/lib/notifications";
import ProfileView from "./profile.view";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

export default function ProfileScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const profile = useAppSelector((s) => s.auth.profile);
  const user = useAppSelector((s) => s.auth.user);
  const isLoggedIn = useAppSelector((s) => s.auth.isLoggedIn);

  const [hasShopApplications, setHasShopApplications] = useState(false);
  const [langPickerVisible, setLangPickerVisible] = useState(false);

  useEffect(() => {
    if (!isLoggedIn || !user?.id || !supabase) return;
    supabase
      .from("shop_owner_applications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .then(({ count }) => {
        setHasShopApplications((count ?? 0) > 0);
      });
  }, [isLoggedIn, user?.id]);

  const providerRaw =
    (user?.user_metadata?.provider as string) ??
    (user?.app_metadata?.provider as string) ??
    "";
  const oauthProvider = (
    ["kakao", "naver", "google", "apple"].includes(providerRaw)
      ? providerRaw
      : undefined
  ) as "kakao" | "naver" | "google" | "apple" | undefined;

  const userProfile = {
    nickname: profile?.nickname ?? profile?.name ?? t("profile.guest"),
    oauthProvider,
    avatar_url: profile?.avatar_url ?? null,
  };

  const handleLoginPress = useCallback(() => {
    router.push("/login" as never);
  }, [router]);

  const handleEditPress = useCallback(() => {
    router.push("/profile-edit" as never);
  }, [router]);

  const doLogout = useCallback(() => {
    unregisterPushNotifications();
    if (supabase) {
      supabase.auth.signOut().finally(() => {
        dispatch(clearAuth());
        dispatch(clearWishlist());
        router.replace("/login" as never);
      });
    } else {
      dispatch(clearAuth());
      dispatch(clearWishlist());
      router.replace("/login" as never);
    }
  }, [dispatch, router]);

  const doWithdraw = useCallback(async () => {
    if (!supabase || !API_BASE) {
      Alert.alert(t("profile.errorTitle"), t("profile.serviceUnavailable"));
      return;
    }

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      Alert.alert(t("profile.errorTitle"), t("profile.loginRequired"));
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/user/withdraw`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? t("profile.withdrawFailed"),
        );
      }

      await supabase.auth.signOut();
      dispatch(clearAuth());
      dispatch(clearWishlist());
      router.replace("/login" as never);
    } catch (err) {
      Alert.alert(
        t("profile.errorTitle"),
        err instanceof Error ? err.message : t("profile.withdrawError"),
      );
    }
  }, [dispatch, router, t]);

  const handleMenuPress = useCallback(
    (menuId: string) => {
      switch (menuId) {
        case "badges":
          router.push("/badges" as never);
          break;
        case "wishlist":
          router.push("/(tabs)/search" as never);
          break;
        case "reports":
          router.push("/report-history" as never);
          break;
        case "myShop":
          router.push("/shop-application" as never);
          break;
        case "shopApplications":
          router.push("/shop-applications" as never);
          break;
        case "shopManagement":
          router.push("/shop-owner" as never);
          break;
        case "notificationSettings":
          router.push("/notification-settings" as never);
          break;
        case "terms":
          router.push("/terms" as never);
          break;
        case "privacy":
          router.push("/privacy" as never);
          break;
        case "logout":
          Alert.alert(t("profile.logoutTitle"), t("profile.logoutMessage"), [
            { text: t("profile.cancel"), style: "cancel" },
            {
              text: t("profile.logoutBtn"),
              style: "destructive",
              onPress: doLogout,
            },
          ]);
          break;
        case "contact":
          Linking.openURL(
            "https://docs.google.com/forms/d/e/1FAIpQLSePjrcGmwb3KLl_ecW1gTa98aSIbx6PhsOVamcvsbyGWT3k_Q/viewform?usp=dialog",
          );
          break;
        case "language":
          setLangPickerVisible(true);
          break;
        case "withdraw":
          Alert.alert(
            t("profile.withdrawTitle"),
            t("profile.withdrawMessage"),
            [
              { text: t("profile.cancel"), style: "cancel" },
              {
                text: t("profile.withdrawBtn"),
                style: "destructive",
                onPress: doWithdraw,
              },
            ],
          );
          break;
        default:
          break;
      }
    },
    [router, doLogout, doWithdraw, t],
  );

  const isShopOwner = profile?.role === "shop_owner";

  const LANGUAGES = [
    { code: "ko", label: "한국어" },
    { code: "en", label: "English" },
    { code: "ja", label: "日本語" },
    { code: "zh", label: "中文" },
  ];

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <ProfileView
        user={userProfile}
        isLoggedIn={isLoggedIn ?? false}
        isShopOwner={isShopOwner}
        hasShopApplications={hasShopApplications}
        contributionCount={profile?.contribution_count ?? 0}
        mainBadge={profile?.main_badge ?? null}
        onLoginPress={handleLoginPress}
        onEditPress={isLoggedIn ? handleEditPress : undefined}
        onMenuPress={handleMenuPress}
      />

      <Modal
        visible={langPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLangPickerVisible(false)}
      >
        <Pressable
          style={styles.langBackdrop}
          onPress={() => setLangPickerVisible(false)}
        >
          <View style={styles.langSheet}>
            <Text style={styles.langTitle}>
              {t("mypage.languagePickerTitle")}
            </Text>
            {LANGUAGES.map((lang, i) => (
              <View key={lang.code}>
                {i > 0 && <View style={styles.langDivider} />}
                <Pressable
                  style={styles.langOption}
                  onPress={() => {
                    changeLanguage(lang.code);
                    setLangPickerVisible(false);
                  }}
                >
                  <Text style={styles.langOptionText}>{lang.label}</Text>
                </Pressable>
              </View>
            ))}
            <View style={styles.langDivider} />
            <Pressable
              style={styles.langOption}
              onPress={() => setLangPickerVisible(false)}
            >
              <Text style={[styles.langOptionText, { color: TEXT_GRAY }]}>
                {t("profile.cancel")}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  langBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  langSheet: {
    width: "100%",
    backgroundColor: WHITE,
    borderRadius: 14,
    overflow: "hidden",
  },
  langTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: TEXT_GRAY,
    textAlign: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  langDivider: {
    height: 1,
    backgroundColor: GRAY_100,
  },
  langOption: {
    paddingVertical: 16,
    alignItems: "center",
  },
  langOptionText: {
    fontSize: 16,
    color: PRIMARY,
  },
});
