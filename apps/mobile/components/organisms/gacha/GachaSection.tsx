import { useState, useCallback, useRef, useEffect } from "react";
import {
  Alert,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import * as Location from "expo-location";
import { getCurrentPositionSafe } from "@/lib/location";
import type { ShopGachaProduct, QuickReportKind } from "@gacha-map/shared";
import GachaSectionView from "./GachaSection.view";
import { Ionicons } from "@expo/vector-icons";
import { LiquidGlass, GlassIconPill } from "@/components/ui/LiquidGlass";
import { GlassModal, GlassModalButton } from "@/components/ui/GlassModal";
import { useWishToast } from "@/components/ui/WishToast";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { addPendingBadge, selectIsAdmin } from "@/store/slices/auth.slice";
import {
  PRIMARY,
  TEXT_DARK,
  TEXT_GRAY,
  GRAY_100,
  BORDER,
} from "@/constants/colors";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

const NEARBY_RADIUS_M = 500;

function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface GachaSectionProps {
  shopId: string;
  shopLat: number;
  shopLng: number;
  isLoggedIn: boolean;
  onLoginRequired: () => void;
  onUserQuickReportChange?: (kind: QuickReportKind | null) => void;
  /** 외부에서 증가시키면 다음 포커스 시 강제 재fetch (제보 화면 복귀 후 등) */
  refreshToken?: number;
}

const GachaSection = ({
  shopId,
  shopLat,
  shopLng,
  isLoggedIn,
  onLoginRequired,
  onUserQuickReportChange,
  refreshToken = 0,
}: GachaSectionProps) => {
  const router = useRouter();
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const myNickname = useAppSelector((s) => s.auth.profile?.nickname ?? null);
  const isAdmin = useAppSelector(selectIsAdmin);
  const { showToast } = useWishToast();
  const [products, setProducts] = useState<ShopGachaProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userQuickReport, setUserQuickReport] =
    useState<QuickReportKind | null>(null);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [quickReportSubmitting, setQuickReportSubmitting] = useState(false);
  const [showVisitPopup, setShowVisitPopup] = useState(false);
  const [viewerImageUrl, setViewerImageUrl] = useState<string | null>(null);
  const [priceEdit, setPriceEdit] = useState<{
    recordId: string;
    value: string;
  } | null>(null);
  const hasFetchedRef = useRef(false);
  const isDirtyRef = useRef(false);
  const prevRefreshTokenRef = useRef(refreshToken);

  const fetchProducts = useCallback(
    async (signal?: AbortSignal): Promise<QuickReportKind | null> => {
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
        if (signal?.aborted) return null;
        const data = await res.json();
        setProducts(data.products ?? []);
        const reportKind = (data.user_quick_report ??
          null) as QuickReportKind | null;
        setUserQuickReport(reportKind);
        onUserQuickReportChange?.(reportKind);
        return reportKind;
      } catch (err) {
        if ((err as Error).name === "AbortError") return null;
        return null;
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [shopId, isLoggedIn, onUserQuickReportChange],
  );

  useEffect(() => {
    if (refreshToken !== prevRefreshTokenRef.current) {
      prevRefreshTokenRef.current = refreshToken;
      isDirtyRef.current = true;
    }
  }, [refreshToken]);

  useFocusEffect(
    useCallback(() => {
      if (hasFetchedRef.current && !isDirtyRef.current) return;
      const controller = new AbortController();
      (async () => {
        const reportKind = await fetchProducts(controller.signal);
        if (controller.signal.aborted) return;
        hasFetchedRef.current = true;
        isDirtyRef.current = false;
        if (reportKind !== null) return;

        const { status } = await Location.requestForegroundPermissionsAsync();
        const granted = status === "granted";
        setLocationEnabled(granted);
        if (isAdmin) {
          setShowVisitPopup(true);
        } else if (granted) {
          const pos = await getCurrentPositionSafe();
          if (controller.signal.aborted) return;
          if (pos.ok && pos.coords) {
            const dist = distanceMeters(
              pos.coords.latitude,
              pos.coords.longitude,
              shopLat,
              shopLng,
            );
            if (dist <= NEARBY_RADIUS_M) {
              setShowVisitPopup(true);
            }
          }
        }
      })();
      return () => controller.abort();
    }, [fetchProducts, isAdmin, shopLat, shopLng]),
  );

  const handleProductPress = useCallback(
    (productId: string) => {
      router.push(`/gacha/${productId}` as never);
    },
    [router],
  );

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
      setPriceEdit({
        recordId,
        value: currentPrice != null ? String(currentPrice) : "",
      });
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
        const data = await res.json();
        if (data.new_badge) {
          dispatch(addPendingBadge(data.new_badge));
        }
        if (data.gachaBonusGranted) {
          showToast("bonusGranted");
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
        onDelete={handleDelete}
        onToggleUnavailable={handleToggleUnavailable}
        onEditPrice={handleEditPricePress}
        userQuickReport={userQuickReport}
        viewerImageUrl={viewerImageUrl}
        onImagePress={setViewerImageUrl}
        onCloseImage={() => setViewerImageUrl(null)}
        onProductPress={handleProductPress}
      />

      {/* 근처 방문 인증 팝업 */}
      <GlassModal
        visible={showVisitPopup && userQuickReport === null}
        onRequestClose={() => setShowVisitPopup(false)}
      >
        <View style={{ width: "100%" }}>
          <LiquidGlass
            borderRadius={18}
            style={visitStyles.closeBtn}
            intensity={55}
            tint="systemMaterialLight"
            overlayColor="rgba(0,0,0,0.06)"
          >
            <TouchableOpacity
              onPress={() => setShowVisitPopup(false)}
              style={visitStyles.closeBtnInner}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={18} color={TEXT_DARK} />
            </TouchableOpacity>
          </LiquidGlass>

          <Text style={visitStyles.title}>
            {t("gacha.quickReport.visitTitle")}
          </Text>
          <Text style={visitStyles.subtitle}>
            {t("gacha.quickReport.visitSubtitleNow")}
          </Text>

          <GlassIconPill
            iconOnly
            stretch
            style={visitStyles.actionPill}
            actions={[
              {
                icon: "close-circle-outline",
                label: t("gacha.quickReport.absentNow"),
                onPress: () => {
                  setShowVisitPopup(false);
                  setUserQuickReport("gacha_absent");
                  onUserQuickReportChange?.("gacha_absent");
                  showToast("quickReport");
                  handleQuickReport("gacha_absent");
                },
              },
              {
                icon: "checkmark-circle-outline",
                label: t("gacha.quickReport.presentNow"),
                color: PRIMARY,
                onPress: () => {
                  setShowVisitPopup(false);
                  setUserQuickReport("gacha_present");
                  onUserQuickReportChange?.("gacha_present");
                  showToast("quickReport");
                  handleQuickReport("gacha_present");
                },
              },
            ]}
          />
        </View>
      </GlassModal>

      <GlassModal
        visible={priceEdit !== null}
        onRequestClose={() => setPriceEdit(null)}
      >
        <View style={{ width: "100%", gap: 12 }}>
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
            <GlassModalButton
              label="취소"
              onPress={() => setPriceEdit(null)}
              variant="neutral"
              style={{ width: undefined, flex: 1 }}
            />
            <GlassModalButton
              label="확인"
              onPress={handleEditPriceConfirm}
              style={{ width: undefined, flex: 1 }}
            />
          </View>
        </View>
      </GlassModal>
    </>
  );
};

const modalStyles = StyleSheet.create({
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
});

const visitStyles = StyleSheet.create({
  closeBtn: {
    alignSelf: "flex-start",
    marginBottom: 4,
  },
  closeBtnInner: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: TEXT_DARK,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    color: TEXT_GRAY,
    textAlign: "center",
    marginBottom: 4,
  },
  actionPill: {
    marginTop: 4,
  },
});

export default GachaSection;
