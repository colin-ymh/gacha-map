import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

interface Report {
  id: string;
  type: "신규 등록" | "폐업" | "이전";
  status: "검토중" | "반영완료" | "반려";
  shopName: string;
  content: string;
  date: string;
}

const DUMMY_REPORTS: Report[] = [
  {
    id: "1",
    type: "신규 등록",
    status: "검토중",
    shopName: "아키하바라 가챠",
    content:
      "홍대 2번 출구 근처에 새로운 가챠샵이 생겼어요. 피규어 종류가 많아요.",
    date: "2025.05.01",
  },
  {
    id: "2",
    type: "폐업",
    status: "반영완료",
    shopName: "도쿄 캡슐토이",
    content: "강남 코엑스몰 내에 있던 샵이 폐업했습니다.",
    date: "2025.04.15",
  },
  {
    id: "3",
    type: "이전",
    status: "반려",
    shopName: "미나토 가챠월드",
    content: "원래 위치에서 50m 이전했습니다.",
    date: "2025.03.22",
  },
];

const getStatusBadgeColors = (status: string) => {
  switch (status) {
    case "검토중":
      return { bg: "#fef9c3", text: "#ca8a04" };
    case "반영완료":
      return { bg: "#dcfce7", text: "#16a34a" };
    case "반려":
      return { bg: "#fee2e2", text: "#dc2626" };
    default:
      return { bg: "#f3f4f6", text: "#888888" };
  }
};

const ReportHistoryScreen = () => {
  const router = useRouter();

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white">
      {/* Header */}
      <View className="h-13 border-b border-[#e5e7eb] flex-row items-center px-4">
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-xl text-[#1a1a1a]">‹</Text>
        </TouchableOpacity>
        <Text className="text-center flex-1 text-base font-semibold text-[#1a1a1a]">
          제보 내역
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Content */}
      {DUMMY_REPORTS.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-sm text-[#888888]">제보 내역이 없어요</Text>
        </View>
      ) : (
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {DUMMY_REPORTS.map((report, index) => {
            const statusColors = getStatusBadgeColors(report.status);
            const isLast = index === DUMMY_REPORTS.length - 1;

            return (
              <View key={report.id}>
                {/* Report Card */}
                <TouchableOpacity
                  className="px-4 py-3.5 active:bg-gray-50"
                  activeOpacity={0.6}
                >
                  {/* Top Row: Badges and Date */}
                  <View className="flex-row items-center gap-1.5 mb-1">
                    {/* Type Badge */}
                    <View className="px-2 h-5 rounded-full bg-[#fde8ea] items-center justify-center">
                      <Text className="text-[11px] font-medium text-[#e63946]">
                        {report.type}
                      </Text>
                    </View>

                    {/* Status Badge */}
                    <View
                      className="px-2 h-5 rounded-full items-center justify-center"
                      style={{ backgroundColor: statusColors.bg }}
                    >
                      <Text
                        className="text-[11px] font-medium"
                        style={{ color: statusColors.text }}
                      >
                        {report.status}
                      </Text>
                    </View>

                    {/* Date */}
                    <Text className="text-[11px] text-[#aaaaaa] ml-auto">
                      {report.date}
                    </Text>
                  </View>

                  {/* Shop Name */}
                  <Text className="text-sm font-semibold text-[#1a1a1a] mt-1">
                    {report.shopName}
                  </Text>

                  {/* Content Preview */}
                  <Text
                    className="text-xs text-[#888888] mt-0.5"
                    numberOfLines={2}
                  >
                    {report.content}
                  </Text>
                </TouchableOpacity>

                {/* Divider */}
                {!isLast && <View className="mx-4 h-px bg-[#f3f4f6]" />}
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

export default ReportHistoryScreen;
