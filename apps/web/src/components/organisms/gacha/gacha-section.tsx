"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import styled from "styled-components";
import { useTranslations } from "next-intl";
import { useAppSelector } from "@/store/hooks";
import type { ShopGachaProduct, QuickReportKind } from "@gacha-map/shared";
import GachaSectionView from "./gacha-section.view";
import GachaReportForm from "./gacha-report-form";
import QuickReportButtons from "@/components/molecules/gacha/QuickReportButtons";
import { TOAST_OVERLAY, WHITE } from "@/styles/color";

const Toast = styled.div`
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  background: ${TOAST_OVERLAY};
  color: ${WHITE};
  padding: 10px 20px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  z-index: 9999;
  pointer-events: none;
`;

const FabBackdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 99;
`;

const FabPopover = styled.div`
  position: fixed;
  bottom: 72px;
  right: 16px;
  width: 280px;
  background: ${({ theme }) => theme.colors.white};
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  z-index: 100;
  overflow: hidden;
`;

const FabButton = styled.button`
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 100;
  background: ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.white};
  border: none;
  border-radius: 999px;
  padding: 12px 20px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);

  &:hover {
    background: ${({ theme }) => theme.colors.primaryHover};
  }
`;

interface GachaSectionProps {
  shopId: string;
  onUserQuickReportChange?: (kind: QuickReportKind | null) => void;
}

const GachaSection = ({
  shopId,
  onUserQuickReportChange,
}: GachaSectionProps) => {
  const tGacha = useTranslations("gacha");
  const [products, setProducts] = useState<ShopGachaProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [userQuickReport, setUserQuickReport] =
    useState<QuickReportKind | null>(null);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [quickReportSubmitting, setQuickReportSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [fabOpen, setFabOpen] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isLoggedIn = useAppSelector((s) => s.auth.isLoggedIn);

  const showToast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMessage(msg);
    toastTimer.current = setTimeout(() => setToastMessage(null), 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch(`/api/shops/${shopId}/gacha-products`);
      const data = await res.json();
      setProducts(data.products ?? []);
      const reportKind = data.user_quick_report ?? null;
      setUserQuickReport(reportKind);
      onUserQuickReportChange?.(reportKind);
    } finally {
      setIsLoading(false);
    }
  }, [shopId, onUserQuickReportChange]);

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
        alert(tGacha("quickReport.loginRequired"));
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
              alert(tGacha("quickReport.loginRequired"));
              return;
            }
            if (res.status === 403) {
              alert(tGacha("quickReport.distanceError"));
              return;
            }
            if (res.status === 409) {
              setUserQuickReport(kind);
              onUserQuickReportChange?.(kind);
              return;
            }
            if (!res.ok) return;

            const data = await res.json();
            setUserQuickReport(kind);
            onUserQuickReportChange?.(kind);
            if (data.new_badge) {
              showToast(
                tGacha("quickReport.badgeToast", { name: data.new_badge.name }),
              );
            } else {
              showToast(tGacha("quickReport.toastSuccess"));
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
    [isLoggedIn, shopId, onUserQuickReportChange, showToast, tGacha],
  );

  const handleReportPress = useCallback(() => {
    if (!isLoggedIn) {
      alert(tGacha("quickReport.loginRequired"));
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
      if (!window.confirm(tGacha("deleteConfirm"))) return;
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

  const handleToggleUnavailable = useCallback(
    async (recordId: string) => {
      if (!isLoggedIn) {
        alert(tGacha("quickReport.loginRequired"));
        return;
      }
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) return;

        const res = await fetch(
          `/api/shops/${shopId}/gacha-products/${recordId}/availability`,
          {
            method: "PATCH",
            headers: { Authorization: `Bearer ${session.access_token}` },
          },
        );
        if (!res.ok) return;
        const data = await res.json();
        setProducts((prev) =>
          prev.map((p) =>
            p.id === recordId
              ? {
                  ...p,
                  availability_status: data.availability_status,
                  unavailable_by_nickname: data.unavailable_by_nickname ?? null,
                }
              : p,
          ),
        );
      } catch {
        // silent failure
      }
    },
    [isLoggedIn, shopId, tGacha],
  );

  const shouldShowFab =
    !isLoading && products.length > 0 && userQuickReport === null;

  return (
    <>
      <GachaSectionView
        products={products}
        isLoading={isLoading}
        isLoggedIn={isLoggedIn ?? false}
        onReportPress={handleReportPress}
        onDelete={handleDelete}
        onToggleUnavailable={handleToggleUnavailable}
        userQuickReport={userQuickReport}
        locationEnabled={locationEnabled}
        quickReportSubmitting={quickReportSubmitting}
        onQuickReport={handleQuickReport}
      />

      {shouldShowFab && (
        <>
          {fabOpen && (
            <>
              <FabBackdrop onClick={() => setFabOpen(false)} />
              <FabPopover>
                <QuickReportButtons
                  locationEnabled={locationEnabled}
                  alreadyReported={false}
                  submitting={quickReportSubmitting}
                  onReport={handleQuickReport}
                />
              </FabPopover>
            </>
          )}
          <FabButton onClick={() => setFabOpen((v) => !v)}>
            {tGacha("quickReport.visitSubtitle")}
          </FabButton>
        </>
      )}

      {isFormOpen && (
        <GachaReportForm
          shopId={shopId}
          onSuccess={handleReported}
          onCancel={() => setIsFormOpen(false)}
        />
      )}

      {toastMessage && <Toast>{toastMessage}</Toast>}
    </>
  );
};

export default GachaSection;
