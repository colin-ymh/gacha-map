import "../global.css";
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
import { supabase } from "@/lib/supabase";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    if (supabase) {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) {
          store.dispatch(fetchWishlistAsync());
        }
      });

      const { data: listener } = supabase.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_IN") {
          store.dispatch(fetchWishlistAsync());
        } else if (event === "SIGNED_OUT") {
          store.dispatch(clearWishlist());
        }
      });

      unsubscribe = () => listener.subscription.unsubscribe();
    }

    SplashScreen.hideAsync();

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
