"use client";

import { useRouter } from "@/i18n/navigation";
import SearchTabs from "@/components/molecules/search/search-tabs";

interface SearchPageClientProps {
  activeType: "shop" | "gacha";
  query?: string;
}

export default function SearchPageClient({
  activeType,
  query,
}: SearchPageClientProps) {
  const router = useRouter();

  const handleTabChange = (tab: "shop" | "gacha") => {
    const params = new URLSearchParams();
    params.set("type", tab);
    if (query) {
      params.set("q", query);
    }
    router.push(`/search?${params.toString()}`);
  };

  return <SearchTabs activeTab={activeType} onTabChange={handleTabChange} />;
}
