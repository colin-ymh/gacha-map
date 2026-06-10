import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useState } from "react";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { Ionicons } from "@expo/vector-icons";
import { getAuthHeaders, supabase } from "@/lib/supabase";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setProfile } from "@/store/slices/auth.slice";
import {
  PRIMARY,
  TEXT_DARK,
  TEXT_GRAY,
  GRAY_200,
  THUMBNAIL_PLACEHOLDER,
  BORDER,
  GRAY_100,
  TEXT_PLACEHOLDER,
  WHITE,
  SUCCESS_TEXT,
  DANGER,
} from "@/constants/colors";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

const ProfileEditScreen = () => {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const profile = useAppSelector((s) => s.auth.profile);
  const user = useAppSelector((s) => s.auth.user);

  const defaultNickname = profile?.nickname ?? profile?.name ?? "";
  const existingAvatarUrl =
    profile?.avatar_url ?? user?.user_metadata?.avatar_url ?? null;

  const [nickname, setNickname] = useState(defaultNickname);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingAvatarUri, setPendingAvatarUri] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState(false);
  const [isCheckingNickname, setIsCheckingNickname] = useState(false);
  const [nicknameChecked, setNicknameChecked] = useState(false);
  const [nicknameAvailable, setNicknameAvailable] = useState(false);

  const nicknameChanged = nickname.trim() !== defaultNickname.trim();
  const canSave = !nicknameChanged || (nicknameChecked && nicknameAvailable);

  const handleNicknameChange = (text: string) => {
    setNickname(text);
    setNicknameChecked(false);
    setNicknameAvailable(false);
  };

  const handleCheckNickname = async () => {
    const trimmed = nickname.trim();
    if (!trimmed) {
      Alert.alert("오류", "닉네임을 입력해 주세요.");
      return;
    }
    if (trimmed.length > 20) {
      Alert.alert("오류", "닉네임은 20자 이하로 입력해 주세요.");
      return;
    }
    setIsCheckingNickname(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(
        `${API_BASE}/api/users/check-nickname?nickname=${encodeURIComponent(trimmed)}`,
        { headers },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        Alert.alert("오류", (body as { error?: string }).error ?? "확인 실패");
        return;
      }
      setNicknameChecked(true);
      setNicknameAvailable((body as { available: boolean }).available);
    } catch {
      Alert.alert("오류", "중복 확인 중 오류가 발생했습니다.");
    } finally {
      setIsCheckingNickname(false);
    }
  };

  const displayAvatar = pendingAvatarUri ?? existingAvatarUrl;

  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("권한 필요", "사진 라이브러리 접근 권한이 필요합니다.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.75,
    });

    if (!result.canceled && result.assets[0]) {
      setPendingAvatarUri(result.assets[0].uri);
      setAvatarError(false);
    }
  };

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

      let uploadedUrl: string | undefined;
      let uploadedThumbUrl: string | undefined;

      if (pendingAvatarUri && supabase && user?.id) {
        const ts = Date.now();

        const [display, thumb] = await Promise.all([
          ImageManipulator.manipulateAsync(
            pendingAvatarUri,
            [{ resize: { width: 1200 } }],
            {
              compress: 0.85,
              format: ImageManipulator.SaveFormat.JPEG,
              base64: true,
            },
          ),
          ImageManipulator.manipulateAsync(
            pendingAvatarUri,
            [{ resize: { width: 300, height: 300 } }],
            {
              compress: 0.8,
              format: ImageManipulator.SaveFormat.JPEG,
              base64: true,
            },
          ),
        ]);

        const base64ToUint8Array = (base64: string) => {
          const binaryString = atob(base64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          return bytes;
        };

        const displayPath = `${user.id}/avatar.jpg`;
        const thumbPath = `${user.id}/avatar_thumb.jpg`;

        const [displayUpload, thumbUpload] = await Promise.all([
          supabase.storage
            .from("avatars")
            .upload(displayPath, base64ToUint8Array(display.base64!), {
              upsert: true,
              contentType: "image/jpeg",
            }),
          supabase.storage
            .from("avatars")
            .upload(thumbPath, base64ToUint8Array(thumb.base64!), {
              upsert: true,
              contentType: "image/jpeg",
            }),
        ]);

        if (displayUpload.error) throw displayUpload.error;
        if (thumbUpload.error) throw thumbUpload.error;

        const { data: displayUrl } = supabase.storage
          .from("avatars")
          .getPublicUrl(displayPath);
        const { data: thumbUrl } = supabase.storage
          .from("avatars")
          .getPublicUrl(thumbPath);

        uploadedUrl = `${displayUrl.publicUrl}?t=${ts}`;
        uploadedThumbUrl = `${thumbUrl.publicUrl}?t=${ts}`;
      }

      const body: {
        nickname: string;
        avatar_url?: string;
        avatar_thumb_url?: string;
      } = {
        nickname: trimmedNickname,
      };
      if (uploadedUrl) body.avatar_url = uploadedUrl;
      if (uploadedThumbUrl) body.avatar_thumb_url = uploadedThumbUrl;

      const res = await fetch(`${API_BASE}/api/users/profile`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const resBody = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((resBody as { error?: string }).error ?? "저장 실패");
      }

      dispatch(setProfile((resBody as { profile: typeof profile }).profile!));
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
          <TouchableOpacity onPress={handlePickAvatar} activeOpacity={0.8}>
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: THUMBNAIL_PLACEHOLDER,
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {displayAvatar && !avatarError ? (
                <Image
                  source={{ uri: displayAvatar }}
                  style={{ width: 80, height: 80 }}
                  resizeMode="cover"
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <Text
                  style={{
                    fontSize: 32,
                    fontWeight: "700",
                    color: TEXT_GRAY,
                  }}
                >
                  {(nickname || "?").charAt(0).toUpperCase()}
                </Text>
              )}
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={handlePickAvatar} activeOpacity={0.8}>
            <Text
              className="text-xs font-medium mt-2"
              style={{ color: PRIMARY }}
            >
              사진 변경
            </Text>
          </TouchableOpacity>
        </View>

        {/* Nickname Input */}
        <View className="mb-5">
          <Text
            className="text-sm font-semibold mb-2"
            style={{ color: TEXT_DARK }}
          >
            닉네임
          </Text>
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <TextInput
              className="flex-1 h-11 rounded-lg px-3.5 text-sm bg-white"
              style={{ borderWidth: 1, borderColor: BORDER }}
              placeholder="닉네임을 입력해주세요"
              placeholderTextColor={TEXT_PLACEHOLDER}
              value={nickname}
              onChangeText={handleNicknameChange}
              maxLength={20}
            />
            <TouchableOpacity
              onPress={handleCheckNickname}
              disabled={isCheckingNickname || !nicknameChanged}
              activeOpacity={0.8}
              style={{
                height: 44,
                paddingHorizontal: 14,
                borderRadius: 8,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: !nicknameChanged ? GRAY_100 : PRIMARY,
              }}
            >
              {isCheckingNickname ? (
                <ActivityIndicator size="small" color={WHITE} />
              ) : (
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: !nicknameChanged ? TEXT_GRAY : WHITE,
                  }}
                >
                  중복 확인
                </Text>
              )}
            </TouchableOpacity>
          </View>
          {nicknameChecked && (
            <Text
              className="text-xs mt-1.5"
              style={{ color: nicknameAvailable ? SUCCESS_TEXT : DANGER }}
            >
              {nicknameAvailable
                ? "사용 가능한 닉네임입니다."
                : "이미 사용 중인 닉네임입니다."}
            </Text>
          )}
        </View>
      </ScrollView>

      {/* Save Button */}
      <View
        className="px-5 py-4"
        style={{ borderTopWidth: 1, borderTopColor: GRAY_100 }}
      >
        <TouchableOpacity
          className="w-full h-12 rounded-full items-center justify-center"
          style={{ backgroundColor: canSave ? PRIMARY : GRAY_200 }}
          onPress={handleSave}
          disabled={isSaving || !canSave}
          activeOpacity={0.8}
        >
          {isSaving ? (
            <ActivityIndicator color={WHITE} />
          ) : (
            <Text className="text-base font-semibold text-white">저장하기</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default ProfileEditScreen;
