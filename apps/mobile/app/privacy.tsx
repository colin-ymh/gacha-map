import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

const PrivacyScreen = () => {
  const router = useRouter();

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white">
      {/* Header */}
      <View className="h-13 border-b border-[#e5e7eb] flex-row items-center px-4">
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-xl text-[#1a1a1a]">‹</Text>
        </TouchableOpacity>
        <Text className="text-center flex-1 text-base font-semibold text-[#1a1a1a]">
          개인정보처리방침
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Content */}
      <ScrollView className="flex-1 px-5 py-5">
        <Text className="text-lg font-bold text-[#1a1a1a] mb-4">
          개인정보처리방침
        </Text>

        <Text className="text-sm text-[#444444]" style={{ lineHeight: 22 }}>
          가챠맵은 개인정보보호법에 따라 이용자의 개인정보를 보호하고 이와
          관련한 고충을 신속하게 처리할 수 있도록 하기 위하여 다음과 같이
          개인정보처리방침을 수립·공개합니다.
          {"\n\n"}
          1. 수집하는 개인정보 항목{"\n"}- 소셜 로그인 시: 이메일, 닉네임,
          프로필 이미지
          {"\n\n"}
          2. 개인정보의 수집 및 이용 목적{"\n"}- 서비스 제공 및 운영{"\n"}- 고객
          문의 및 제보 처리
          {"\n\n"}
          [내용은 추후 업데이트 예정]
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

export default PrivacyScreen;
