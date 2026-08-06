"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import styled from "styled-components";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

// ── Styled Components ────────────────────────────────────────────────────────

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
  flex-shrink: 0;
`;

const Logo = styled.div`
  display: block;
  padding: 0 24px 24px;
  font-size: ${({ theme }) => theme.fontSize.lg};
  font-weight: 700;
  color: ${({ theme }) => theme.colors.primary};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  margin-bottom: 24px;
`;

const Nav = styled.nav`
  display: flex;
  flex-direction: column;
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
  height: 100vh;
  overflow-y: auto;
`;

const PageContent = styled.div`
  flex: 1;
  padding: 24px;
`;

// ── Component ────────────────────────────────────────────────────────────────

interface ShopOwnerLayoutProps {
  children: React.ReactNode;
}

export default function ShopOwnerLayout({ children }: ShopOwnerLayoutProps) {
  const t = useTranslations("shopOwner");
  const router = useRouter();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/");
        return;
      }

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (profile?.role !== "shop_owner") {
        router.push("/");
        return;
      }

      setIsLoading(false);
    };

    checkAuth();
  }, [router]);

  const isOverviewActive =
    pathname.endsWith("/shop-owner") || pathname.endsWith("/shop-owner/");
  const isProfileActive = pathname.includes("/shop-owner/profile");
  const isReviewsActive = pathname.includes("/shop-owner/reviews");

  if (isLoading) {
    return <div>{t("overview.loading")}</div>;
  }

  return (
    <Container>
      <Sidebar>
        <Logo>{t("nav.title")}</Logo>
        <Nav>
          <NavLink href="/shop-owner" $active={isOverviewActive}>
            {t("nav.overview")}
          </NavLink>
          <NavLink href="/shop-owner/profile" $active={isProfileActive}>
            {t("nav.profile")}
          </NavLink>
          <NavLink href="/shop-owner/reviews" $active={isReviewsActive}>
            {t("nav.reviews")}
          </NavLink>
        </Nav>
      </Sidebar>
      <Content id="shop-owner-content">
        <PageContent>{children}</PageContent>
      </Content>
    </Container>
  );
}
