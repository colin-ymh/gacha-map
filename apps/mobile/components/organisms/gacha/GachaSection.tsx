import { useState, useCallback } from "react";
import { Alert } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import * as Location from "expo-location";
import type { ShopGachaProduct, QuickReportKind } from "@gacha-map/shared";
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
  const [userQuickReport, setUserQuickReport] =
    useState<QuickReportKind | null>(null);
  const [contributionCount, setContributionCount] = useState<number | null>(
    null,
  );
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
      setUserQuickReport(data.user_quick_report ?? null);
      setContributionCount(data.contribution_count ?? null);
    } finally {
      setIsLoading(false);
    }
  }, [shopId, isLoggedIn]);

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
          return;
        }
        if (!res.ok) return;

        const data = await res.json();
        setUserQuickReport(kind);
        if (data.contribution_count != null) {
          setContributionCount(data.contribution_count);
        }
        if (data.new_badge) {
          Alert.alert("", `🏆 '${data.new_badge.name}' 뱃지를 획득했어요!`);
        }
      } catch {
        // silent failure
      } finally {
        setQuickReportSubmitting(false);
      }
    },
    [isLoggedIn, onLoginRequired, shopId],
  );

  return (
    <GachaSectionView
      products={products}
      isLoading={isLoading}
      isLoggedIn={isLoggedIn}
      onReportPress={handleReportPress}
      onDelete={handleDelete}
      userQuickReport={userQuickReport}
      contributionCount={contributionCount}
      locationEnabled={locationEnabled}
      quickReportSubmitting={quickReportSubmitting}
      onQuickReport={handleQuickReport}
    />
  );
};

export default GachaSection;
