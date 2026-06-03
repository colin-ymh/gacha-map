"use client";

import { useTranslations } from "next-intl";
import SearchTabsView from "./search-tabs.view";

interface SearchTabsProps {
  activeTab: "shop" | "gacha";
  onTabChange: (tab: "shop" | "gacha") => void;
}

export default function SearchTabs({
  activeTab,
  onTabChange,
}: SearchTabsProps) {
  const t = useTranslations("search.tabs");

  const tabs = [
    { key: "shop" as const, label: t("shop") },
    { key: "gacha" as const, label: t("gacha") },
  ];

  return (
    <SearchTabsView
      activeTab={activeTab}
      tabs={tabs}
      onTabChange={onTabChange}
    />
  );
}
