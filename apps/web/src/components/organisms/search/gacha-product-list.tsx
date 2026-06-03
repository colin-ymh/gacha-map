"use client";

import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import GachaProductCardView from "@/components/molecules/search/gacha-product-card.view";
import GachaProductListView from "./gacha-product-list.view";
import type { GachaProductWithShops } from "@/types";

interface GachaProductListProps {
  products: GachaProductWithShops[];
  emptyMessage: string;
}

export default function GachaProductList({
  products,
  emptyMessage,
}: GachaProductListProps) {
  const router = useRouter();
  const t = useTranslations("gacha");

  const handleCardClick = (productId: string) => {
    router.push(`/gacha/${productId}`);
  };

  const formatAvailableShops = (count: number): string => {
    return t("availableShops", { count });
  };

  const formatMinPrice = (price: number): string => {
    return t("minPrice", { price: price.toLocaleString() });
  };

  return (
    <GachaProductListView
      isEmpty={products.length === 0}
      emptyMessage={emptyMessage}
    >
      {products.map((product) => {
        const displayName = product.name_ko || product.name || "Unknown";
        const availableShopsLabel = formatAvailableShops(
          product.available_shop_count,
        );
        const minPriceLabel = product.min_price_krw
          ? formatMinPrice(product.min_price_krw)
          : t("noPrice");

        return (
          <GachaProductCardView
            key={product.id}
            name={displayName}
            manufacturer={product.manufacturer}
            priceJpy={product.price_jpy}
            imageUrl={product.official_image_url}
            minPriceKrw={product.min_price_krw}
            availableShopsLabel={availableShopsLabel}
            minPriceLabel={minPriceLabel}
            noPriceLabel={t("noPrice")}
            onClick={() => handleCardClick(product.id)}
          />
        );
      })}
    </GachaProductListView>
  );
}
