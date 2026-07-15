import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
  StyleSheet,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import * as ImagePicker from "expo-image-picker";
import { GlassBackButton } from "@/components/ui/GlassBackButton";
import { LiquidGlass } from "@/components/ui/LiquidGlass";
import { useLiquidGlassPress } from "@/hooks/useLiquidGlassPress";
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
  GRAY_100,
  GRAY_200,
  THUMBNAIL_PLACEHOLDER,
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
  const insets = useSafeAreaInsets();
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
  const hasChanges = nicknameChanged || pendingAvatarUri !== null || removeAvatar;
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
      Alert.alert(t("profileEdit.errorTitle"), t("profileEdit.nicknameTooShort"));
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
      const body = (res.headers.get("content-type") ?? "").includes("application/json")
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

  const displayAvatar = removeAvatar ? null : (pendingAvatarUri ?? existingAvatarUrl);

  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(t("profileEdit.permissionTitle"), t("profileEdit.permissionPhoto"));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      quality: 1,
      legacy: true,
    });
    if (!result.canceled && result.assets[0]) {
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
        Alert.alert(t("profileEdit.errorTitle"), t("profileEdit.loginRequired"));
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
            { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG, base64: true },
          ),
          ImageManipulator.manipulateAsync(
            pendingAvatarUri,
            [{ resize: { width: 300, height: 300 } }],
            { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true },
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
          supabase.storage.from("avatars").upload(displayPath, base64ToUint8Array(display.base64), {
            upsert: true,
            contentType: "image/jpeg",
          }),
          supabase.storage.from("avatars").upload(thumbPath, base64ToUint8Array(thumb.base64), {
            upsert: true,
            contentType: "image/jpeg",
          }),
        ]);

        if (displayUpload.error) throw displayUpload.error;
        if (thumbUpload.error) throw thumbUpload.error;

        const { data: displayUrl } = supabase.storage.from("avatars").getPublicUrl(displayPath);
        const { data: thumbUrl } = supabase.storage.from("avatars").getPublicUrl(thumbPath);

        uploadedUrl = `${displayUrl.publicUrl}?t=${ts}`;
        uploadedThumbUrl = `${thumbUrl.publicUrl}?t=${ts}`;
      }

      const body: { nickname?: string; avatar_url?: string | null; avatar_thumb_url?: string | null } = {};
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

      const resBody = (res.headers.get("content-type") ?? "").includes("application/json")
        ? await res.json().catch(() => ({}))
        : {};
      if (!res.ok) {
        throw new Error((resBody as { error?: string }).error ?? t("profileEdit.saveError"));
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
    <View style={{ flex: 1, backgroundColor: GRAY_100 }}>
      {/* 플로팅 버튼 row */}
      <View style={[styles.floatRow, { top: insets.top + 8 }]} pointerEvents="box-none">
        <GlassBackButton onPress={() => router.back()} />
        <GlassSubmitButton onPress={handleSave} isLoading={isSaving} enabled={canSave} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.content, { paddingTop: insets.top + 64 }]}>
          {/* 아바타 카드 */}
          <View style={[styles.card, { alignItems: "center" }]}>
            <Text style={[styles.fieldLabel, { alignSelf: "flex-start" }]}>{t("profileEdit.photoSectionTitle", { defaultValue: "프로필 사진" })}</Text>
            <TouchableOpacity onPress={handlePickAvatar} activeOpacity={0.8}>
              <View style={styles.avatar}>
                {displayAvatar && !avatarError ? (
                  <Image
                    source={{ uri: displayAvatar }}
                    style={{ width: 88, height: 88 }}
                    resizeMode="cover"
                    onError={() => setAvatarError(true)}
                  />
                ) : (
                  <GachaPlaceholder size={88} borderRadius={44} />
                )}
              </View>
            </TouchableOpacity>
            <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
              <GlassTextButton label={t("profileEdit.changePhoto")} onPress={handlePickAvatar} />
              {(existingAvatarUrl || pendingAvatarUri) && !removeAvatar && (
                <GlassTextButton label={t("profileEdit.removePhoto")} onPress={handleRemoveAvatar} color={DANGER} />
              )}
            </View>
          </View>

          {/* 닉네임 카드 */}
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>{t("profileEdit.nicknameLabel")}</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput
                style={styles.inputField}
                placeholder={t("profileEdit.nicknamePlaceholder")}
                placeholderTextColor={TEXT_PLACEHOLDER}
                value={nickname}
                onChangeText={handleNicknameChange}
                maxLength={9}
              />
              <GlassTextButton
                label={t("profileEdit.nicknameCheckBtn")}
                onPress={handleCheckNickname}
                disabled={!nicknameChanged}
                isLoading={isCheckingNickname}
                overlayColor={nicknameChanged ? "rgba(233,75,140,0.15)" : undefined}
                color={nicknameChanged ? PRIMARY : TEXT_GRAY}
                height={44}
              />
            </View>
            {nicknameChecked && (
              <Text style={{ fontSize: 12, marginTop: 6, color: nicknameAvailable ? SUCCESS_TEXT : DANGER }}>
                {nicknameAvailable ? t("profileEdit.nicknameAvailable") : t("profileEdit.nicknameTaken")}
              </Text>
            )}
          </View>
        </View>
      </ScrollView>

      <ImageCropModal
        visible={cropSourceUri !== null}
        sourceUri={cropSourceUri}
        onCancel={() => setCropSourceUri(null)}
        onConfirm={handleCropConfirm}
      />
    </View>
  );
};

export default ProfileEditScreen;

function GlassTextButton({
  label,
  onPress,
  color,
  disabled,
  isLoading,
  overlayColor,
  height = 34,
}: {
  label: string;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
  isLoading?: boolean;
  overlayColor?: string;
  height?: number;
}) {
  const { onPressIn, animatedStyle, brightnessValue } = useLiquidGlassPress();
  return (
    <LiquidGlass
      borderRadius={10}
      style={[animatedStyle, { opacity: disabled ? 0.4 : 1 }]}
      brightnessOpacity={brightnessValue}
      overlayColor={overlayColor}
    >
      <TouchableOpacity
        onPress={onPress}
        onPressIn={disabled ? undefined : onPressIn}
        disabled={disabled || isLoading}
        activeOpacity={1}
        style={{ paddingHorizontal: 14, height, alignItems: "center", justifyContent: "center" }}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={color ?? TEXT_DARK} />
        ) : (
          <Text style={{ fontSize: 13, fontWeight: "600", color: color ?? TEXT_DARK }}>
            {label}
          </Text>
        )}
      </TouchableOpacity>
    </LiquidGlass>
  );
}

function GlassSubmitButton({
  onPress,
  isLoading,
  enabled,
}: {
  onPress: () => void;
  isLoading: boolean;
  enabled: boolean;
}) {
  const { onPressIn, animatedStyle, brightnessValue } = useLiquidGlassPress();
  const color = enabled ? PRIMARY : TEXT_DARK;
  return (
    <LiquidGlass
      borderRadius={22}
      style={[animatedStyle, { opacity: enabled ? 1 : 0.4 }]}
      brightnessOpacity={brightnessValue}
      overlayColor={enabled ? "rgba(233,75,140,0.10)" : undefined}
    >
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onPressIn}
        disabled={!enabled || isLoading}
        activeOpacity={1}
        style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={color} />
        ) : (
          <Ionicons name="checkmark" size={24} color={color} />
        )}
      </TouchableOpacity>
    </LiquidGlass>
  );
}

const styles = StyleSheet.create({
  floatRow: {
    position: "absolute",
    left: 12,
    right: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 10,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 12,
  },
  card: {
    backgroundColor: WHITE,
    borderRadius: 16,
    padding: 20,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: THUMBNAIL_PLACEHOLDER,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: TEXT_DARK,
    marginBottom: 10,
    alignSelf: "flex-start",
    width: "100%",
  },
  inputField: {
    flex: 1,
    backgroundColor: GRAY_100,
    borderRadius: 8,
    height: 44,
    paddingHorizontal: 14,
    fontSize: 14,
    color: TEXT_DARK,
  },
});
