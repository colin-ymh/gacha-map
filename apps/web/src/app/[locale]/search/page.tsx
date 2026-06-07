import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { searchGachaProducts } from "@/lib/queries/gacha-products";
import PageShell from "@/components/templates/common/page-shell";
import SearchBar from "@/components/molecules/search/search-bar";
import ShopList from "@/components/organisms/common/shop-list";
import GachaProductList from "@/components/organisms/search/gacha-product-list";
import SearchPageClient from "./search-page-client";
import type { Shop, GachaProductWithShops } from "@/types";
import { Results } from "./styles";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; type?: string }>;
}

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { locale } = await params;
  const { q } = await searchParams;
  const t = await getTranslations({ locale, namespace: "search" });
  return {
    title: q ? `${q} - ${t("title")}` : t("title"),
  };
}

export default async function SearchPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { q, type = "shop" } = await searchParams;
  const t = await getTranslations({ locale, namespace: "search" });
  const tGacha = await getTranslations({ locale, namespace: "gacha" });

  const supabase = await createClient();

  let shops: Shop[] = [];
  let products: GachaProductWithShops[] = [];

  if (type === "shop" || !type) {
    let shopQuery = supabase.from("shops").select("*").eq("status", "active");
    if (q) shopQuery = shopQuery.or(`name.ilike.%${q}%,address.ilike.%${q}%`);

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
