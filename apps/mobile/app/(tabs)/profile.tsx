import { useCallback } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { clearAuth } from "@/store/slices/auth.slice";
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
