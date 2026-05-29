"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import styled from "styled-components";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

// ── Styled Components ───────────────────────────────────────────────────────

const Container = styled.div`
  display: flex;
  min-height: 100vh;
  background-color: ${({ theme }) => theme.colors.gray50};

  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

const Sidebar = styled.aside`
  width: ${({ theme }) => theme.layout.adminSidebarWidth};
  background-color: ${({ theme }) => theme.colors.white};
  border-right: 1px solid ${({ theme }) => theme.colors.border};
  padding: 24px 0;
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;

  @media (max-width: 768px) {
    display: none;
  }
`;

const Logo = styled(Link)`
  display: block;
  padding: 0 24px 24px;
  font-size: ${({ theme }) => theme.fontSize.lg};
  font-weight: 700;
  color: ${({ theme }) => theme.colors.primary};
  text-decoration: none;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  margin-bottom: 24px;
`;

const Nav = styled.nav`
  display: flex;
  flex-direction: column;
  gap: 0;
`;

interface NavLinkProps {
  $active?: boolean;
}

const NavLink = styled(Link)<NavLinkProps>`
  display: block;
  padding: 12px 24px;
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme, $active }) =>
    $active ? theme.colors.primary : theme.colors.textGray};
  text-decoration: none;
  font-weight: ${({ $active }) => ($active ? "600" : "400")};
  background-color: ${({ theme, $active }) =>
    $active ? theme.colors.primaryBg : "transparent"};
  transition: all 0.15s;

  &:hover {
    background-color: ${({ theme }) => theme.colors.gray100};
    color: ${({ theme }) => theme.colors.textDark};
  }
`;

const MobileHeader = styled.header`
  display: none;

  @media (max-width: 768px) {
    display: flex;
    align-items: center;
    height: 60px;
    padding: 0 16px;
    background-color: ${({ theme }) => theme.colors.white};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    font-size: ${({ theme }) => theme.fontSize.base};
    font-weight: 700;
    color: ${({ theme }) => theme.colors.primary};
    flex-shrink: 0;
    text-decoration: none;
  }
`;

const MobileBottomNav = styled.nav`
  display: none;

  @media (max-width: 768px) {
    display: flex;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 56px;
    background-color: ${({ theme }) => theme.colors.white};
    border-top: 1px solid ${({ theme }) => theme.colors.border};
    z-index: 100;
  }
`;

const MobileNavItem = styled(Link)<NavLinkProps>`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${({ theme }) => theme.fontSize.xs};
  font-weight: ${({ $active }) => ($active ? "600" : "400")};
  color: ${({ theme, $active }) =>
    $active ? theme.colors.primary : theme.colors.textGray};
  text-decoration: none;
  border-top: 2px solid
    ${({ theme, $active }) => ($active ? theme.colors.primary : "transparent")};
`;

const Content = styled.main`
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow-y: auto;

  @media (max-width: 768px) {
    height: auto;
    overflow-y: visible;
    padding-bottom: 56px;
  }
`;

const PageContent = styled.div`
  flex: 1;
  padding: 24px;

  @media (max-width: 768px) {
    padding: 16px;
  }
`;

// ── Component ───────────────────────────────────────────────────────────────

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 간단한 인증 체크: 세션이 없으면 리다이렉트
    const checkAuth = async () => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/");
        return;
      }

      setIsLoading(false);
    };

    checkAuth();
  }, [router]);

  const pathname = usePathname();
  const isShopsActive = pathname.includes("/admin/shops");
  const isReportsActive = pathname.includes("/admin/reports");
  const isShopApplicationsActive = pathname.includes(
    "/admin/shop-applications",
  );

  if (isLoading) {
    return <div>{t("shops.loading")}</div>;
  }

  return (
    <Container>
      <MobileHeader as={Link} href="/admin">
        {t("nav.dashboard")}
      </MobileHeader>
      <Sidebar>
        <Logo href="/admin">{t("nav.dashboard")}</Logo>
        <Nav>
          <NavLink href="/admin/shops" $active={isShopsActive}>
            {t("nav.shops")}
          </NavLink>
          <NavLink href="/admin/reports" $active={isReportsActive}>
            {t("nav.reports")}
          </NavLink>
          <NavLink
            href="/admin/shop-applications"
            $active={isShopApplicationsActive}
          >
            {t("nav.shopApplications")}
          </NavLink>
        </Nav>
      </Sidebar>
      <Content id="admin-content">
        <PageContent>{children}</PageContent>
      </Content>
      <MobileBottomNav>
        <MobileNavItem href="/admin/shops" $active={isShopsActive}>
          {t("nav.shops")}
        </MobileNavItem>
        <MobileNavItem href="/admin/reports" $active={isReportsActive}>
          {t("nav.reports")}
        </MobileNavItem>
        <MobileNavItem
          href="/admin/shop-applications"
          $active={isShopApplicationsActive}
        >
          {t("nav.shopApplications")}
        </MobileNavItem>
      </MobileBottomNav>
    </Container>
  );
}
