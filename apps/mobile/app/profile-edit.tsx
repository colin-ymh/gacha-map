import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useState } from "react";
import { getAuthHeaders } from "@/lib/supabase";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setProfile } from "@/store/slices/auth.slice";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

const ProfileEditScreen = () => {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const profile = useAppSelector((s) => s.auth.profile);
  const defaultNickname = profile?.nickname ?? profile?.name ?? "";
  const [nickname, setNickname] = useState(defaultNickname);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    const trimmedNickname = nickname.trim();
    if (!API_BASE) {
      Alert.alert("오류", "서버 주소가 설정되지 않았습니다.");
      return;
    }
    if (trimmedNickname.length > 20) {
      Alert.alert("오류", "닉네임은 20자 이하로 입력해 주세요.");
      return;
    }

    setIsSaving(true);
    try {
      const headers = await getAuthHeaders();
      if (!headers.Authorization) {
        Alert.alert("오류", "로그인이 필요합니다.");
        return;
      }

      const res = await fetch(`${API_BASE}/api/users/profile`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: trimmedNickname }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((body as { error?: string }).error ?? "저장 실패");
      }

      dispatch(setProfile((body as { profile: typeof profile }).profile!));
      router.back();
    } catch (err) {
      Alert.alert(
        "오류",
        err instanceof Error
          ? err.message
          : "프로필 저장 중 오류가 발생했습니다.",
      );
    } finally {
      setIsSaving(false);
    }
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
          disabled={isSaving}
          activeOpacity={0.8}
        >
          {isSaving ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text className="text-base font-semibold text-white">저장하기</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default ProfileEditScreen;
