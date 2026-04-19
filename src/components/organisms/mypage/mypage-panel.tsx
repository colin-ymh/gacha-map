"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import styled from "styled-components";
import { createClient } from "@/lib/supabase/client";
import LoginPopup from "@/components/organisms/auth/login-popup";
import type { User } from "@supabase/supabase-js";

// ── Styled ────────────────────────────────────────────────────────────────────

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  padding-bottom: 32px;
`;

const ProfileSection = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px 16px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.gray100};
`;

const Avatar = styled.div`
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.thumbnailPlaceholder};
  flex-shrink: 0;
  overflow: hidden;
`;

const AvatarImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
`;

const ProfileInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const Nickname = styled.p`
  font-size: ${({ theme }) => theme.fontSize.base};
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textDark};
  margin: 0 0 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Provider = styled.p`
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ theme }) => theme.colors.gray500};
  margin: 0;
`;

const EditButton = styled.button`
  background: none;
  border: none;
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.primary};
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;

  &:hover {
    opacity: 0.75;
  }
`;

const SectionLabel = styled.p`
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ theme }) => theme.colors.gray400};
  padding: 16px 16px 4px;
  margin: 0;
`;

const MenuList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  border-top: 1px solid ${({ theme }) => theme.colors.gray100};
`;

const MenuItem = styled.li<{ $danger?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.gray100};
  cursor: pointer;
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ $danger, theme }) =>
    $danger ? theme.colors.dangerText : theme.colors.textDark};

  &:hover {
    background: ${({ theme }) => theme.colors.gray50};
  }
`;

const MenuRight = styled.span`
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.gray400};
`;

const LangOptions = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  border-bottom: 1px solid ${({ theme }) => theme.colors.gray100};
  background: ${({ theme }) => theme.colors.gray50};
`;

const LangOption = styled.li<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px 12px 32px;
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ $active, theme }) =>
    $active ? theme.colors.primary : theme.colors.textDark};
  font-weight: ${({ $active }) => ($active ? 600 : 400)};
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.colors.gray100};
  }
`;

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

const APP_VERSION = "1.0.0";

// ── Component ─────────────────────────────────────────────────────────────────

const MypagePanel = () => {
  const t = useTranslations("mypage");
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
    if (!confirm(t("logoutConfirm"))) return;
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  const handleWithdraw = async () => {
    if (!confirm(t("withdrawConfirm"))) return;
    const res = await fetch("/api/user/withdraw", { method: "DELETE" });
    if (!res.ok) return;
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  const LANGUAGES = [
    { code: "ko", label: "한국어" },
    { code: "en", label: "English" },
    { code: "ja", label: "日本語" },
    { code: "zh", label: "中文" },
  ] as const;

  const handleLanguageSelect = (code: string) => {
    const pathname = window.location.pathname.replace(/^\/[a-z]{2}/, "") || "/";
    router.push(pathname, { locale: code });
    setIsLangOpen(false);
  };

  const currentLang = LANGUAGES.find((l) => l.code === locale)?.label ?? locale;

  if (isLoading) return null;

  if (!user) {
    return (
      <Wrapper>
        {isLoginPopupOpen && (
          <LoginPopup
            onClose={() => router.back()}
            returnUrl={
              typeof window !== "undefined" ? window.location.pathname : "/"
            }
            title={t("loginRequired")}
          />
        )}
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      {/* 프로필 */}
      <ProfileSection>
        <Avatar>
          {(profileAvatarUrl ?? user.user_metadata?.avatar_url) && (
            <AvatarImg
              src={profileAvatarUrl ?? user.user_metadata.avatar_url}
              alt="avatar"
            />
          )}
        </Avatar>
        <ProfileInfo>
          <Nickname>{nickname ?? getDisplayName(user)}</Nickname>
          <Provider>
            {t("connectedWith", { provider: getProviderLabel(user) })}
          </Provider>
        </ProfileInfo>
        <EditButton onClick={() => router.push("/mypage/edit")}>
          {t("editProfile")}
        </EditButton>
      </ProfileSection>

      {/* 내 활동 */}
      <SectionLabel>{t("activitySection")}</SectionLabel>
      <MenuList>
        <MenuItem onClick={() => router.push("/wishlist")}>
          {t("wishlistMenu")}
          <MenuRight>›</MenuRight>
        </MenuItem>
        <MenuItem onClick={() => router.push("/mypage/reports")}>
          {t("reportsMenu")}
          <MenuRight>›</MenuRight>
        </MenuItem>
      </MenuList>

      {/* 앱 설정 */}
      <SectionLabel>{t("settingsSection")}</SectionLabel>
      <MenuList>
        <MenuItem onClick={() => setIsLangOpen((v) => !v)}>
          {t("languageMenu")}
          <MenuRight>
            {currentLang} {isLangOpen ? "∧" : "∨"}
          </MenuRight>
        </MenuItem>
        {isLangOpen && (
          <LangOptions>
            {LANGUAGES.map((lang) => (
              <LangOption
                key={lang.code}
                $active={lang.code === locale}
                onClick={() => handleLanguageSelect(lang.code)}
              >
                {lang.label}
                {lang.code === locale && <span>✓</span>}
              </LangOption>
            ))}
          </LangOptions>
        )}
      </MenuList>

      {/* 정보 */}
      <SectionLabel>{t("infoSection")}</SectionLabel>
      <MenuList>
        <MenuItem onClick={() => router.push("/terms")}>
          {t("terms")}
          <MenuRight>›</MenuRight>
        </MenuItem>
        <MenuItem onClick={() => router.push("/privacy")}>
          {t("privacy")}
          <MenuRight>›</MenuRight>
        </MenuItem>
        <MenuItem
          onClick={() => {
            const a = document.createElement("a");
            a.href = `mailto:gachamap1120@gmail.com?subject=${encodeURIComponent("[가챠맵] 문의")}`;
            a.click();
          }}
        >
          {t("contact")}
          <MenuRight>›</MenuRight>
        </MenuItem>
        <MenuItem>
          {t("version")}
          <MenuRight>v{APP_VERSION}</MenuRight>
        </MenuItem>
      </MenuList>

      {/* 계정 관리 */}
      <SectionLabel>{t("accountSection")}</SectionLabel>
      <MenuList>
        <MenuItem onClick={handleLogout}>
          {t("logout")}
          <MenuRight>›</MenuRight>
        </MenuItem>
        <MenuItem $danger onClick={handleWithdraw}>
          {t("withdraw")}
        </MenuItem>
      </MenuList>
    </Wrapper>
  );
};

export default MypagePanel;
