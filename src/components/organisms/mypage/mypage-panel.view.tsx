"use client";

import styled from "styled-components";
import { useTranslations } from "next-intl";
import LoginPopup from "@/components/organisms/auth/login-popup";
import { CheckIcon } from "@/components/atoms/icons";
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

// ── Types ─────────────────────────────────────────────────────────────────────

export const LANGUAGES = [
  { code: "ko", label: "한국어" },
  { code: "en", label: "English" },
  { code: "ja", label: "日本語" },
  { code: "zh", label: "中文" },
] as const;

export const APP_VERSION = "1.0.0";

// ── View ──────────────────────────────────────────────────────────────────────

interface MypagePanelViewProps {
  user: User | null;
  nickname: string | null;
  profileAvatarUrl: string | null;
  displayName: string;
  providerLabel: string;
  locale: string;
  currentLang: string;
  isLangOpen: boolean;
  isLoginPopupOpen: boolean;
  onEditProfile: () => void;
  onWishlist: () => void;
  onReports: () => void;
  onToggleLang: () => void;
  onLanguageSelect: (code: string) => void;
  onTerms: () => void;
  onPrivacy: () => void;
  onLogout: () => void;
  onWithdraw: () => void;
  onLoginPopupClose: () => void;
}

const MypagePanelView = ({
  user,
  nickname,
  profileAvatarUrl,
  displayName,
  providerLabel,
  locale,
  currentLang,
  isLangOpen,
  isLoginPopupOpen,
  onEditProfile,
  onWishlist,
  onReports,
  onToggleLang,
  onLanguageSelect,
  onTerms,
  onPrivacy,
  onLogout,
  onWithdraw,
  onLoginPopupClose,
}: MypagePanelViewProps) => {
  const t = useTranslations("mypage");

  if (!user) {
    return (
      <Wrapper>
        {isLoginPopupOpen && (
          <LoginPopup
            onClose={onLoginPopupClose}
            returnUrl={
              typeof window !== "undefined" ? window.location.pathname : "/"
            }
            title={t("loginRequired")}
          />
        )}
      </Wrapper>
    );
  }

  const avatarSrc = profileAvatarUrl ?? user.user_metadata?.avatar_url;

  return (
    <Wrapper>
      <ProfileSection>
        <Avatar>
          <AvatarImg
            src={avatarSrc ?? "/images/avatar-placeholder.svg"}
            alt="avatar"
          />
        </Avatar>
        <ProfileInfo>
          <Nickname>{nickname ?? displayName}</Nickname>
          <Provider>{t("connectedWith", { provider: providerLabel })}</Provider>
        </ProfileInfo>
        <EditButton onClick={onEditProfile}>{t("editProfile")}</EditButton>
      </ProfileSection>

      <SectionLabel>{t("activitySection")}</SectionLabel>
      <MenuList>
        <MenuItem onClick={onWishlist}>
          {t("wishlistMenu")}
          <MenuRight>›</MenuRight>
        </MenuItem>
        <MenuItem onClick={onReports}>
          {t("reportsMenu")}
          <MenuRight>›</MenuRight>
        </MenuItem>
      </MenuList>

      <SectionLabel>{t("settingsSection")}</SectionLabel>
      <MenuList>
        <MenuItem onClick={onToggleLang}>
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
                onClick={() => onLanguageSelect(lang.code)}
              >
                {lang.label}
                {lang.code === locale && <CheckIcon size={16} />}
              </LangOption>
            ))}
          </LangOptions>
        )}
      </MenuList>

      <SectionLabel>{t("infoSection")}</SectionLabel>
      <MenuList>
        <MenuItem onClick={onTerms}>
          {t("terms")}
          <MenuRight>›</MenuRight>
        </MenuItem>
        <MenuItem onClick={onPrivacy}>
          {t("privacy")}
          <MenuRight>›</MenuRight>
        </MenuItem>
        <MenuItem>
          {t("contact")}
          <MenuRight>gachamap1120@gmail.com</MenuRight>
        </MenuItem>
        <MenuItem>
          {t("version")}
          <MenuRight>v{APP_VERSION}</MenuRight>
        </MenuItem>
      </MenuList>

      <SectionLabel>{t("accountSection")}</SectionLabel>
      <MenuList>
        <MenuItem onClick={onLogout}>
          {t("logout")}
          <MenuRight>›</MenuRight>
        </MenuItem>
        <MenuItem $danger onClick={onWithdraw}>
          {t("withdraw")}
        </MenuItem>
      </MenuList>
    </Wrapper>
  );
};

export default MypagePanelView;
