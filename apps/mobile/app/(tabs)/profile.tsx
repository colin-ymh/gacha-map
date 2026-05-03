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
  const isLoggedIn = useAppSelector((s) => s.auth.isLoggedIn);

  const user = {
    nickname: profile?.nickname ?? profile?.name ?? "게스트",
    oauthProvider: "kakao" as const,
  };

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
          // TODO: 회원탈퇴 처리
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
        user={user}
        onEditPress={isLoggedIn ? handleEditPress : undefined}
        onMenuPress={handleMenuPress}
      />
    </SafeAreaView>
  );
}
