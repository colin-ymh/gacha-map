import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import PageShell from "@/components/templates/common/page-shell";
import SearchBar from "@/components/molecules/search/search-bar";
import ShopList from "@/components/organisms/common/shop-list";
import Tag from "@/components/atoms/common/tag";
import type { Shop } from "@/types";
import { TagFilter, Results } from "./styles";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; tag?: string }>;
}

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { locale } = await params;
  const { q, tag } = await searchParams;
  const t = await getTranslations({ locale, namespace: "search" });
  const query = q || tag || "";
  return {
    title: query ? `${query} - ${t("title")}` : t("title"),
  };
}

export default async function SearchPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { q, tag } = await searchParams;
  const t = await getTranslations({ locale, namespace: "search" });

  const supabase = await createClient();

  let query = supabase.from("shops").select("*").eq("status", "active");
  if (q) query = query.or(`name.ilike.%${q}%,address.ilike.%${q}%`);
  if (tag) query = query.contains("tags", [tag]);

  const { data: shops } = await query.returns<Shop[]>();

  return (
    <PageShell>
      <SearchBar defaultValue={q} />
      {tag && (
        <TagFilter>
          {t("tagFilter")}: <Tag label={tag} />
        </TagFilter>
      )}
      <Results>
        <ShopList shops={shops ?? []} emptyMessage={t("empty")} />
      </Results>
    </PageShell>
  );
}
