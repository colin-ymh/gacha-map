"use client";

import styled from "styled-components";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  SearchIcon,
  HeartOutlineIcon,
  ClipboardIcon,
} from "@/components/atoms/icons";
import GachaPlaceholder from "@/components/atoms/GachaPlaceholder";

// ── Styled ────────────────────────────────────────────────────────────────────

const StyledHeader = styled.header`
  position: sticky;
  top: 0;
  z-index: 50;
  background: ${({ theme }) => theme.colors.white};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  height: ${({ theme }) => theme.layout.headerHeight};
  flex-shrink: 0;
`;

const Inner = styled.div`
  max-width: 100%;
  padding: 0 24px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const Logo = styled(Link)`
  display: flex;
  align-items: center;
  flex-shrink: 0;
`;

const LogoImg = styled.img`
  height: 56px;
  width: auto;
  display: block;
`;

const Nav = styled.nav`
  display: flex;
  align-items: center;
  gap: 24px;
`;

const NavLink = styled(Link)`
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.textGray};
  transition: color 0.15s;

  &:hover {
    color: ${({ theme }) => theme.colors.textDark};
  }
`;

const NavLinkPrimary = styled(Link)`
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.primary};
  font-weight: 600;
  transition: color 0.15s;

  &:hover {
    color: ${({ theme }) => theme.colors.primaryHover};
  }
`;

const MobileNav = styled.nav`
  display: none;
  align-items: center;
  gap: 12px;

  @media (max-width: 768px) {
    display: flex;
  }
`;

const DesktopNav = styled(Nav)`
  @media (max-width: 768px) {
    display: none;
  }
`;

const IconButton = styled(Link)`
  color: ${({ theme }) => theme.colors.textGray};
  display: flex;
  align-items: center;
  line-height: 1;

  &:hover {
    color: ${({ theme }) => theme.colors.textDark};
  }
`;

const NavButton = styled.button`
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.textGray};
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  transition: color 0.15s;

  &:hover {
    color: ${({ theme }) => theme.colors.textDark};
  }
`;

const NavButtonPrimary = styled.button`
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.primary};
  font-weight: 600;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  transition: color 0.15s;

  &:hover {
    color: ${({ theme }) => theme.colors.primaryHover};
  }
`;

const IconButtonAsButton = styled.button`
  color: ${({ theme }) => theme.colors.textGray};
  display: flex;
  align-items: center;
  line-height: 1;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  transition: color 0.15s;

  &:hover {
    color: ${({ theme }) => theme.colors.textDark};
  }
`;

const AvatarButton = styled(Link)`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
`;

const AvatarButtonAsButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
`;

const AvatarImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
`;

const AdminBadge = styled(Link)`
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ theme }) => theme.colors.white};
  background: ${({ theme }) => theme.colors.primary};
  padding: 3px 8px;
  border-radius: ${({ theme }) => theme.borderRadius.full};
  font-weight: 600;
  transition: opacity 0.15s;

  &:hover {
    opacity: 0.85;
  }
`;

// ── View ──────────────────────────────────────────────────────────────────────

interface HeaderViewProps {
  isAdmin: boolean;
  avatarUrl: string | null;
  onWishlistClick?: () => void;
  onMypageClick?: () => void;
  onReportClick?: () => void;
}

const HeaderView = ({
  isAdmin,
  avatarUrl,
  onWishlistClick,
  onMypageClick,
  onReportClick,
}: HeaderViewProps) => {
  const t = useTranslations("header");

  const avatarContent = avatarUrl ? (
    <AvatarImg src={avatarUrl} alt={t("nav.mypage")} />
  ) : (
    <GachaPlaceholder size={28} borderRadius={14} />
  );

  const mypageBtn = onMypageClick ? (
    <AvatarButtonAsButton onClick={onMypageClick} aria-label={t("nav.mypage")}>
      {avatarContent}
    </AvatarButtonAsButton>
  ) : (
    <AvatarButton href="/mypage" aria-label={t("nav.mypage")}>
      {avatarContent}
    </AvatarButton>
  );

  return (
    <StyledHeader>
      <Inner>
        <Logo href="/">
          <LogoImg src="/gacha-map-logo.png" alt={t("logo")} />
        </Logo>
        <DesktopNav>
          {isAdmin && <AdminBadge href="/admin/shops">Admin</AdminBadge>}
          {onWishlistClick ? (
            <NavButton onClick={onWishlistClick}>{t("nav.wishlist")}</NavButton>
          ) : (
            <NavLink href="/wishlist">{t("nav.wishlist")}</NavLink>
          )}
          {onReportClick ? (
            <NavButtonPrimary onClick={onReportClick}>
              {t("nav.report")}
            </NavButtonPrimary>
          ) : (
            <NavLinkPrimary href="/report">{t("nav.report")}</NavLinkPrimary>
          )}
          {mypageBtn}
        </DesktopNav>
        <MobileNav>
          {isAdmin && <AdminBadge href="/admin/shops">Admin</AdminBadge>}
          <IconButton href="/search" aria-label={t("nav.search")}>
            <SearchIcon size={22} />
          </IconButton>
          {onWishlistClick ? (
            <IconButtonAsButton
              onClick={onWishlistClick}
              aria-label={t("nav.wishlist")}
            >
              <HeartOutlineIcon size={22} />
            </IconButtonAsButton>
          ) : (
            <IconButton href="/wishlist" aria-label={t("nav.wishlist")}>
              <HeartOutlineIcon size={22} />
            </IconButton>
          )}
          {onReportClick ? (
            <IconButtonAsButton
              onClick={onReportClick}
              aria-label={t("nav.report")}
            >
              <ClipboardIcon size={22} />
            </IconButtonAsButton>
          ) : (
            <IconButton href="/report" aria-label={t("nav.report")}>
              <ClipboardIcon size={22} />
            </IconButton>
          )}
          {mypageBtn}
        </MobileNav>
      </Inner>
    </StyledHeader>
  );
};

export default HeaderView;
