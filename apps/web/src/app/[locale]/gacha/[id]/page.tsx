import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import NextLink from "next/link";
import { createClient } from "@/lib/supabase/server";
import PageShell from "@/components/templates/common/page-shell";
import GachaWishButton from "@/components/atoms/gacha-wish-button";
import type { GachaProduct, GachaShopEntry } from "@/types";
import {
  BackLink,
  ProductSection,
  ProductImageWrapper,
  ProductImage,
  ProductImagePlaceholder,
  ProductInfo,
  ProductName,
  ProductMeta,
  ProductPrice,
  ShopsSection,
  ShopsTitle,
  ShopsList,
  ShopCard,
  ShopImageWrapper,
  ShopImage,
  ShopImagePlaceholder,
  ShopInfo,
  ShopName,
  ShopAddress,
  ShopPrice,
  ShopPriceUnknown,
  EmptyShops,
} from "./styles";

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: "gacha" });
  const supabase = await createClient();
  const { data } = await supabase
    .from("gacha_products")
    .select("name, name_ko")
    .eq("id", id)
    .single();
  const name = data?.name_ko ?? data?.name ?? t("sectionTitle");
  return { title: name };
}

export default async function GachaDetailPage({ params }: Props) {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: "gacha" });
  const supabase = await createClient();

  const { data: product } = await supabase
    .from("gacha_products")
    .select("id, name, name_ko, manufacturer, price_jpy, official_image_url")
    .eq("id", id)
    .eq("status", "active")
    .single<GachaProduct>();

  if (!product) notFound();

  const { data: shopRows } = await supabase
    .from("shop_gacha_products")
    .select(
      "shop_id, price_krw, availability_status, shops!inner(id, name, address, lat, lng, status)",
    )
    .eq("gacha_product_id", id)
    .in("availability_status", ["available", "seen"])
    .order("price_krw", { ascending: true, nullsFirst: false })
    .limit(20);

  const shops: GachaShopEntry[] = (shopRows ?? []).map((row) => {
    const shop = row.shops as unknown as {
      name: string;
      address: string | null;
      lat: number | null;
      lng: number | null;
    } | null;
    return {
      shop_id: row.shop_id,
      shop_name: shop?.name ?? "",
      address: shop?.address ?? null,
      image_url: null,
      price_krw: row.price_krw,
      availability_status:
        row.availability_status as import("@gacha-map/shared").ShopGachaProductAvailability,
      lat: shop?.lat ?? null,
      lng: shop?.lng ?? null,
    };
  });

  const displayName = product.name_ko ?? product.name;

  return (
    <PageShell>
      <BackLink href="/search?type=gacha">{t("backToList")}</BackLink>

      <ProductSection>
        <ProductImageWrapper>
          {product.official_image_url ? (
            <ProductImage src={product.official_image_url} alt={displayName} />
          ) : (
            <ProductImagePlaceholder>🎰</ProductImagePlaceholder>
          )}
        </ProductImageWrapper>
        <ProductInfo>
          <ProductName>{displayName}</ProductName>
          <ProductMeta>{product.manufacturer}</ProductMeta>
          {product.price_jpy && (
            <ProductPrice>
              {t("officialPrice")} ¥{product.price_jpy.toLocaleString()}
            </ProductPrice>
          )}
          <GachaWishButton productId={id} productName={displayName} />
        </ProductInfo>
      </ProductSection>

      <ShopsSection>
        <ShopsTitle>{t("shopsTitle", { count: shops.length })}</ShopsTitle>
        {shops.length === 0 ? (
          <EmptyShops>{t("noAvailableShops")}</EmptyShops>
        ) : (
          <ShopsList>
            {shops.map((shop) => (
              <NextLink key={shop.shop_id} href={`/shop/${shop.shop_id}`}>
                <ShopCard>
                  <ShopImageWrapper>
                    {shop.image_url ? (
                      <ShopImage src={shop.image_url} alt={shop.shop_name} />
                    ) : (
                      <ShopImagePlaceholder />
                    )}
                  </ShopImageWrapper>
                  <ShopInfo>
                    <ShopName>{shop.shop_name}</ShopName>
                    {shop.address && <ShopAddress>{shop.address}</ShopAddress>}
                  </ShopInfo>
                  {shop.price_krw != null ? (
                    <ShopPrice>₩{shop.price_krw.toLocaleString()}</ShopPrice>
                  ) : (
                    <ShopPriceUnknown>{t("noPrice")}</ShopPriceUnknown>
                  )}
                </ShopCard>
              </NextLink>
            ))}
          </ShopsList>
        )}
      </ShopsSection>
    </PageShell>
  );
}
