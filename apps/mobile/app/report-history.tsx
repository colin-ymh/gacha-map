import { useCallback, useEffect, useState } from "react";
import { SkeletonBone } from "@/components/ui/Skeleton";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { getAuthHeaders } from "@/lib/supabase";
import {
  PRIMARY,
  PRIMARY_BG,
  WHITE,
  TEXT_DARK,
  TEXT_GRAY,
  TEXT_PLACEHOLDER,
  GRAY_100,
  GRAY_200,
  SUCCESS_TEXT,
  SUCCESS_BG,
  WARNING_TEXT,
  WARNING_BG,
  STATUS_DEFAULT_BG,
} from "@/constants/colors";
import { GlassBackButton } from "@/components/ui/GlassBackButton";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

type ApiReportType = "new_shop" | "fix_info" | "closed" | "other";
type ApiReportStatus = "pending" | "reviewed" | "resolved";

interface ApiReport {
  id: string;
  report_type: ApiReportType;
  status: ApiReportStatus;
  shop_name: string | null;
  content: string;
  created_at: string;
}

const getStatusBadgeColors = (status: ApiReportStatus) => {
  switch (status) {
    case "pending":
      return { bg: WARNING_BG, text: WARNING_TEXT };
    case "resolved":
      return { bg: SUCCESS_BG, text: SUCCESS_TEXT };
    case "reviewed":
      return { bg: PRIMARY_BG, text: PRIMARY };
    default:
      return { bg: STATUS_DEFAULT_BG, text: TEXT_GRAY };
  }
};

const formatDate = (value: string, locale: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};

const getReportShopName = (report: ApiReport, t: TFunction) => {
  if (report.shop_name) return report.shop_name;
  const shopNameLine = report.content
    .split("\n")
    .find((line) => line.startsWith("샵 이름:"));
  return (
    shopNameLine?.replace("샵 이름:", "").trim() ||
    t("reportHistory.shopInfoMissing")
  );
};

const ReportHistoryScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const [reports, setReports] = useState<ApiReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const reportTypeLabels: Record<ApiReportType, string> = {
    new_shop: t("reportHistory.typeNewShop"),
    fix_info: t("reportHistory.typeFixInfo"),
    closed: t("reportHistory.typeClosed"),
    other: t("reportHistory.typeOther"),
  };

  const statusLabels: Record<ApiReportStatus, string> = {
    pending: t("reportHistory.statusPending"),
    reviewed: t("reportHistory.statusReviewed"),
    resolved: t("reportHistory.statusResolved"),
  };

  const loadReports = useCallback(async () => {
    if (!API_BASE) {
      Alert.alert(
        t("reportHistory.errorTitle"),
        t("reportHistory.serverError"),
      );
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const headers = await getAuthHeaders();
      if (!headers.Authorization) {
        Alert.alert(
          t("reportHistory.errorTitle"),
          t("reportHistory.loginRequired"),
        );
        router.back();
        return;
      }

      const res = await fetch(`${API_BASE}/api/reports`, { headers });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (body as { error?: string }).error ?? t("reportHistory.loadError"),
        );
      }

      setReports((body as { reports?: ApiReport[] }).reports ?? []);
    } catch (err) {
      Alert.alert(
        t("reportHistory.errorTitle"),
        err instanceof Error ? err.message : t("reportHistory.loadError"),
      );
    } finally {
      setIsLoading(false);
    }
  }, [router, t]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  return (
    <View style={{ flex: 1, backgroundColor: GRAY_100 }}>
      {/* 플로팅 뒤로가기 */}
      <View style={{ position: "absolute", left: 16, top: insets.top + 8, zIndex: 10 }}>
        <GlassBackButton onPress={() => router.back()} />
      </View>

      {isLoading ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingTop: insets.top + 60, paddingHorizontal: 16, paddingBottom: insets.bottom + 20, gap: 12 }}
        >
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={{
                backgroundColor: WHITE,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: GRAY_200,
                padding: 16,
                gap: 10,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <SkeletonBone width={56} height={20} borderRadius={10} />
                  <SkeletonBone width={44} height={20} borderRadius={10} />
                </View>
                <SkeletonBone width={64} height={12} borderRadius={4} />
              </View>
              <SkeletonBone width="60%" height={15} borderRadius={5} />
              <SkeletonBone width="80%" height={13} borderRadius={4} />
              <SkeletonBone width="55%" height={13} borderRadius={4} />
            </View>
          ))}
        </ScrollView>
      ) : reports.length === 0 ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flex: 1, alignItems: "center", justifyContent: "center" }}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={loadReports} tintColor={PRIMARY} />}
        >
          <Text style={{ fontSize: 14, color: TEXT_GRAY }}>{t("reportHistory.empty")}</Text>
        </ScrollView>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: insets.top + 60, paddingHorizontal: 16, paddingBottom: insets.bottom + 20, gap: 12 }}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={loadReports} tintColor={PRIMARY} />}
        >
          {reports.map((report) => {
            const statusColors = getStatusBadgeColors(report.status);
            return (
              <TouchableOpacity
                key={report.id}
                activeOpacity={0.7}
                style={{
                  backgroundColor: WHITE,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: GRAY_200,
                  padding: 16,
                  gap: 8,
                }}
              >
                {/* 뱃지 + 날짜 */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <View style={{ paddingHorizontal: 8, height: 22, borderRadius: 11, backgroundColor: PRIMARY_BG, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontSize: 11, fontWeight: "600", color: PRIMARY }}>
                      {reportTypeLabels[report.report_type]}
                    </Text>
                  </View>
                  <View style={{ paddingHorizontal: 8, height: 22, borderRadius: 11, backgroundColor: statusColors.bg, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontSize: 11, fontWeight: "600", color: statusColors.text }}>
                      {statusLabels[report.status]}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11, color: TEXT_PLACEHOLDER, marginLeft: "auto" }}>
                    {formatDate(report.created_at, i18n.language)}
                  </Text>
                </View>

                {/* 샵 이름 */}
                <Text style={{ fontSize: 15, fontWeight: "700", color: TEXT_DARK }}>
                  {getReportShopName(report, t)}
                </Text>

                {/* 내용 */}
                <Text style={{ fontSize: 13, color: TEXT_GRAY, lineHeight: 18 }} numberOfLines={2}>
                  {report.content}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
};

export default ReportHistoryScreen;
