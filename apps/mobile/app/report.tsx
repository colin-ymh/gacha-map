import {
  View,
  TouchableOpacity,
  Text,
  TextInput,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useState } from "react";

type ReportType = "신규 등록" | "폐업" | "이전";

export default function ReportScreen() {
  const router = useRouter();
  const [reportType, setReportType] = useState<ReportType | null>(null);
  const [shopName, setShopName] = useState("");
  const [content, setContent] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [contact, setContact] = useState("");

  const reportTypes: ReportType[] = ["신규 등록", "폐업", "이전"];
  const isSubmitDisabled = !shopName.trim() || !content.trim();

  const handleSubmit = () => {
    if (isSubmitDisabled) return;
    console.log("TODO: Submit report", {
      reportType,
      shopName,
      content,
      authorName,
      contact,
    });
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white">
      {/* Header */}
      <View
        className="h-[52px] flex-row items-center border-b border-gray-200"
        style={{ borderColor: "#e5e7eb" }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          className="px-4 items-center justify-center h-full"
        >
          <Text style={{ fontSize: 24, color: "#1a1a1a" }}>‹</Text>
        </TouchableOpacity>
        <Text
          className="flex-1 text-center"
          style={{ fontSize: 16, fontWeight: "700", color: "#1a1a1a" }}
        >
          제보하기
        </Text>
        <View className="w-[40px]" />
      </View>

      {/* Scrollable Content */}
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-4 py-5">
          {/* Report Type Selection */}
          <View className="mb-5">
            <Text
              style={{ fontSize: 14, fontWeight: "600", color: "#1a1a1a" }}
              className="mb-2.5"
            >
              제보 유형
            </Text>
            <View className="flex-row gap-2">
              {reportTypes.map((type) => {
                const isActive = reportType === type;
                return (
                  <TouchableOpacity
                    key={type}
                    onPress={() => setReportType(type)}
                    className="h-9 px-4 rounded-full items-center justify-center"
                    style={{
                      borderWidth: isActive ? 1.5 : 1,
                      borderColor: isActive ? "#e63946" : "#e5e5e5",
                      backgroundColor: "white",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        color: isActive ? "#e63946" : "#888888",
                      }}
                    >
                      {type}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Shop Name Input */}
          <View className="mb-5">
            <Text
              style={{ fontSize: 14, fontWeight: "600", color: "#1a1a1a" }}
              className="mb-2.5"
            >
              샵 이름
            </Text>
            <TextInput
              className="w-full h-11 rounded-lg border border-gray-200 px-3.5"
              style={{
                fontSize: 14,
                borderColor: "#e5e5e5",
              }}
              placeholder="샵 이름을 입력해주세요"
              placeholderTextColor="#bbbbbb"
              value={shopName}
              onChangeText={setShopName}
            />
          </View>

          {/* Content Input */}
          <View className="mb-5">
            <Text
              style={{ fontSize: 14, fontWeight: "600", color: "#1a1a1a" }}
              className="mb-2.5"
            >
              내용
            </Text>
            <TextInput
              className="w-full h-32 rounded-lg border border-gray-200 px-3.5 pt-3"
              style={{
                fontSize: 14,
                borderColor: "#e5e5e5",
              }}
              placeholder="제보 내용을 자유롭게 작성해주세요"
              placeholderTextColor="#bbbbbb"
              multiline
              maxLength={1000}
              textAlignVertical="top"
              value={content}
              onChangeText={setContent}
            />
            <Text
              style={{ fontSize: 11, color: "#888888" }}
              className="mt-1 text-right"
            >
              {content.length}/1000
            </Text>
          </View>

          {/* Name & Contact Input */}
          <View className="flex-row gap-2 mb-6">
            <TextInput
              className="flex-1 h-11 rounded-lg border border-gray-200 px-3.5"
              style={{
                fontSize: 14,
                borderColor: "#e5e5e5",
              }}
              placeholder="이름(선택)"
              placeholderTextColor="#bbbbbb"
              value={authorName}
              onChangeText={setAuthorName}
            />
            <TextInput
              className="flex-1 h-11 rounded-lg border border-gray-200 px-3.5"
              style={{
                fontSize: 14,
                borderColor: "#e5e5e5",
              }}
              placeholder="연락처(선택)"
              placeholderTextColor="#bbbbbb"
              keyboardType="phone-pad"
              value={contact}
              onChangeText={setContact}
            />
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isSubmitDisabled}
            className="w-full h-12 rounded-full items-center justify-center"
            style={{
              backgroundColor: isSubmitDisabled ? "#e5e5e5" : "#e63946",
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: "600",
                color: isSubmitDisabled ? "#aaaaaa" : "white",
              }}
            >
              제출하기
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
