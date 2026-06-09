import "../global.css";
import * as Sentry from "@sentry/react-native";
import { initLanguage } from "@/lib/i18n";
import { Stack } from "expo-router";

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
import { useEffect } from "react";
import { Provider } from "react-redux";
import { store } from "@/store/store";
import {
  fetchWishlistAsync,
  clearWishlist,
} from "@/store/slices/wishlist.slice";
import { setUser, clearAuth } from "@/store/slices/auth.slice";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import { WishToastProvider } from "@/components/ui/WishToast";

SplashScreen.preventAutoHideAsync();

async function loadUserFromSession(session: Session) {
  if (!supabase) return;
  const { data: profileData } = await supabase
    .from("user_profiles")
    .select(
      "id, name, nickname, avatar_url, avatar_thumb_url, role, contribution_count, user_badges!main_badge_id(id, badge_definitions(id, name, icon_url))",
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
              const badgeRaw = (profileData as any)[
                "user_badges!main_badge_id"
              ];
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
          },
    }),
  );
  store.dispatch(fetchWishlistAsync());
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

    Promise.all([initLanguage(), new Promise((r) => setTimeout(r, 2000))]).then(
      () => SplashScreen.hideAsync(),
    );

    return () => {
      unsubscribe?.();
    };
  }, []);

  return (
    <Provider store={store}>
      <WishToastProvider>
        <Stack screenOptions={{ headerShown: false }} />
        <StatusBar style="auto" />
      </WishToastProvider>
    </Provider>
  );
}
