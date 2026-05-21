import { useCallback } from "react";
import { Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { clearAuth } from "@/store/slices/auth.slice";
import { clearWishlist } from "@/store/slices/wishlist.slice";
import { changeLanguage } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import ProfileView from "./profile.view";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

export default function ProfileScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const profile = useAppSelector((s) => s.auth.profile);
  const user = useAppSelector((s) => s.auth.user);
  const isLoggedIn = useAppSelector((s) => s.auth.isLoggedIn);

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
    nickname: profile?.nickname ?? profile?.name ?? "게스트",
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
      Alert.alert("오류", "서비스를 사용할 수 없습니다.");
      return;
    }

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      Alert.alert("오류", "로그인이 필요합니다.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/user/withdraw`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "탈퇴 실패");
      }

      await supabase.auth.signOut();
      dispatch(clearAuth());
      dispatch(clearWishlist());
      router.replace("/login" as never);
    } catch (err) {
      Alert.alert(
        "오류",
        err instanceof Error
          ? err.message
          : "탈퇴 처리 중 오류가 발생했습니다.",
      );
    }
  }, [dispatch, router]);

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
          Alert.alert("로그아웃", "로그아웃 하시겠습니까?", [
            { text: "취소", style: "cancel" },
            { text: "로그아웃", style: "destructive", onPress: doLogout },
          ]);
          break;
        case "contact":
          Linking.openURL("mailto:support@gacha-map.com");
          break;
        case "language":
          Alert.alert("언어 / Language", undefined, [
            { text: "한국어", onPress: () => changeLanguage("ko") },
            { text: "English", onPress: () => changeLanguage("en") },
            { text: "日本語", onPress: () => changeLanguage("ja") },
            { text: "中文", onPress: () => changeLanguage("zh") },
            { text: "취소 / Cancel", style: "cancel" },
          ]);
          break;
        case "withdraw":
          Alert.alert(
            "회원 탈퇴",
            "탈퇴하면 모든 데이터가 영구 삭제됩니다.\n정말 탈퇴하시겠습니까?",
            [
              { text: "취소", style: "cancel" },
              { text: "탈퇴", style: "destructive", onPress: doWithdraw },
            ],
          );
          break;
        default:
          break;
      }
    },
    [router, doLogout, doWithdraw],
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
