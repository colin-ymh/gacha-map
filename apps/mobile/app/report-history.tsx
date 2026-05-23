import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
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

const reportTypeLabels: Record<ApiReportType, string> = {
  new_shop: "신규 등록",
  fix_info: "정보 수정",
  closed: "폐업",
  other: "기타",
};

const statusLabels: Record<ApiReportStatus, string> = {
  pending: "검토중",
  reviewed: "검토완료",
  resolved: "반영완료",
};

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

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};

const getReportShopName = (report: ApiReport) => {
  if (report.shop_name) return report.shop_name;
  const shopNameLine = report.content
    .split("\n")
    .find((line) => line.startsWith("샵 이름:"));
  return shopNameLine?.replace("샵 이름:", "").trim() || "샵 정보 없음";
};

const ReportHistoryScreen = () => {
  const router = useRouter();
  const [reports, setReports] = useState<ApiReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadReports = useCallback(async () => {
    if (!API_BASE) {
      Alert.alert("오류", "서버 주소가 설정되지 않았습니다.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const headers = await getAuthHeaders();
      if (!headers.Authorization) {
        Alert.alert("오류", "로그인이 필요합니다.");
        router.back();
        return;
      }

      const res = await fetch(`${API_BASE}/api/reports`, { headers });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (body as { error?: string }).error ?? "제보 내역 조회 실패",
        );
      }

      setReports((body as { reports?: ApiReport[] }).reports ?? []);
    } catch (err) {
      Alert.alert(
        "오류",
        err instanceof Error
          ? err.message
          : "제보 내역을 불러오는 중 오류가 발생했습니다.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [router]);

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
          className="text-center flex-1 text-base font-semibold"
          style={{ color: TEXT_DARK }}
        >
          제보 내역
        </Text>
        <TouchableOpacity onPress={loadReports} hitSlop={8}>
          <Ionicons name="refresh" size={20} color={PRIMARY} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={PRIMARY} />
        </View>
      ) : reports.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-sm" style={{ color: TEXT_GRAY }}>
            제보 내역이 없어요
          </Text>
        </View>
      ) : (
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
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
                      {formatDate(report.created_at)}
                    </Text>
                  </View>

                  <Text
                    className="text-sm font-semibold mt-1"
                    style={{ color: TEXT_DARK }}
                  >
                    {getReportShopName(report)}
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
