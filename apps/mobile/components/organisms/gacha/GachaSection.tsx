import { useState, useCallback } from "react";
import { Alert } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import * as Location from "expo-location";
import { getCurrentPositionSafe } from "@/lib/location";
import type { ShopGachaProduct, QuickReportKind } from "@gacha-map/shared";
import GachaSectionView from "./GachaSection.view";
import { useWishToast } from "@/components/ui/WishToast";
import { useAppDispatch } from "@/store/hooks";
import { addPendingBadge } from "@/store/slices/auth.slice";

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
  const dispatch = useAppDispatch();
  const { showToast } = useWishToast();
  const [products, setProducts] = useState<ShopGachaProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userQuickReport, setUserQuickReport] =
    useState<QuickReportKind | null>(null);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [quickReportSubmitting, setQuickReportSubmitting] = useState(false);
  const [viewerImageUrl, setViewerImageUrl] = useState<string | null>(null);

  const fetchProducts = useCallback(
    async (signal?: AbortSignal) => {
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
            signal,
          },
        );
        if (signal?.aborted) return;
        const data = await res.json();
        setProducts(data.products ?? []);
        const reportKind = data.user_quick_report ?? null;
        setUserQuickReport(reportKind);
        onUserQuickReportChange?.(reportKind);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [shopId, isLoggedIn, onUserQuickReportChange],
  );

  useFocusEffect(
    useCallback(() => {
      const controller = new AbortController();
      fetchProducts(controller.signal);
      (async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        setLocationEnabled(status === "granted");
      })();
      return () => controller.abort();
    }, [fetchProducts]),
  );

  const handleProductPress = useCallback((productId: string) => {
    router.push(`/gacha/${productId}` as never);
  }, [router]);

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
        const loc = await getCurrentPositionSafe();
        if (!loc.ok || !loc.coords) {
          Alert.alert(
            "",
            loc.reason === "permission"
              ? "위치 권한을 허용해야 제보할 수 있어요."
              : "현재 위치를 확인할 수 없어요. 잠시 후 다시 시도해 주세요.",
          );
          return;
        }
        const { getAuthHeaders } = await import("@/lib/supabase");
        const headers = await getAuthHeaders();
        const res = await fetch(
          `${API_BASE}/api/shops/${shopId}/quick-report`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", ...headers },
            body: JSON.stringify({
              kind,
              user_lat: loc.coords.latitude,
              user_lng: loc.coords.longitude,
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

        setUserQuickReport(kind);
        onUserQuickReportChange?.(kind);
        showToast("quickReport");
        const data = await res.json();
        if (data.new_badge) {
          dispatch(addPendingBadge(data.new_badge));
        }
      } catch {
        // silent failure
      } finally {
        setQuickReportSubmitting(false);
      }
    },
    [
      isLoggedIn,
      onLoginRequired,
      shopId,
      onUserQuickReportChange,
      showToast,
      dispatch,
    ],
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
      viewerImageUrl={viewerImageUrl}
      onImagePress={setViewerImageUrl}
      onCloseImage={() => setViewerImageUrl(null)}
      onProductPress={handleProductPress}
    />
  );
};

export default GachaSection;
