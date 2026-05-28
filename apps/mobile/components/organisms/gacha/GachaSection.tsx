import { useState, useCallback } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import type { ShopGachaProduct } from "@gacha-map/shared";
import GachaSectionView from "./GachaSection.view";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

interface GachaSectionProps {
  shopId: string;
  isLoggedIn: boolean;
  onLoginRequired: () => void;
}

const GachaSection = ({
  shopId,
  isLoggedIn,
  onLoginRequired,
}: GachaSectionProps) => {
  const router = useRouter();
  const [products, setProducts] = useState<ShopGachaProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/shops/${shopId}/gacha-products`);
      const data = await res.json();
      setProducts(data.products ?? []);
    } finally {
      setIsLoading(false);
    }
  }, [shopId]);

  useFocusEffect(
    useCallback(() => {
      fetchProducts();
    }, [fetchProducts]),
  );

  const handleReportPress = useCallback(() => {
    if (!isLoggedIn) {
      onLoginRequired();
      return;
    }
    router.push(`/gacha-report?shopId=${shopId}` as never);
  }, [isLoggedIn, onLoginRequired, router, shopId]);

  const handleDelete = useCallback(
    async (recordId: string) => {
      try {
        const { getAuthHeaders } = await import("@/lib/supabase");
        const headers = await getAuthHeaders();
        const res = await fetch(
          `${API_BASE}/api/shops/${shopId}/gacha-products/${recordId}`,
          { method: "DELETE", headers },
        );
        if (res.ok || res.status === 204) {
          setProducts((prev) => prev.filter((p) => p.id !== recordId));
        }
      } catch {
        // silent failure
      }
    },
    [shopId],
  );

  return (
    <GachaSectionView
      products={products}
      isLoading={isLoading}
      isLoggedIn={isLoggedIn}
      onReportPress={handleReportPress}
      onDelete={handleDelete}
    />
  );
};

export default GachaSection;
