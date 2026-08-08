"use client";

import styled from "styled-components";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

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
}

const HeaderView = ({ isAdmin }: HeaderViewProps) => {
  const t = useTranslations("header");

  return (
    <StyledHeader>
      <Inner>
        <Logo href="/">
          <LogoImg src="/gacha-map-logo.png" alt={t("logo")} />
        </Logo>
        {isAdmin && <AdminBadge href="/admin/shops">Admin</AdminBadge>}
      </Inner>
    </StyledHeader>
  );
};

export default HeaderView;
