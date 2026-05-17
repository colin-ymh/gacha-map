import "../global.css";
import { initLanguage } from "@/lib/i18n";
import { Stack } from "expo-router";
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

SplashScreen.preventAutoHideAsync();

async function loadUserFromSession(session: Session) {
  if (!supabase) return;
  const { data: profileData } = await supabase
    .from("user_profiles")
    .select("id, name, nickname, avatar_url, role")
    .eq("id", session.user.id)
    .single();

  store.dispatch(
    setUser({
      user: session.user,
      profile: profileData ?? {
        id: session.user.id,
        name: (session.user.user_metadata?.full_name as string) ?? null,
        nickname: null,
        avatar_url: null,
        role: "user" as const,
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
          if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session) {
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

    initLanguage().then(() => SplashScreen.hideAsync());

    return () => {
      unsubscribe?.();
    };
  }, []);

  return (
    <Provider store={store}>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="auto" />
    </Provider>
  );
}
