import "../polyfills";
import "../global.css";
import "react-native-gesture-handler";
import * as Sentry from "@sentry/react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { initLanguage } from "@/lib/i18n";
import { Stack, router } from "expo-router";

Sentry.init({
  dsn: __DEV__
    ? ""
    : "https://9eaa7d6fceb4e18556581d0dac7a018d@o4511489982332928.ingest.us.sentry.io/4511489987969024",
  tracesSampleRate: 1.0,
  debug: false,
  enabled: !__DEV__,
});
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { Image } from "react-native";
import { useEffect } from "react";
import { Provider } from "react-redux";
import * as Notifications from "expo-notifications";
import { store } from "@/store/store";
import {
  fetchWishlistAsync,
  clearWishlist,
} from "@/store/slices/wishlist.slice";
import {
  setUser,
  clearAuth,
  setPendingBadgeNotifications,
} from "@/store/slices/auth.slice";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import { WishToastProvider } from "@/components/ui/WishToast";
import BadgeEarnedModal from "@/components/organisms/BadgeEarnedModal";
import { registerForPushNotifications } from "@/lib/notifications";

type PushNotificationData = {
  type?:
    | "report_result"
    | "shop_owner_activity"
    | "wishlist_news"
    | "badge"
    | "shop_owner_update"
    | "wishlist_product_update";
  shop_id?: string;
};

function routeFromNotification(data: PushNotificationData) {
  switch (data.type) {
    case "report_result":
    case "wishlist_news":
    case "wishlist_product_update":
      router.push(data.shop_id ? `/shop/${data.shop_id}` : "/profile");
      break;
    case "shop_owner_activity":
      router.push(
        data.shop_id ? `/shop/${data.shop_id}?tab=reviews` : "/profile",
      );
      break;
    case "badge":
      router.push("/badges");
      break;
    case "shop_owner_update":
      router.push("/profile");
      break;
  }
}

SplashScreen.preventAutoHideAsync();

async function loadUserFromSession(session: Session) {
  if (!supabase) return;
  const { data: profileData } = await supabase
    .from("user_profiles")
    .select(
      "id, name, nickname, avatar_url, avatar_thumb_url, role, contribution_count, referral_code, user_badges!main_badge_id(id, badge_definitions(id, name, icon_url))",
    )
    .eq("id", session.user.id)
    .single();

  store.dispatch(
    setUser({
      user: session.user,
      profile: profileData
        ? {
            ...profileData,
            main_badge: (() => {
              const badgeRaw = (profileData as any)["user_badges"];
              if (!badgeRaw) return null;
              const arr = Array.isArray(badgeRaw) ? badgeRaw : [badgeRaw];
              const entry = arr[0];
              if (!entry) return null;
              const def = Array.isArray(entry.badge_definitions)
                ? entry.badge_definitions[0]
                : entry.badge_definitions;
              if (!def) return null;
              return { id: def.id, name: def.name, icon_url: def.icon_url };
            })(),
            avatar_url:
              profileData.avatar_url ??
              (session.user.user_metadata?.avatar_url as string | null) ??
              (session.user.user_metadata?.picture as string | null) ??
              null,
          }
        : {
            id: session.user.id,
            name: (session.user.user_metadata?.full_name as string) ?? null,
            nickname: null,
            avatar_url:
              (session.user.user_metadata?.avatar_url as string | null) ??
              (session.user.user_metadata?.picture as string | null) ??
              null,
            avatar_thumb_url: null,
            role: "user" as const,
            contribution_count: 0,
            main_badge: null,
            // 프로필 조회에 실패한 경우. 코드가 없으면 공유 링크에 ref를 붙이지 않는다.
            referral_code: null,
          },
    }),
  );
  store.dispatch(fetchWishlistAsync());
  fetchUnnotifiedBadges(session.user.id);
  registerForPushNotifications();
}

async function fetchUnnotifiedBadges(userId: string) {
  if (!supabase) return;
  const { data } = await supabase
    .from("user_badges")
    .select("id, badge_definitions(id, name, icon_url)")
    .eq("user_id", userId)
    .is("notified_at", null);

  const pending = (data ?? []).reduce<
    { id: string; name: string; icon_url: string }[]
  >((acc, b: any) => {
    const def = Array.isArray(b.badge_definitions)
      ? b.badge_definitions[0]
      : b.badge_definitions;
    if (def) acc.push({ id: b.id, name: def.name, icon_url: def.icon_url });
    return acc;
  }, []);

  if (pending.length > 0) {
    store.dispatch(setPendingBadgeNotifications(pending));
  }
}

export default function RootLayout() {
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    if (supabase) {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) {
          loadUserFromSession(data.session);
        } else {
          store.dispatch(clearAuth());
        }
      });

      const { data: listener } = supabase.auth.onAuthStateChange(
        (event, session) => {
          if (
            (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") &&
            session
          ) {
            loadUserFromSession(session);
          } else if (event === "SIGNED_OUT") {
            store.dispatch(clearAuth());
            store.dispatch(clearWishlist());
          }
        },
      );

      unsubscribe = () => listener.subscription.unsubscribe();
    } else {
      store.dispatch(clearAuth());
    }

    Promise.all([
      initLanguage(),
      // Image.prefetch로 Image 컴포넌트가 실제로 참조하는 캐시를 미리 채운다.
      // expo-asset의 Asset.loadAsync는 별도 캐시라 Image 렌더 시점엔 다시 로드가 걸려 효과가 없었다.
      Image.prefetch(
        Image.resolveAssetSource(
          require("../assets/images/gacha-map-logo-transparent.png"),
        ).uri,
      ).catch(() => {}),
      new Promise((r) => setTimeout(r, 2000)),
    ]).then(() => SplashScreen.hideAsync());

    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response?.notification.request.content.data) {
        routeFromNotification(
          response.notification.request.content.data as PushNotificationData,
        );
      }
    });

    const responseListener =
      Notifications.addNotificationResponseReceivedListener((response) => {
        routeFromNotification(
          response.notification.request.content.data as PushNotificationData,
        );
      });

    return () => {
      unsubscribe?.();
      responseListener.remove();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Provider store={store}>
        <WishToastProvider>
          <Stack screenOptions={{ headerShown: false }} />
          <StatusBar style="auto" />
          <BadgeEarnedModal />
        </WishToastProvider>
      </Provider>
    </GestureHandlerRootView>
  );
}
