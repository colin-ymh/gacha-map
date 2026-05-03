import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useState } from "react";

const ProfileEditScreen = () => {
  const router = useRouter();
  const [nickname, setNickname] = useState("");

  const handleSave = () => {
    console.log("TODO: save", { nickname });
    router.back();
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white">
      {/* Header */}
      <View className="h-13 border-b border-[#e5e7eb] flex-row items-center px-4">
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-xl text-[#1a1a1a]">‹</Text>
        </TouchableOpacity>
        <Text className="text-center flex-1 text-base font-semibold text-[#1a1a1a]">
          프로필 편집
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1 px-5 py-6"
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar Section */}
        <View className="items-center mb-6">
          <View className="w-20 h-20 rounded-full bg-[#dedede]" />
          <Text className="text-xs font-medium text-[#e63946] mt-2">
            사진 변경
          </Text>
        </View>

        {/* Nickname Input */}
        <View className="mb-5">
          <Text className="text-sm font-semibold text-[#1a1a1a] mb-2">
            닉네임
          </Text>
          <TextInput
            className="w-full h-11 border border-[#e5e5e5] rounded-lg px-3.5 text-sm bg-white"
            placeholder="닉네임을 입력해주세요"
            placeholderTextColor="#aaaaaa"
            value={nickname}
            onChangeText={setNickname}
          />
        </View>
      </ScrollView>

      {/* Save Button */}
      <View className="px-5 py-4 border-t border-[#f3f4f6]">
        <TouchableOpacity
          className="w-full h-12 rounded-full bg-[#e63946] items-center justify-center"
          onPress={handleSave}
          activeOpacity={0.8}
        >
          <Text className="text-base font-semibold text-white">저장하기</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default ProfileEditScreen;
