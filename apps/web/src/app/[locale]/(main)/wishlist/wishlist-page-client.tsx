"use client";

import { useState } from "react";
import styled from "styled-components";
import { useTranslations } from "next-intl";
import WishlistList from "@/components/organisms/wishlist/wishlist-list";
import ProductWishlistList from "@/components/organisms/product-wishlist/product-wishlist-list";

// ── Styled ────────────────────────────────────────────────────────────────────

const TabBar = styled.div`
  display: flex;
  border-bottom: 1px solid ${({ theme }) => theme.colors.gray200};
  background: ${({ theme }) => theme.colors.white};
`;

const Tab = styled.button<{ $active: boolean }>`
  flex: 1;
  height: 44px;
  background: none;
  border: none;
  border-bottom: 2px solid
    ${({ $active, theme }) => ($active ? theme.colors.primary : "transparent")};
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: ${({ $active }) => ($active ? "700" : "400")};
  color: ${({ $active, theme }) =>
    $active ? theme.colors.primary : theme.colors.gray500};
  cursor: pointer;
  transition:
    color 0.15s,
    border-color 0.15s;
`;

// ── Component ─────────────────────────────────────────────────────────────────

export default function WishlistPageClient() {
  const t = useTranslations("wishlist");
  const [activeTab, setActiveTab] = useState<"shop" | "product">("shop");

  return (
    <>
      <TabBar>
        <Tab
          $active={activeTab === "shop"}
          onClick={() => setActiveTab("shop")}
        >
          {t("shopTab")}
        </Tab>
        <Tab
          $active={activeTab === "product"}
          onClick={() => setActiveTab("product")}
        >
          {t("productTab")}
        </Tab>
      </TabBar>

      {activeTab === "shop" ? <WishlistList /> : <ProductWishlistList />}
    </>
  );
}
