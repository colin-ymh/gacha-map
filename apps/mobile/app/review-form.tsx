import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useState, useCallback } from "react";
import * as ImagePicker from "expo-image-picker";
import { getAuthHeaders } from "@/lib/supabase";
import { useTranslation } from "react-i18next";
import {
  PRIMARY,
  TEXT_DARK,
  TEXT_GRAY,
  TEXT_PLACEHOLDER,
  BORDER,
  GRAY_200,
  GRAY_300,
  WHITE,
  THUMBNAIL_PLACEHOLDER,
  DANGER,
} from "@/constants/colors";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";
const MAX_CONTENT = 500;
const MAX_PHOTOS = 3;

export default function ReviewFormScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const {
    shopId,
    reviewId,
    initialContent,
    initialImageUrls: rawInitialImageUrls,
  } = useLocalSearchParams<{
    shopId: string;
    reviewId?: string;
    initialContent?: string;
    initialImageUrls?: string;
  }>();

  const isEditMode = !!reviewId;

  const parsedInitialImageUrls: string[] = (() => {
    if (!rawInitialImageUrls) return [];
    try {
      return JSON.parse(rawInitialImageUrls);
    } catch {
      return [];
    }
  })();

  const [content, setContent] = useState(initialContent ?? "");
  const [keepUrls, setKeepUrls] = useState<string[]>(parsedInitialImageUrls);
  const [newAssets, setNewAssets] = useState<ImagePicker.ImagePickerAsset[]>(
    [],
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalPhotos = keepUrls.length + newAssets.length;
  const canAddMore = totalPhotos < MAX_PHOTOS;
  const isSubmitEnabled =
    !isSubmitting && (content.trim().length > 0 || totalPhotos > 0);

  const handlePickImages = useCallback(async () => {
    if (!canAddMore) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: MAX_PHOTOS - totalPhotos,
    });

    if (result.canceled) return;
    setNewAssets((prev) => {
      const combined = [...prev, ...result.assets];
      return combined.slice(0, MAX_PHOTOS - keepUrls.length);
    });
  }, [canAddMore, keepUrls.length, totalPhotos]);

  const handleRemovePhoto = useCallback(
    (index: number) => {
      if (index < keepUrls.length) {
        setKeepUrls((prev) => prev.filter((_, i) => i !== index));
      } else {
        const newIdx = index - keepUrls.length;
        setNewAssets((prev) => prev.filter((_, i) => i !== newIdx));
      }
    },
    [keepUrls.length],
  );

  const handleSubmit = useCallback(async () => {
    if (!isSubmitEnabled) return;

    setIsSubmitting(true);
    try {
      const authHeaders = await getAuthHeaders();
      const formData = new FormData();

      if (content.trim()) {
        formData.append("content", content.trim());
      }

      if (isEditMode) {
        keepUrls.forEach((url) => formData.append("keepUrls[]", url));
      }

      for (const asset of newAssets) {
        const ext = (asset.uri.split(".").pop() ?? "jpg").toLowerCase();
        const mime = ext === "png" ? "image/png" : "image/jpeg";
        formData.append("files[]", {
          uri: asset.uri,
          name: `photo.${ext}`,
          type: mime,
        } as unknown as Blob);
      }

      const url = isEditMode
        ? `${API_BASE}/api/reviews/${reviewId}`
        : `${API_BASE}/api/shops/${shopId}/reviews`;

      const res = await fetch(url, {
        method: isEditMode ? "PATCH" : "POST",
        headers: authHeaders,
        body: formData,
      });

      if (!res.ok) {
        throw new Error(t("review.submitError"));
      }

      router.back();
    } catch (err) {
      Alert.alert(
        "",
        err instanceof Error ? err.message : t("review.submitError"),
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    isSubmitEnabled,
    content,
    isEditMode,
    keepUrls,
    newAssets,
    reviewId,
    shopId,
    router,
    t,
  ]);

  const allPhotoUris = [...keepUrls, ...newAssets.map((a) => a.uri)];

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* 헤더 */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.headerSide}
            hitSlop={8}
          >
            <Text style={styles.cancelText}>{t("review.formCancel")}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isEditMode ? t("review.editTitle") : t("review.formTitle")}
          </Text>
          <View style={styles.headerSide}>
            {isSubmitting ? (
              <ActivityIndicator color={PRIMARY} size="small" />
            ) : (
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={!isSubmitEnabled}
                hitSlop={8}
              >
                <Text
                  style={[
                    styles.submitText,
                    !isSubmitEnabled && styles.submitDisabled,
                  ]}
                >
                  {t("review.formSubmit")}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.divider} />

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* 텍스트 입력 */}
          <TextInput
            style={styles.textarea}
            multiline
            maxLength={MAX_CONTENT}
            value={content}
            onChangeText={setContent}
            placeholder={t("review.formPlaceholder")}
            placeholderTextColor={TEXT_PLACEHOLDER}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>
            {t("review.charCount", {
              current: content.length,
              max: MAX_CONTENT,
            })}
          </Text>

          <View style={styles.divider} />

          {/* 사진 첨부 */}
          <View style={styles.photoSection}>
            <Text style={styles.photoLabel}>{t("review.formPhotoLabel")}</Text>
            <View style={styles.photoRow}>
              {allPhotoUris.map((uri, idx) => (
                <View key={idx} style={styles.photoWrapper}>
                  <Image
                    source={{ uri }}
                    style={styles.photoThumb}
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    style={styles.photoRemove}
                    onPress={() => handleRemovePhoto(idx)}
                    hitSlop={4}
                  >
                    <Text style={styles.photoRemoveText}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {canAddMore && (
                <TouchableOpacity
                  style={styles.photoAdd}
                  onPress={handlePickImages}
                >
                  <Text style={styles.photoAddIcon}>+</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* 힌트 */}
          <Text style={styles.hint}>{t("review.formRequiredHint")}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const THUMB = 80;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: WHITE,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    height: 52,
    paddingHorizontal: 16,
  },
  headerSide: {
    width: 60,
    alignItems: "flex-end",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
    color: TEXT_DARK,
  },
  cancelText: {
    fontSize: 15,
    color: TEXT_GRAY,
  },
  submitText: {
    fontSize: 15,
    fontWeight: "700",
    color: PRIMARY,
  },
  submitDisabled: {
    color: GRAY_300,
  },
  divider: {
    height: 1,
    backgroundColor: BORDER,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  textarea: {
    minHeight: 160,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    fontSize: 15,
    color: TEXT_DARK,
    lineHeight: 24,
  },
  charCount: {
    textAlign: "right",
    paddingHorizontal: 16,
    paddingBottom: 12,
    fontSize: 12,
    color: TEXT_GRAY,
  },
  photoSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  photoLabel: {
    fontSize: 13,
    color: TEXT_GRAY,
    marginBottom: 12,
  },
  photoRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  photoWrapper: {
    position: "relative",
  },
  photoThumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: 8,
    backgroundColor: THUMBNAIL_PLACEHOLDER,
  },
  photoRemove: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: DANGER,
    alignItems: "center",
    justifyContent: "center",
  },
  photoRemoveText: {
    fontSize: 14,
    color: WHITE,
    lineHeight: 20,
    fontWeight: "700",
  },
  photoAdd: {
    width: THUMB,
    height: THUMB,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: GRAY_200,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: GRAY_200,
  },
  photoAddIcon: {
    fontSize: 28,
    color: TEXT_GRAY,
    lineHeight: 32,
  },
  hint: {
    paddingHorizontal: 16,
    paddingTop: 4,
    fontSize: 12,
    color: TEXT_GRAY,
  },
});
