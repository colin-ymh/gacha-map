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
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import * as ImageManipulator from "expo-image-manipulator";
import { validateNickname } from "@gacha-map/shared";
import ImageCropModal from "@/components/organisms/ImageCropModal";
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
import GachaPlaceholder from "@/components/ui/GachaPlaceholder";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

const NICKNAME_ERROR_KEY_MAP: Record<string, string> = {
  too_short: "nicknameTooShort",
  too_long: "nicknameTooLong",
  invalid_chars: "nicknameInvalidChars",
  profanity: "nicknameProfanity",
};

const ProfileEditScreen = () => {
  const { t } = useTranslation();
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
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [isCheckingNickname, setIsCheckingNickname] = useState(false);
  const [nicknameChecked, setNicknameChecked] = useState(false);
  const [nicknameAvailable, setNicknameAvailable] = useState(false);
  const [cropSourceUri, setCropSourceUri] = useState<string | null>(null);

  // Best-effort recovery: if Android destroyed MainActivity during the (single)
  // gallery pick, retrieve the result on remount and route it into the crop UI.
  useEffect(() => {
    let ignored = false;
    ImagePicker.getPendingResultAsync()
      .then((pending) => {
        if (ignored || !pending || !("canceled" in pending) || pending.canceled)
          return;
        const uri = pending.assets?.[0]?.uri;
        if (uri) setCropSourceUri(uri);
      })
      .catch(() => {});
    return () => {
      ignored = true;
    };
  }, []);

  const nicknameChanged = nickname.trim() !== defaultNickname.trim();
  const hasChanges =
    nicknameChanged || pendingAvatarUri !== null || removeAvatar;
  const canSave =
    hasChanges && (!nicknameChanged || (nicknameChecked && nicknameAvailable));

  const handleNicknameChange = (text: string) => {
    setNickname(text);
    setNicknameChecked(false);
    setNicknameAvailable(false);
  };

  const handleCheckNickname = async () => {
    const trimmed = nickname.trim();
    if (!trimmed) {
      Alert.alert(
        t("profileEdit.errorTitle"),
        t("profileEdit.nicknameTooShort"),
      );
      return;
    }
    const validationError = validateNickname(trimmed);
    if (validationError) {
      Alert.alert(
        t("profileEdit.errorTitle"),
        t(NICKNAME_ERROR_KEY_MAP[validationError] ?? "nicknameTooShort"),
      );
      return;
    }
    setIsCheckingNickname(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(
        `${API_BASE}/api/users/check-nickname?nickname=${encodeURIComponent(trimmed)}`,
        { headers },
      );
      const body = (res.headers.get("content-type") ?? "").includes(
        "application/json",
      )
        ? await res.json().catch(() => ({}))
        : {};
      if (!res.ok) {
        Alert.alert(
          t("profileEdit.errorTitle"),
          (body as { error?: string }).error ?? t("profileEdit.checkError"),
        );
        return;
      }
      setNicknameChecked(true);
      setNicknameAvailable((body as { available: boolean }).available);
    } catch {
      Alert.alert(t("profileEdit.errorTitle"), t("profileEdit.checkError"));
    } finally {
      setIsCheckingNickname(false);
    }
  };

  const displayAvatar = removeAvatar
    ? null
    : (pendingAvatarUri ?? existingAvatarUrl);
  const avatarFallbackChar = (defaultNickname || t("profile.guest"))
    .charAt(0)
    .toUpperCase();

  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        t("profileEdit.permissionTitle"),
        t("profileEdit.permissionPhoto"),
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      quality: 1,
      legacy: true,
    });

    if (!result.canceled && result.assets[0]) {
      // In-app square crop (avoids native crop activity that crashes on some
      // Samsung devices by destroying MainActivity mid-crop).
      setCropSourceUri(result.assets[0].uri);
    }
  };

  const handleCropConfirm = (uri: string) => {
    setCropSourceUri(null);
    setPendingAvatarUri(uri);
    setRemoveAvatar(false);
    setAvatarError(false);
  };

  const handleRemoveAvatar = () => {
    setRemoveAvatar(true);
    setPendingAvatarUri(null);
    setAvatarError(false);
  };

  const handleSave = async () => {
    const trimmedNickname = nickname.trim();
    if (!API_BASE) {
      Alert.alert(t("profileEdit.errorTitle"), t("profileEdit.serverError"));
      return;
    }

    setIsSaving(true);
    try {
      const headers = await getAuthHeaders();
      if (!headers.Authorization) {
        Alert.alert(
          t("profileEdit.errorTitle"),
          t("profileEdit.loginRequired"),
        );
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

        if (!display.base64 || !thumb.base64) {
          Alert.alert(t("profileEdit.errorTitle"), t("profileEdit.saveError"));
          return;
        }

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
            .upload(displayPath, base64ToUint8Array(display.base64), {
              upsert: true,
              contentType: "image/jpeg",
            }),
          supabase.storage
            .from("avatars")
            .upload(thumbPath, base64ToUint8Array(thumb.base64), {
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
        nickname?: string;
        avatar_url?: string | null;
        avatar_thumb_url?: string | null;
      } = {};
      if (nicknameChanged) body.nickname = trimmedNickname;
      if (removeAvatar) {
        body.avatar_url = null;
        body.avatar_thumb_url = null;
      } else {
        if (uploadedUrl) body.avatar_url = uploadedUrl;
        if (uploadedThumbUrl) body.avatar_thumb_url = uploadedThumbUrl;
      }

      const res = await fetch(`${API_BASE}/api/users/profile`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const resBody = (res.headers.get("content-type") ?? "").includes(
        "application/json",
      )
        ? await res.json().catch(() => ({}))
        : {};
      if (!res.ok) {
        throw new Error(
          (resBody as { error?: string }).error ?? t("profileEdit.saveError"),
        );
      }

      const updatedProfile = (resBody as { profile: typeof profile }).profile;
      if (!updatedProfile) throw new Error(t("profileEdit.saveError"));
      dispatch(setProfile(updatedProfile));
      router.back();
    } catch (err) {
      Alert.alert(
        t("profileEdit.errorTitle"),
        err instanceof Error ? err.message : t("profileEdit.saveError"),
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
        style={{ height: 58, paddingBottom: 6 }}
      >
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={TEXT_DARK} />
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
          {t("profileEdit.title")}
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
                <GachaPlaceholder size={80} borderRadius={40} />
              )}
            </View>
          </TouchableOpacity>
          <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
            <TouchableOpacity onPress={handlePickAvatar} activeOpacity={0.8}>
              <Text className="text-xs font-medium" style={{ color: PRIMARY }}>
                {t("profileEdit.changePhoto")}
              </Text>
            </TouchableOpacity>
            {(existingAvatarUrl || pendingAvatarUri) && !removeAvatar && (
              <TouchableOpacity
                onPress={handleRemoveAvatar}
                activeOpacity={0.8}
              >
                <Text className="text-xs font-medium" style={{ color: DANGER }}>
                  {t("profileEdit.removePhoto")}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Nickname Input */}
        <View className="mb-5">
          <Text
            className="text-sm font-semibold mb-2"
            style={{ color: TEXT_DARK }}
          >
            {t("profileEdit.nicknameLabel")}
          </Text>
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <TextInput
              className="flex-1 rounded-lg px-3.5 text-sm bg-white"
              style={{ height: 44, borderWidth: 1, borderColor: BORDER }}
              placeholder={t("profileEdit.nicknamePlaceholder")}
              placeholderTextColor={TEXT_PLACEHOLDER}
              value={nickname}
              onChangeText={handleNicknameChange}
              maxLength={9}
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
                  {t("profileEdit.nicknameCheckBtn")}
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
                ? t("profileEdit.nicknameAvailable")
                : t("profileEdit.nicknameTaken")}
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
            <Text className="text-base font-semibold text-white">
              {t("profileEdit.save")}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ImageCropModal
        visible={cropSourceUri !== null}
        sourceUri={cropSourceUri}
        onCancel={() => setCropSourceUri(null)}
        onConfirm={handleCropConfirm}
      />
    </SafeAreaView>
  );
};

export default ProfileEditScreen;
