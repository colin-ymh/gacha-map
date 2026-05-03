import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

const TermsScreen = () => {
  const router = useRouter();

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white">
      {/* Header */}
      <View className="h-13 border-b border-[#e5e7eb] flex-row items-center px-4">
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-xl text-[#1a1a1a]">‹</Text>
        </TouchableOpacity>
        <Text className="text-center flex-1 text-base font-semibold text-[#1a1a1a]">
          이용약관
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Content */}
      <ScrollView className="flex-1 px-5 py-5">
        <Text className="text-lg font-bold text-[#1a1a1a] mb-4">
          가챠맵 이용약관
        </Text>

        <Text className="text-sm text-[#444444]" style={{ lineHeight: 22 }}>
          제1조 (목적){"\n"}이 약관은 가챠맵(이하 "서비스")의 이용과 관련하여
          서비스와 이용자 간의 권리, 의무 및 책임사항을 규정함을 목적으로
          합니다.
          {"\n\n"}
          제2조 (정의){"\n"}
          "서비스"란 가챠맵이 제공하는 모든 서비스를 의미합니다.
          {"\n"}
          "이용자"란 서비스에 접속하여 이 약관에 따라 서비스를 이용하는 회원 및
          비회원을 말합니다.
          {"\n\n"}
          제3조 (약관의 효력 및 변경){"\n"}이 약관은 서비스 화면에 게시하거나
          기타 방법으로 이용자에게 공지함으로써 효력이 발생합니다.
          {"\n\n"}
          [내용은 추후 업데이트 예정]
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

export default TermsScreen;
