"use client";

import { useState, useEffect } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
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

function getDisplayName(user: User): string {
  const name =
    user.user_metadata?.full_name ?? user.user_metadata?.name ?? null;
  if (name) return name;
  const email = user.email ?? "";
  if (email.includes("gacha-map.internal")) return "사용자";
  return email || "사용자";
}

// ── ViewModel ─────────────────────────────────────────────────────────────────

const MypagePanel = () => {
  const locale = useLocale();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [nickname, setNickname] = useState<string | null>(null);
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isLoginPopupOpen, setIsLoginPopupOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user: u } }) => {
      setUser(u);
      if (u) {
        const { data } = await supabase
          .from("user_profiles")
          .select("nickname, avatar_url")
          .eq("id", u.id)
          .maybeSingle();
        setNickname(data?.nickname ?? null);
        setProfileAvatarUrl(data?.avatar_url ?? null);
      } else {
        setIsLoginPopupOpen(true);
      }
      setIsLoading(false);
    });
  }, []);

  const handleLogout = async () => {
    const t_confirm = "로그아웃 하시겠습니까?";
    if (!confirm(t_confirm)) return;
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  const handleWithdraw = async () => {
    const t_confirm = "정말 탈퇴하시겠습니까?";
    if (!confirm(t_confirm)) return;
    const res = await fetch("/api/user/withdraw", { method: "DELETE" });
    if (!res.ok) return;
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  const handleLanguageSelect = (code: string) => {
    const pathname = window.location.pathname.replace(/^\/[a-z]{2}/, "") || "/";
    router.push(pathname, { locale: code });
    setIsLangOpen(false);
  };

  if (isLoading) return null;

  const currentLang = LANGUAGES.find((l) => l.code === locale)?.label ?? locale;

  return (
    <MypagePanelView
      user={user}
      nickname={nickname}
      profileAvatarUrl={profileAvatarUrl}
      displayName={user ? getDisplayName(user) : ""}
      providerLabel={user ? getProviderLabel(user) : ""}
      locale={locale}
      currentLang={currentLang}
      isLangOpen={isLangOpen}
      isLoginPopupOpen={isLoginPopupOpen}
      onEditProfile={() => router.push("/mypage/edit")}
      onWishlist={() => router.push("/wishlist")}
      onReports={() => router.push("/mypage/reports")}
      onToggleLang={() => setIsLangOpen((v) => !v)}
      onLanguageSelect={handleLanguageSelect}
      onTerms={() => router.push("/terms")}
      onPrivacy={() => router.push("/privacy")}
      onContact={() => {
        const a = document.createElement("a");
        a.href = `mailto:gachamap1120@gmail.com?subject=${encodeURIComponent("[가챠맵] 문의")}`;
        a.click();
      }}
      onLogout={handleLogout}
      onWithdraw={handleWithdraw}
      onLoginPopupClose={() => router.back()}
    />
  );
};

export default MypagePanel;

export { APP_VERSION };
