import { useState, useCallback } from "react";
import { Alert } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import * as Location from "expo-location";
import type { ShopGachaProduct, QuickReportKind } from "@gacha-map/shared";
import GachaSectionView from "./GachaSection.view";
import { useWishToast } from "@/components/ui/WishToast";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

interface GachaSectionProps {
  shopId: string;
  isLoggedIn: boolean;
  onLoginRequired: () => void;
  onUserQuickReportChange?: (kind: QuickReportKind | null) => void;
}

const GachaSection = ({
  shopId,
  isLoggedIn,
  onLoginRequired,
  onUserQuickReportChange,
}: GachaSectionProps) => {
  const router = useRouter();
  const { t } = useTranslation();
  const { showToast } = useWishToast();
  const [products, setProducts] = useState<ShopGachaProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userQuickReport, setUserQuickReport] =
    useState<QuickReportKind | null>(null);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [quickReportSubmitting, setQuickReportSubmitting] = useState(false);

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      let headers: Record<string, string> = {};
      if (isLoggedIn) {
        const { getAuthHeaders } = await import("@/lib/supabase");
        headers = await getAuthHeaders();
      }
      const res = await fetch(
        `${API_BASE}/api/shops/${shopId}/gacha-products`,
        {
          headers,
        },
      );
      const data = await res.json();
      setProducts(data.products ?? []);
      const reportKind = data.user_quick_report ?? null;
      setUserQuickReport(reportKind);
      onUserQuickReportChange?.(reportKind);
    } finally {
      setIsLoading(false);
    }
  }, [shopId, isLoggedIn, onUserQuickReportChange]);

  useFocusEffect(
    useCallback(() => {
      fetchProducts();
      (async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        setLocationEnabled(status === "granted");
      })();
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
    (recordId: string) => {
      Alert.alert("", t("gacha.deleteConfirm"), [
        { text: t("review.formCancel"), style: "cancel" },
        {
          text: t("gacha.deleteBtn"),
          style: "destructive",
          onPress: async () => {
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
        },
      ]);
    },
    [shopId, t],
  );

  const handleQuickReport = useCallback(
    async (kind: QuickReportKind) => {
      if (!isLoggedIn) {
        onLoginRequired();
        return;
      }
      setQuickReportSubmitting(true);
      try {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const { getAuthHeaders } = await import("@/lib/supabase");
        const headers = await getAuthHeaders();
        const res = await fetch(
          `${API_BASE}/api/shops/${shopId}/quick-report`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", ...headers },
            body: JSON.stringify({
              kind,
              user_lat: location.coords.latitude,
              user_lng: location.coords.longitude,
            }),
          },
        );

        if (res.status === 401) {
          onLoginRequired();
          return;
        }
        if (res.status === 403) {
          Alert.alert("", "샵에서 500m 이내에서만 제보할 수 있어요.");
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
        showToast("quickReport");
        if (data.new_badge) {
          setTimeout(() => {
            showToast("badgeToast", { name: data.new_badge.name });
          }, 150);
        }
      } catch {
        // silent failure
      } finally {
        setQuickReportSubmitting(false);
      }
    },
    [isLoggedIn, onLoginRequired, shopId, onUserQuickReportChange, showToast],
  );

  return (
    <GachaSectionView
      products={products}
      isLoading={isLoading}
      isLoggedIn={isLoggedIn}
      onReportPress={handleReportPress}
      onDelete={handleDelete}
      userQuickReport={userQuickReport}
      locationEnabled={locationEnabled}
      quickReportSubmitting={quickReportSubmitting}
      onQuickReport={handleQuickReport}
    />
  );
};

export default GachaSection;
