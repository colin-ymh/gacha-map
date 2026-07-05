import { useState, useCallback } from "react";
import GachaPlaceholder from "@/components/ui/GachaPlaceholder";
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from "react-native";
import ImageViewerModal from "@/components/molecules/ImageViewerModal";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import GachaProductSearch from "@/components/organisms/GachaProductSearch";
import type { GachaProduct } from "@gacha-map/shared";
import {
  PRIMARY,
  PRIMARY_BG,
  TEXT_DARK,
  TEXT_GRAY,
  GRAY_100,
  GRAY_200,
  WHITE,
  BORDER,
  THUMBNAIL_PLACEHOLDER,
} from "@/constants/colors";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

interface ScanCandidate {
  id: string;
  name: string;
  name_ko: string | null;
  name_ja: string | null;
  manufacturer: string;
  official_image_url: string | null;
  price_jpy: number | null;
}

export default function GachaReportScreen() {
  const router = useRouter();
  const { shopId } = useLocalSearchParams<{ shopId: string }>();
  const { t } = useTranslation();

  const [selectedProduct, setSelectedProduct] = useState<GachaProduct | null>(null);
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [priceKrw, setPriceKrw] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isScanLoading, setIsScanLoading] = useState(false);
  const [scanCandidates, setScanCandidates] = useState<ScanCandidate[]>([]);
  const [scanAutoQuery, setScanAutoQuery] = useState<string | undefined>();
  const [scanExtractedName, setScanExtractedName] = useState<string | null>(null);
  const [scanOcrFailed, setScanOcrFailed] = useState(false);
  const [observationId, setObservationId] = useState<string | null>(null);

  const handleScan = useCallback(async () => {
    const pickImage = (useCamera: boolean) =>
      new Promise<ImagePicker.ImagePickerResult>((resolve) => {
        if (useCamera) {
          ImagePicker.requestCameraPermissionsAsync().then(({ status }) => {
            if (status !== "granted") {
              Alert.alert(t("gacha.report.scanPermissionDenied"));
              resolve({ canceled: true, assets: null });
              return;
            }
            ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 }).then(resolve);
          });
        } else {
          ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 }).then(resolve);
        }
      });

    const result = await new Promise<ImagePicker.ImagePickerResult>((resolve) => {
      Alert.alert(
        "",
        "",
        [
          { text: t("gacha.report.scanSourceCamera"), onPress: () => pickImage(true).then(resolve) },
          { text: t("gacha.report.scanSourceGallery"), onPress: () => pickImage(false).then(resolve) },
          { text: t("gacha.report.cancelBtn"), style: "cancel", onPress: () => resolve({ canceled: true, assets: null }) },
        ],
        { cancelable: true, onDismiss: () => resolve({ canceled: true, assets: null }) },
      );
    });

    if (result.canceled || !result.assets[0]) return;

    setIsScanLoading(true);
    setScanCandidates([]);

    try {
      const manipulated = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 1280 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      );
      if (!manipulated.base64) throw new Error("base64 failed");

      const { getAuthHeaders } = await import("@/lib/supabase");
      const headers = await getAuthHeaders();

      const res = await fetch(`${API_BASE}/api/gacha-scan`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ image: manipulated.base64, shop_id: shopId }),
      });

      if (res.status === 429) {
        Alert.alert(t("gacha.report.scanUnavailable"));
        return;
      }
      if (!res.ok) {
        Alert.alert(t("gacha.report.scanError"));
        return;
      }

      const data = await res.json();
      const candidates: ScanCandidate[] = data.candidates ?? [];
      setObservationId(typeof data.observation_id === "string" ? data.observation_id : null);
      setScanExtractedName(typeof data.extracted_name === "string" ? data.extracted_name : null);
      setScanOcrFailed(false);

      if (candidates.length === 0) {
        if (!data.extracted_name) {
          setScanOcrFailed(true);
          setScanAutoQuery("");
        }
        return;
      }

      if (data.price_krw != null) {
        setPriceKrw(String(data.price_krw));
      }

      if (candidates.length === 1 && !data.extracted_name) {
        setSelectedProduct(candidates[0] as unknown as GachaProduct);
        setScanCandidates([]);
      } else {
        setScanCandidates(candidates);
      }
    } catch {
      Alert.alert(t("gacha.report.scanError"));
    } finally {
      setIsScanLoading(false);
    }
  }, [t, shopId]);

  const handleSubmit = useCallback(async () => {
    if (!selectedProduct) {
      Alert.alert(t("gacha.report.errorRequired"));
      return;
    }

    setIsSubmitting(true);
    try {
      const { getAuthHeaders } = await import("@/lib/supabase");
      const headers = await getAuthHeaders();

      if (selectedProduct.id === "__observation__") {
        const res = await fetch(`${API_BASE}/api/gacha-observations`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ name: selectedProduct.name, shop_id: shopId }),
        });
        if (!res.ok) {
          Alert.alert(t("gacha.report.scanError"));
          return;
        }
        Alert.alert(t("gacha.report.successNew"));
        router.back();
        return;
      }

      const body: Record<string, unknown> = {
        gacha_product_id: selectedProduct.id,
      };
      const parsed = parseInt(priceKrw, 10);
      if (!isNaN(parsed) && parsed >= 0) {
        body.price_krw = parsed;
      }
      if (observationId) {
        body.observation_id = observationId;
      }

      const res = await fetch(`${API_BASE}/api/shops/${shopId}/gacha-products`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errBody = (res.headers.get("content-type") ?? "").includes("application/json")
          ? await res.json().catch(() => ({}))
          : {};
        throw new Error(errBody.error ?? "");
      }
      Alert.alert(t("gacha.report.successNew"));
      router.back();
    } catch (err) {
      const msg =
        err instanceof Error && err.message ? err.message : t("gacha.report.errorRequired");
      Alert.alert(msg);
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedProduct, priceKrw, shopId, router, t, observationId]);

  const handleNewProduct = useCallback((name: string) => {
    setSelectedProduct({
      id: "__observation__",
      name,
      name_ko: name,
      name_ja: null,
      name_en: null,
      manufacturer: "",
      official_image_url: null,
      price_jpy: null,
      release_month: null,
      status: "active",
      name_parts: null,
    } as unknown as GachaProduct);
    setScanCandidates([]);
  }, []);

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: WHITE }}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("gacha.report.title")}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* OCR 실패 안내 */}
      {scanOcrFailed && (
        <View style={styles.ocrFailBanner}>
          <Text style={styles.ocrFailText}>{t("gacha.report.scanOcrFailed")}</Text>
        </View>
      )}

      {/* 검색 + 스캔 */}
      <View style={styles.searchSection}>
        <View style={styles.searchRow}>
          <View style={{ flex: 1 }}>
            <GachaProductSearch
              placeholder={t("gacha.report.searchPlaceholder")}
              onSelect={(product) => {
                setSelectedProduct(product);
                setScanCandidates([]);
              }}
              onResultsChange={setIsSearchDropdownOpen}
              externalQuery={scanAutoQuery}
              onExternalQueryConsumed={() => setScanAutoQuery(undefined)}
              onNewProduct={handleNewProduct}
            />
          </View>
          <TouchableOpacity
            style={[styles.scanBtn, isScanLoading && styles.scanBtnDisabled]}
            onPress={handleScan}
            disabled={isScanLoading}
            activeOpacity={0.7}
          >
            {isScanLoading ? (
              <ActivityIndicator color={TEXT_GRAY} size="small" />
            ) : (
              <Ionicons name="camera-outline" size={22} color={TEXT_GRAY} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="none"
        showsVerticalScrollIndicator={false}
        scrollEnabled={!isSearchDropdownOpen}
      >
        <View style={styles.content}>
          {/* 스캔 후보 선택 */}
          {(scanCandidates.length > 0 || !!scanExtractedName) && (
            <View style={styles.candidatesBox}>
              <Text style={styles.candidatesLabel}>{t("gacha.report.scanPickOne")}</Text>
              {scanCandidates.map((c) => {
                const displayName = c.name_ko ?? c.name_ja ?? c.name;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={styles.candidateRow}
                    activeOpacity={0.7}
                    onPress={() => {
                      setSelectedProduct(c as unknown as GachaProduct);
                      setScanCandidates([]);
                      setScanExtractedName(null);
                    }}
                  >
                    {c.official_image_url ? (
                      <Image source={{ uri: c.official_image_url }} style={styles.candidateThumb} />
                    ) : (
                      <GachaPlaceholder size={44} borderRadius={6} />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.candidateName} numberOfLines={1}>{displayName}</Text>
                      <Text style={styles.candidateMfr}>{c.manufacturer}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
              {scanExtractedName && (
                <TouchableOpacity
                  style={styles.candidateReportRow}
                  activeOpacity={0.7}
                  onPress={() => {
                    setScanAutoQuery(scanExtractedName);
                    setScanCandidates([]);
                    setScanExtractedName(null);
                  }}
                >
                  <View style={styles.candidateReportIcon}>
                    <Text style={styles.candidateReportIconText}>✎</Text>
                  </View>
                  <Text style={styles.candidateReportLabel} numberOfLines={1}>
                    "{scanExtractedName}" {t("gacha.report.scanUseAsQuery")}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* 선택된 상품 */}
          {selectedProduct && (
            <View style={styles.selectedCard}>
              <View style={styles.selectedCardRow}>
                {selectedProduct.id === "__observation__" ? (
                  <View style={[styles.selectedThumbnail, styles.observationThumb]}>
                    <Text style={styles.observationThumbText}>?</Text>
                  </View>
                ) : selectedProduct.official_image_url ? (
                  <TouchableOpacity onPress={() => setShowImageViewer(true)} activeOpacity={0.85}>
                    <Image source={{ uri: selectedProduct.official_image_url }} style={styles.selectedThumbnail} />
                  </TouchableOpacity>
                ) : (
                  <GachaPlaceholder size={64} borderRadius={8} />
                )}
                <View style={styles.selectedInfo}>
                  <Text style={styles.selectedLabel} numberOfLines={2}>
                    {selectedProduct.name_ko ?? selectedProduct.name_ja ?? selectedProduct.name}
                  </Text>
                  {selectedProduct.name_ja != null && (
                    <Text style={styles.selectedNameJa} numberOfLines={2}>{selectedProduct.name_ja}</Text>
                  )}
                  {selectedProduct.id === "__observation__" ? (
                    <View style={styles.observationTag}>
                      <Text style={styles.observationTagText}>{t("gacha.report.directInputTag")}</Text>
                    </View>
                  ) : (
                    <View style={styles.manufacturerTag}>
                      <Text style={styles.manufacturerTagText}>{selectedProduct.manufacturer}</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          )}

          {/* 가격 입력 */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t("gacha.report.priceLabel")}</Text>
            <TextInput
              style={styles.input}
              value={priceKrw}
              onChangeText={setPriceKrw}
              keyboardType="number-pad"
              placeholder={t("gacha.report.pricePlaceholder")}
              placeholderTextColor={TEXT_GRAY}
            />
          </View>

          {/* 제출 버튼 */}
          <TouchableOpacity
            style={[styles.submitBtn, isSubmitting && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color={WHITE} size="small" />
            ) : (
              <Text style={styles.submitBtnText}>{t("gacha.report.submitBtn")}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
            <Text style={styles.cancelBtnText}>{t("gacha.report.cancelBtn")}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {selectedProduct?.official_image_url && (
        <ImageViewerModal
          images={[selectedProduct.official_image_url]}
          initialIndex={0}
          visible={showImageViewer}
          onClose={() => setShowImageViewer(false)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: GRAY_200,
  },
  backBtn: {
    paddingHorizontal: 16,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  backBtnText: {
    fontSize: 24,
    color: TEXT_DARK,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
    color: TEXT_DARK,
  },
  ocrFailBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: GRAY_100,
    borderRadius: 8,
  },
  ocrFailText: {
    fontSize: 13,
    color: TEXT_GRAY,
    lineHeight: 18,
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    zIndex: 20,
    backgroundColor: WHITE,
    overflow: "visible",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  scanBtn: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: GRAY_100,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  scanBtnDisabled: {
    opacity: 0.5,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  candidatesBox: {
    backgroundColor: PRIMARY_BG,
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  candidatesLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: TEXT_DARK,
    marginBottom: 2,
  },
  candidateReportRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: WHITE,
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: PRIMARY,
  },
  candidateReportIcon: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  candidateReportIconText: {
    fontSize: 22,
    color: WHITE,
    lineHeight: 26,
  },
  candidateReportLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: PRIMARY,
  },
  candidateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: WHITE,
    borderRadius: 8,
    padding: 8,
  },
  candidateThumb: {
    width: 44,
    height: 44,
    borderRadius: 6,
    flexShrink: 0,
  },
  candidateName: {
    fontSize: 13,
    fontWeight: "600",
    color: TEXT_DARK,
  },
  candidateMfr: {
    fontSize: 11,
    color: TEXT_GRAY,
    marginTop: 2,
  },
  selectedCard: {
    backgroundColor: GRAY_100,
    borderRadius: 8,
    padding: 12,
  },
  selectedCardRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  selectedThumbnail: {
    width: 64,
    height: 64,
    borderRadius: 8,
    flexShrink: 0,
  },
  selectedThumbnailPlaceholder: {
    backgroundColor: THUMBNAIL_PLACEHOLDER,
  },
  selectedInfo: {
    flex: 1,
    gap: 4,
  },
  selectedLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: TEXT_DARK,
  },
  selectedNameJa: {
    fontSize: 12,
    color: TEXT_GRAY,
  },
  observationThumb: {
    backgroundColor: GRAY_200,
    alignItems: "center",
    justifyContent: "center",
  },
  observationThumbText: {
    fontSize: 24,
    color: TEXT_GRAY,
  },
  observationTag: {
    alignSelf: "flex-start",
    backgroundColor: GRAY_200,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 2,
  },
  observationTagText: {
    fontSize: 11,
    color: TEXT_GRAY,
    fontWeight: "600",
  },
  manufacturerTag: {
    alignSelf: "flex-start",
    backgroundColor: GRAY_200,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 2,
  },
  manufacturerTagText: {
    fontSize: 11,
    color: TEXT_GRAY,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: TEXT_DARK,
  },
  input: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: TEXT_DARK,
    backgroundColor: WHITE,
  },
  submitBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: WHITE,
  },
  cancelBtn: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  cancelBtnText: {
    fontSize: 15,
    color: TEXT_GRAY,
  },
});
