"use client";

import styled from "styled-components";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

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
  font-size: ${({ theme }) => theme.fontSize.lg};
  font-weight: 700;
  color: ${({ theme }) => theme.colors.primary};
  flex-shrink: 0;
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
  font-size: 1.25rem;
  color: ${({ theme }) => theme.colors.textGray};
  display: flex;
  align-items: center;
  line-height: 1;
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

const IconButtonAsButton = styled.button`
  font-size: 1.25rem;
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

interface HeaderProps {
  onWishlistClick?: () => void;
}

const Header = ({ onWishlistClick }: HeaderProps) => {
  const t = useTranslations("header");

  return (
    <StyledHeader>
      <Inner>
        <Logo href="/">{t("logo")}</Logo>
        <DesktopNav>
          {onWishlistClick ? (
            <NavButton onClick={onWishlistClick}>{t("nav.wishlist")}</NavButton>
          ) : (
            <NavLink href="/wishlist">{t("nav.wishlist")}</NavLink>
          )}
          <NavLinkPrimary href="/report">{t("nav.report")}</NavLinkPrimary>
          <IconButton href="/mypage" aria-label={t("nav.mypage")}>
            &#128100;
          </IconButton>
        </DesktopNav>
        <MobileNav>
          <IconButton href="/search" aria-label={t("nav.search")}>
            &#128269;
          </IconButton>
          {onWishlistClick ? (
            <IconButtonAsButton
              onClick={onWishlistClick}
              aria-label={t("nav.wishlist")}
            >
              &#9825;
            </IconButtonAsButton>
          ) : (
            <IconButton href="/wishlist" aria-label={t("nav.wishlist")}>
              &#9825;
            </IconButton>
          )}
          <IconButton href="/report" aria-label={t("nav.report")}>
            &#128203;
          </IconButton>
          <IconButton href="/mypage" aria-label={t("nav.mypage")}>
            &#128100;
          </IconButton>
        </MobileNav>
      </Inner>
    </StyledHeader>
  );
};

export default Header;
