import { useState, useCallback } from "react";
import { Alert, Modal, View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import * as Location from "expo-location";
import { getCurrentPositionSafe } from "@/lib/location";
import type { ShopGachaProduct, QuickReportKind } from "@gacha-map/shared";
import GachaSectionView from "./GachaSection.view";
import { useWishToast } from "@/components/ui/WishToast";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { addPendingBadge } from "@/store/slices/auth.slice";
import {
  PRIMARY,
  WHITE,
  TEXT_DARK,
  TEXT_GRAY,
  BORDER,
  GRAY_100,
} from "@/constants/colors";

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
  const myNickname = useAppSelector((s) => s.auth.profile?.nickname ?? null);
  const { showToast } = useWishToast();
  const [products, setProducts] = useState<ShopGachaProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userQuickReport, setUserQuickReport] =
    useState<QuickReportKind | null>(null);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [quickReportSubmitting, setQuickReportSubmitting] = useState(false);
  const [viewerImageUrl, setViewerImageUrl] = useState<string | null>(null);
  const [priceEdit, setPriceEdit] = useState<{ recordId: string; value: string } | null>(null);

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

  const handleProductPress = useCallback(
    (productId: string) => {
      router.push(`/gacha/${productId}` as never);
    },
    [router],
  );

  const handleReportPress = useCallback(() => {
    if (!isLoggedIn) {
      onLoginRequired();
      return;
    }
    router.push(`/gacha-report?shopId=${shopId}` as never);
  }, [isLoggedIn, onLoginRequired, router, shopId]);

  const handleToggleUnavailable = useCallback(
    async (recordId: string) => {
      if (!isLoggedIn) {
        onLoginRequired();
        return;
      }
      const prev = products;
      setProducts((current) =>
        current.map((p) =>
          p.id === recordId
            ? {
                ...p,
                availability_status:
                  p.availability_status === "sold_out" ? "seen" : "sold_out",
                unavailable_by_nickname:
                  p.availability_status === "sold_out" ? null : myNickname,
              }
            : p,
        ),
      );
      try {
        const { getAuthHeaders } = await import("@/lib/supabase");
        const headers = await getAuthHeaders();
        const res = await fetch(
          `${API_BASE}/api/shops/${shopId}/gacha-products/${recordId}/availability`,
          { method: "PATCH", headers },
        );
        if (res.status === 401) {
          setProducts(prev);
          onLoginRequired();
          return;
        }
        if (!res.ok) {
          setProducts(prev);
          return;
        }
        const data = await res.json();
        setProducts((current) =>
          current.map((p) =>
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
        setProducts(prev);
      }
    },
    [isLoggedIn, onLoginRequired, shopId, products, myNickname],
  );

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

  const handleEditPricePress = useCallback(
    (recordId: string, currentPrice: number | null) => {
      if (!isLoggedIn) {
        onLoginRequired();
        return;
      }
      setPriceEdit({ recordId, value: currentPrice != null ? String(currentPrice) : "" });
    },
    [isLoggedIn, onLoginRequired],
  );

  const handleEditPriceConfirm = useCallback(async () => {
    if (!priceEdit) return;
    const { recordId, value } = priceEdit;
    const parsed = value.trim() === "" ? null : parseInt(value, 10);
    if (parsed !== null && (isNaN(parsed) || parsed < 0)) {
      setPriceEdit(null);
      return;
    }
    const prev = products;
    setProducts((current) =>
      current.map((p) => (p.id === recordId ? { ...p, price_krw: parsed } : p)),
    );
    setPriceEdit(null);
    try {
      const { getAuthHeaders } = await import("@/lib/supabase");
      const headers = await getAuthHeaders();
      const res = await fetch(
        `${API_BASE}/api/shops/${shopId}/gacha-products/${recordId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify({ price_krw: parsed }),
        },
      );
      if (!res.ok) setProducts(prev);
    } catch {
      setProducts(prev);
    }
  }, [priceEdit, products, shopId]);

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
    <>
      <GachaSectionView
        products={products}
        isLoading={isLoading}
        isLoggedIn={isLoggedIn}
        onReportPress={handleReportPress}
        onDelete={handleDelete}
        onToggleUnavailable={handleToggleUnavailable}
        onEditPrice={handleEditPricePress}
        userQuickReport={userQuickReport}
        locationEnabled={locationEnabled}
        quickReportSubmitting={quickReportSubmitting}
        onQuickReport={handleQuickReport}
        viewerImageUrl={viewerImageUrl}
        onImagePress={setViewerImageUrl}
        onCloseImage={() => setViewerImageUrl(null)}
        onProductPress={handleProductPress}
      />
      <Modal
        visible={priceEdit !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPriceEdit(null)}
      >
        <View style={modalStyles.overlay}>
          <View style={modalStyles.dialog}>
            <Text style={modalStyles.title}>가격 수정</Text>
            <TextInput
              style={modalStyles.input}
              value={priceEdit?.value ?? ""}
              onChangeText={(v) =>
                setPriceEdit((prev) => (prev ? { ...prev, value: v } : prev))
              }
              keyboardType="number-pad"
              placeholder="가격 (원)"
              placeholderTextColor={TEXT_GRAY}
              autoFocus
            />
            <View style={modalStyles.row}>
              <TouchableOpacity
                style={modalStyles.cancelBtn}
                onPress={() => setPriceEdit(null)}
              >
                <Text style={modalStyles.cancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={modalStyles.confirmBtn}
                onPress={handleEditPriceConfirm}
              >
                <Text style={modalStyles.confirmText}>확인</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  dialog: {
    backgroundColor: WHITE,
    borderRadius: 12,
    padding: 20,
    width: "100%",
    gap: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: TEXT_DARK,
  },
  input: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: TEXT_DARK,
    backgroundColor: GRAY_100,
  },
  row: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
  },
  cancelText: {
    fontSize: 14,
    color: TEXT_GRAY,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: PRIMARY,
    alignItems: "center",
  },
  confirmText: {
    fontSize: 14,
    fontWeight: "700",
    color: WHITE,
  },
});

export default GachaSection;
