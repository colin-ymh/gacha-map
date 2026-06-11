"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { clearAuth } from "@/store/slices/auth.slice";
import { clearWishlist } from "@/store/slices/wishlist.slice";
import MypagePanelView, { LANGUAGES, APP_VERSION } from "./mypage-panel.view";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getProviderLabel(user: User): string {
  const provider =
    user.user_metadata?.provider ??
    user.app_metadata?.provider ??
    user.app_metadata?.providers?.[0] ??
    "";
  if (provider === "google") return "Google";
  if (provider === "kakao") return "카카오";
  if (provider === "naver") return "네이버";
  return provider;
}

function getDisplayName(user: User, fallback: string): string {
  const name =
    user.user_metadata?.full_name ?? user.user_metadata?.name ?? null;
  if (name) return name;
  const email = user.email ?? "";
  if (email.includes("gacha-map.internal")) return fallback;
  return email || fallback;
}

// ── ViewModel ─────────────────────────────────────────────────────────────────

const MypagePanel = () => {
  const t = useTranslations("mypage");
  const locale = useLocale();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { user, profile, loading, isLoggedIn } = useAppSelector((s) => s.auth);
  const [isLangOpen, setIsLangOpen] = useState(false);

  const nickname = profile?.nickname ?? null;
  const profileAvatarUrl = profile?.avatar_url ?? null;
  const contributionCount = profile?.contribution_count ?? 0;
  const mainBadge = profile?.main_badge ?? null;

  const handleLogout = async () => {
    if (!confirm(t("logoutConfirm"))) return;
    const supabase = createClient();
    await supabase.auth.signOut();
    dispatch(clearAuth());
    dispatch(clearWishlist());
    router.push("/");
    router.refresh();
  };

  const handleWithdraw = async () => {
    if (!confirm(t("withdrawConfirm"))) return;
    const res = await fetch("/api/user/withdraw", { method: "DELETE" });
    if (!res.ok) return;
    const supabase = createClient();
    await supabase.auth.signOut();
    dispatch(clearAuth());
    dispatch(clearWishlist());
    router.push("/");
    router.refresh();
  };

  const handleContact = () => {
    window.open(
      "https://docs.google.com/forms/d/e/1FAIpQLSePjrcGmwb3KLl_ecW1gTa98aSIbx6PhsOVamcvsbyGWT3k_Q/viewform?usp=dialog",
      "_blank",
    );
  };

  const handleLanguageSelect = (code: string) => {
    const pathname = window.location.pathname.replace(/^\/[a-z]{2}/, "") || "/";
    router.push(pathname, { locale: code });
    setIsLangOpen(false);
  };

  if (loading || isLoggedIn === null) return null;

  const currentLang = LANGUAGES.find((l) => l.code === locale)?.label ?? locale;
  const isShopOwner = profile?.role === "shop_owner";

  return (
    <MypagePanelView
      user={user}
      nickname={nickname}
      profileAvatarUrl={profileAvatarUrl}
      displayName={user ? getDisplayName(user, t("guestUser")) : ""}
      providerLabel={user ? getProviderLabel(user) : ""}
      locale={locale}
      currentLang={currentLang}
      isLangOpen={isLangOpen}
      isLoginPopupOpen={isLoggedIn === false}
      isShopOwner={isShopOwner}
      mainBadge={mainBadge}
      onBadges={() => router.push("/mypage/badges")}
      onEditProfile={() => router.push("/mypage/edit")}
      onWishlist={() => router.push("/wishlist")}
      onReports={() => router.push("/mypage/reports")}
      onShopApplication={() => router.push("/shop-application")}
      onShopApplications={() => router.push("/mypage/shop-applications")}
      onShopManagement={() => router.push("/shop-owner")}
      onToggleLang={() => setIsLangOpen((v) => !v)}
      onLanguageSelect={handleLanguageSelect}
      onTerms={() => router.push("/terms")}
      onPrivacy={() => router.push("/privacy")}
      onContact={handleContact}
      onLogout={handleLogout}
      onWithdraw={handleWithdraw}
      onLoginPopupClose={() => router.back()}
    />
  );
};

export default MypagePanel;

export { APP_VERSION };
