import { useCallback } from "react";
import { Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { clearAuth } from "@/store/slices/auth.slice";
import { changeLanguage } from "@/lib/i18n";
import ProfileView from "./profile.view";

export default function ProfileScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const profile = useAppSelector((s) => s.auth.profile);
  const user = useAppSelector((s) => s.auth.user);
  const isLoggedIn = useAppSelector((s) => s.auth.isLoggedIn);

  const providerRaw = (user?.app_metadata?.provider as string) ?? "";
  const oauthProvider = (
    ["kakao", "google", "apple"].includes(providerRaw) ? providerRaw : undefined
  ) as "kakao" | "google" | "apple" | undefined;

  const userProfile = {
    nickname: profile?.nickname ?? profile?.name ?? "게스트",
    oauthProvider,
  };

  const handleLoginPress = useCallback(() => {
    router.push("/login" as never);
  }, [router]);

  const handleEditPress = useCallback(() => {
    router.push("/profile-edit" as never);
  }, [router]);

  const handleMenuPress = useCallback(
    (menuId: string) => {
      switch (menuId) {
        case "wishlist":
          router.push("/(tabs)/search" as never);
          break;
        case "reports":
          router.push("/report-history" as never);
          break;
        case "terms":
          router.push("/terms" as never);
          break;
        case "privacy":
          router.push("/privacy" as never);
          break;
        case "logout":
          dispatch(clearAuth());
          router.replace("/login" as never);
          break;
        case "contact":
          Linking.openURL("mailto:support@gacha-map.com");
          break;
        case "language":
          Alert.alert(
            "언어 / Language",
            undefined,
            [
              { text: "한국어", onPress: () => changeLanguage("ko") },
              { text: "English", onPress: () => changeLanguage("en") },
              { text: "日本語", onPress: () => changeLanguage("ja") },
              { text: "中文", onPress: () => changeLanguage("zh") },
              { text: "취소 / Cancel", style: "cancel" },
            ],
          );
          break;
        case "withdraw":
          console.log("TODO: withdraw");
          break;
        default:
          break;
      }
    },
    [router, dispatch],
  );

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <ProfileView
        user={userProfile}
        isLoggedIn={isLoggedIn ?? false}
        onLoginPress={handleLoginPress}
        onEditPress={isLoggedIn ? handleEditPress : undefined}
        onMenuPress={handleMenuPress}
      />
    </SafeAreaView>
  );
}
