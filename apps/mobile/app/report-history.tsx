import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { getAuthHeaders } from "@/lib/supabase";
import {
  PRIMARY,
  PRIMARY_BG,
  TEXT_DARK,
  TEXT_GRAY,
  TEXT_PLACEHOLDER,
  GRAY_200,
  GRAY_100,
  SUCCESS_TEXT,
  SUCCESS_BG,
  WARNING_TEXT,
  WARNING_BG,
  STATUS_DEFAULT_BG,
} from "@/constants/colors";

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
    <SafeAreaView edges={["top"]} className="flex-1 bg-white">
      <View
        className="flex-row items-center px-4"
        style={{
          height: 58,
          paddingBottom: 6,
          borderBottomWidth: 1,
          borderBottomColor: GRAY_200,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={{ fontSize: 24, color: TEXT_DARK }}>‹</Text>
        </TouchableOpacity>
        <Text
          style={{
            flex: 1,
            textAlign: "center",
            fontSize: 17,
            fontWeight: "700",
            color: TEXT_DARK,
          }}
        >
          {t("reportHistory.title")}
        </Text>
        <View style={{ width: 20 }} />
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={PRIMARY} />
        </View>
      ) : reports.length === 0 ? (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
          }}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={loadReports}
              tintColor={PRIMARY}
            />
          }
        >
          <Text className="text-sm" style={{ color: TEXT_GRAY }}>
            {t("reportHistory.empty")}
          </Text>
        </ScrollView>
      ) : (
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={loadReports}
              tintColor={PRIMARY}
            />
          }
        >
          {reports.map((report, index) => {
            const statusColors = getStatusBadgeColors(report.status);
            const isLast = index === reports.length - 1;

            return (
              <View key={report.id}>
                <TouchableOpacity
                  className="px-4 py-3.5 active:bg-gray-50"
                  activeOpacity={0.6}
                >
                  <View className="flex-row items-center gap-1.5 mb-1">
                    <View
                      className="px-2 h-5 rounded-full items-center justify-center"
                      style={{ backgroundColor: PRIMARY_BG }}
                    >
                      <Text
                        className="text-[11px] font-medium"
                        style={{ color: PRIMARY }}
                      >
                        {reportTypeLabels[report.report_type]}
                      </Text>
                    </View>

                    <View
                      className="px-2 h-5 rounded-full items-center justify-center"
                      style={{ backgroundColor: statusColors.bg }}
                    >
                      <Text
                        className="text-[11px] font-medium"
                        style={{ color: statusColors.text }}
                      >
                        {statusLabels[report.status]}
                      </Text>
                    </View>

                    <Text
                      className="text-[11px] ml-auto"
                      style={{ color: TEXT_PLACEHOLDER }}
                    >
                      {formatDate(report.created_at, i18n.language)}
                    </Text>
                  </View>

                  <Text
                    className="text-sm font-semibold mt-1"
                    style={{ color: TEXT_DARK }}
                  >
                    {getReportShopName(report, t)}
                  </Text>

                  <Text
                    className="text-xs mt-0.5"
                    style={{ color: TEXT_GRAY }}
                    numberOfLines={2}
                  >
                    {report.content}
                  </Text>
                </TouchableOpacity>

                {!isLast && (
                  <View
                    className="mx-4 h-px"
                    style={{ backgroundColor: GRAY_100 }}
                  />
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

export default ReportHistoryScreen;
