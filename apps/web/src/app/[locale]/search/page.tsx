import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { searchGachaProducts } from "@/lib/queries/gacha-products";
import PageShell from "@/components/templates/common/page-shell";
import SearchBar from "@/components/molecules/search/search-bar";
import ShopList from "@/components/organisms/common/shop-list";
import GachaProductList from "@/components/organisms/search/gacha-product-list";
import SearchPageClient from "./search-page-client";
import Tag from "@/components/atoms/common/tag";
import type { Shop, GachaProductWithShops } from "@/types";
import { TagFilter, Results } from "./styles";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; tag?: string; type?: string }>;
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
  const { q, tag, type = "shop" } = await searchParams;
  const t = await getTranslations({ locale, namespace: "search" });
  const tGacha = await getTranslations({ locale, namespace: "gacha" });

  const supabase = await createClient();

  let shops: Shop[] = [];
  let products: GachaProductWithShops[] = [];

  if (type === "shop" || !type) {
    let shopQuery = supabase.from("shops").select("*").eq("status", "active");
    if (q) shopQuery = shopQuery.or(`name.ilike.%${q}%,address.ilike.%${q}%`);
    if (tag) shopQuery = shopQuery.contains("tags", [tag]);

    const { data: shopsData } = await shopQuery.returns<Shop[]>();
    shops = shopsData ?? [];
  } else if (type === "gacha") {
    if (q) {
      try {
        const result = await searchGachaProducts({
          q,
          limit: 20,
          includeShops: true,
        });
        products = result.products as GachaProductWithShops[];
      } catch {
        products = [];
      }
    }
  }

  return (
    <PageShell>
      <SearchBar defaultValue={q} />
      <SearchPageClient activeType={type as "shop" | "gacha"} query={q} />
      {tag && (
        <TagFilter>
          {t("tagFilter")}: <Tag label={tag} />
        </TagFilter>
      )}
      <Results>
        {type === "gacha" ? (
          <GachaProductList
            products={products}
            emptyMessage={tGacha("emptyResult")}
          />
        ) : (
          <ShopList shops={shops} emptyMessage={t("empty")} />
        )}
      </Results>
    </PageShell>
  );
}
