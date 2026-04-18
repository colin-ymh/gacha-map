"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import styled from "styled-components";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

// ── Styled Components ───────────────────────────────────────────────────────

const Container = styled.div`
  display: flex;
  min-height: 100vh;
  background-color: ${({ theme }) => theme.colors.gray50};
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

const Content = styled.main`
  flex: 1;
  display: flex;
  flex-direction: column;
`;

const PageContent = styled.div`
  flex: 1;
  padding: 24px;
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

  if (isLoading) {
    return <div>{t("shops.loading")}</div>;
  }

  const currentPath =
    typeof window !== "undefined" ? window.location.pathname : "";

  const isShopsActive = currentPath.includes("/admin/shops");
  const isReportsActive = currentPath.includes("/admin/reports");

  return (
    <Container>
      <Sidebar>
        <Logo href="/admin">{t("nav.dashboard")}</Logo>
        <Nav>
          <NavLink href="/admin/shops" $active={isShopsActive}>
            {t("nav.shops")}
          </NavLink>
          <NavLink href="/admin/reports" $active={isReportsActive}>
            {t("nav.reports")}
          </NavLink>
        </Nav>
      </Sidebar>
      <Content>
        <PageContent>{children}</PageContent>
      </Content>
    </Container>
  );
}
