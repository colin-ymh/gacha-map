import {
  View,
  TouchableOpacity,
  Text,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { getAuthHeaders } from "@/lib/supabase";
import { useAppSelector } from "@/store/hooks";
import {
  PRIMARY,
  PRIMARY_BG_SOFT,
  TEXT_DARK,
  TEXT_GRAY,
  BORDER,
  PLACEHOLDER_LIGHT,
  TEXT_PLACEHOLDER,
  GRAY_200,
  WHITE,
} from "@/constants/colors";

type ApiReportType = "new_shop" | "fix_info" | "closed" | "other";

const ALL_TYPES: ApiReportType[] = ["new_shop", "fix_info", "closed", "other"];
const SHOP_TYPES: ApiReportType[] = ["fix_info", "closed", "other"];

const TYPE_LABELS: Record<ApiReportType, string> = {
  new_shop: "새 샵 제보",
  fix_info: "정보 수정 요청",
  closed: "폐업 제보",
  other: "기타",
};

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

export default function ReportScreen() {
  const router = useRouter();
  const { shopId, shopName: rawShopName } = useLocalSearchParams<{
    shopId?: string;
    shopName?: string;
  }>();
  const shopName = rawShopName ? decodeURIComponent(rawShopName) : "";
  const isLoggedIn = useAppSelector((s) => s.auth.isLoggedIn);

  const availableTypes = shopId ? SHOP_TYPES : ALL_TYPES;
  const [reportType, setReportType] = useState<ApiReportType | null>(
    shopId ? "fix_info" : null,
  );
  const [content, setContent] = useState("");
  const [reporterName, setReporterName] = useState("");
  const [contact, setContact] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const contentHint = (() => {
    if (shopId) return null;
    if (reportType === "new_shop") return "샵 이름, 주소, 특징을 포함해 주세요";
    if (reportType === "fix_info" || reportType === "closed")
      return "샵 이름을 포함해 주세요";
    return null;
  })();

  const isSubmitDisabled = !reportType || content.trim().length < 10;

  const handleSubmit = async () => {
    if (isSubmitDisabled) return;
    if (!API_BASE) {
      Alert.alert("오류", "서버 주소가 설정되지 않았습니다.");
      return;
    }

    setIsSubmitting(true);
    try {
      const authHeaders = await getAuthHeaders();
      const body: Record<string, unknown> = {
        report_type: reportType,
        content: content.trim(),
      };
      if (shopId) body.shop_id = shopId;
      if (!isLoggedIn && reporterName.trim())
        body.reporter_name = reporterName.trim();
      if (contact.trim()) body.reporter_contact = contact.trim();

      const res = await fetch(`${API_BASE}/api/reports`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const resBody = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((resBody as { error?: string }).error ?? "제보 실패");
      }

      Alert.alert("제보 완료", "제보가 접수되었습니다. 검토 후 반영됩니다.", [
        { text: "확인", onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert(
        "오류",
        err instanceof Error
          ? err.message
          : "제보 전송에 실패했습니다. 다시 시도해 주세요.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white">
      <View
        className="h-[52px] flex-row items-center border-b border-gray-200"
        style={{ borderColor: GRAY_200 }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          className="px-4 items-center justify-center h-full"
        >
          <Text style={{ fontSize: 24, color: TEXT_DARK }}>‹</Text>
        </TouchableOpacity>
        <Text
          className="flex-1 text-center"
          style={{ fontSize: 16, fontWeight: "700", color: TEXT_DARK }}
        >
          제보하기
        </Text>
        <View className="w-[40px]" />
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-4 py-5">
          {shopId && shopName ? (
            <View
              className="mb-5 px-4 py-3 rounded-xl"
              style={{ backgroundColor: PRIMARY_BG_SOFT }}
            >
              <Text style={{ fontSize: 14, color: PRIMARY, fontWeight: "600" }}>
                [{shopName}]에 대한 제보입니다
              </Text>
            </View>
          ) : null}

          <View className="mb-5">
            <Text
              style={{ fontSize: 14, fontWeight: "600", color: TEXT_DARK }}
              className="mb-2.5"
            >
              제보 유형
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {availableTypes.map((type) => {
                const isActive = reportType === type;
                return (
                  <TouchableOpacity
                    key={type}
                    onPress={() => setReportType(type)}
                    className="h-9 px-4 rounded-full items-center justify-center"
                    style={{
                      borderWidth: isActive ? 1.5 : 1,
                      borderColor: isActive ? PRIMARY : BORDER,
                      backgroundColor: WHITE,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        color: isActive ? PRIMARY : TEXT_GRAY,
                      }}
                    >
                      {TYPE_LABELS[type]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View className="mb-5">
            <Text
              style={{ fontSize: 14, fontWeight: "600", color: TEXT_DARK }}
              className="mb-2.5"
            >
              제보 내용 <Text style={{ color: PRIMARY }}>*</Text>
            </Text>
            <TextInput
              className="w-full h-32 rounded-lg border border-gray-200 px-3.5 pt-3"
              style={{ fontSize: 14, borderColor: BORDER }}
              placeholder={
                contentHint ??
                "제보 내용을 자유롭게 작성해주세요 (최소 10자 이상)"
              }
              placeholderTextColor={PLACEHOLDER_LIGHT}
              multiline
              maxLength={1000}
              textAlignVertical="top"
              value={content}
              onChangeText={setContent}
            />
            <View className="flex-row justify-between items-center mt-1">
              {content.length > 0 && content.length < 10 ? (
                <Text style={{ fontSize: 11, color: PRIMARY }}>
                  최소 10자 이상 입력해주세요
                </Text>
              ) : (
                <View />
              )}
              <Text style={{ fontSize: 11, color: TEXT_GRAY }}>
                {content.length}/1000
              </Text>
            </View>
          </View>

          {!isLoggedIn && (
            <View className="flex-row gap-2 mb-6">
              <TextInput
                className="flex-1 h-11 rounded-lg border border-gray-200 px-3.5"
                style={{ fontSize: 14, borderColor: BORDER }}
                placeholder="이름(선택)"
                placeholderTextColor={PLACEHOLDER_LIGHT}
                value={reporterName}
                onChangeText={setReporterName}
                maxLength={50}
              />
              <TextInput
                className="flex-1 h-11 rounded-lg border border-gray-200 px-3.5"
                style={{ fontSize: 14, borderColor: BORDER }}
                placeholder="연락처(선택)"
                placeholderTextColor={PLACEHOLDER_LIGHT}
                value={contact}
                onChangeText={setContact}
                maxLength={100}
              />
            </View>
          )}

          {isLoggedIn && (
            <View className="mb-6">
              <TextInput
                className="w-full h-11 rounded-lg border border-gray-200 px-3.5"
                style={{ fontSize: 14, borderColor: BORDER }}
                placeholder="연락처(선택)"
                placeholderTextColor={PLACEHOLDER_LIGHT}
                value={contact}
                onChangeText={setContact}
                maxLength={100}
              />
            </View>
          )}

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isSubmitDisabled || isSubmitting}
            className="w-full h-12 rounded-full items-center justify-center"
            style={{
              backgroundColor:
                isSubmitDisabled || isSubmitting ? BORDER : PRIMARY,
            }}
          >
            {isSubmitting ? (
              <ActivityIndicator color={TEXT_PLACEHOLDER} />
            ) : (
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "600",
                  color: isSubmitDisabled ? TEXT_PLACEHOLDER : WHITE,
                }}
              >
                제출하기
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
