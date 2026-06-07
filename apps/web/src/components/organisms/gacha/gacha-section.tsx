"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppSelector } from "@/store/hooks";
import type { ShopGachaProduct, QuickReportKind } from "@gacha-map/shared";
import GachaSectionView from "./gacha-section.view";
import GachaReportForm from "./gacha-report-form";

interface GachaSectionProps {
  shopId: string;
}

const GachaSection = ({ shopId }: GachaSectionProps) => {
  const [products, setProducts] = useState<ShopGachaProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [userQuickReport, setUserQuickReport] =
    useState<QuickReportKind | null>(null);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [quickReportSubmitting, setQuickReportSubmitting] = useState(false);

  const isLoggedIn = useAppSelector((s) => s.auth.isLoggedIn);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch(`/api/shops/${shopId}/gacha-products`);
      const data = await res.json();
      setProducts(data.products ?? []);
      setUserQuickReport(data.user_quick_report ?? null);
    } finally {
      setIsLoading(false);
    }
  }, [shopId]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      () => setLocationEnabled(true),
      () => setLocationEnabled(false),
      { timeout: 5000 },
    );
  }, []);

  const handleQuickReport = useCallback(
    async (kind: QuickReportKind) => {
      if (!isLoggedIn) {
        alert("로그인이 필요합니다.");
        return;
      }
      if (!navigator.geolocation) return;

      setQuickReportSubmitting(true);
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const { createClient } = await import("@/lib/supabase/client");
            const supabase = createClient();
            const {
              data: { session },
            } = await supabase.auth.getSession();
            const authHeaders: Record<string, string> = session
              ? { Authorization: `Bearer ${session.access_token}` }
              : {};

            const res = await fetch(`/api/shops/${shopId}/quick-report`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...authHeaders,
              },
              body: JSON.stringify({
                kind,
                user_lat: pos.coords.latitude,
                user_lng: pos.coords.longitude,
              }),
            });

            if (res.status === 401) {
              alert("로그인이 필요합니다.");
              return;
            }
            if (res.status === 403) {
              alert("샵에서 500m 이내에서만 제보할 수 있어요.");
              return;
            }
            if (res.status === 409) {
              setUserQuickReport(kind);
              return;
            }
            if (!res.ok) return;

            const data = await res.json();
            setUserQuickReport(kind);
            if (data.new_badge) {
              alert(`🏆 '${data.new_badge.name}' 뱃지를 획득했어요!`);
            } else {
              alert("감사해요! 🎉");
            }
          } finally {
            setQuickReportSubmitting(false);
          }
        },
        () => {
          setLocationEnabled(false);
          setQuickReportSubmitting(false);
        },
        { timeout: 5000 },
      );
    },
    [isLoggedIn, shopId],
  );

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
        userQuickReport={userQuickReport}
        locationEnabled={locationEnabled}
        quickReportSubmitting={quickReportSubmitting}
        onQuickReport={handleQuickReport}
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
