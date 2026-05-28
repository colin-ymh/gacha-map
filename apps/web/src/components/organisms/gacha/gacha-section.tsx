"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppSelector } from "@/store/hooks";
import type { ShopGachaProduct } from "@gacha-map/shared";
import GachaSectionView from "./gacha-section.view";
import GachaReportForm from "./gacha-report-form";

interface GachaSectionProps {
  shopId: string;
}

const GachaSection = ({ shopId }: GachaSectionProps) => {
  const [products, setProducts] = useState<ShopGachaProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const isLoggedIn = useAppSelector((s) => s.auth.isLoggedIn);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch(`/api/shops/${shopId}/gacha-products`);
      const data = await res.json();
      setProducts(data.products ?? []);
    } finally {
      setIsLoading(false);
    }
  }, [shopId]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleReportPress = useCallback(() => {
    if (!isLoggedIn) {
      alert("로그인이 필요합니다.");
      return;
    }
    setIsFormOpen(true);
  }, [isLoggedIn]);

  const handleReported = useCallback((product: ShopGachaProduct) => {
    setIsFormOpen(false);
    setProducts((prev) => {
      const exists = prev.find((p) => p.id === product.id);
      if (exists) return prev.map((p) => (p.id === product.id ? product : p));
      return [product, ...prev];
    });
  }, []);

  const handleDelete = useCallback(
    async (recordId: string) => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) return;

        const res = await fetch(
          `/api/shops/${shopId}/gacha-products/${recordId}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${session.access_token}` },
          },
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
    <>
      <GachaSectionView
        products={products}
        isLoading={isLoading}
        isLoggedIn={isLoggedIn ?? false}
        onReportPress={handleReportPress}
        onDelete={handleDelete}
      />

      {isFormOpen && (
        <GachaReportForm
          shopId={shopId}
          onSuccess={handleReported}
          onCancel={() => setIsFormOpen(false)}
        />
      )}
    </>
  );
};

export default GachaSection;
