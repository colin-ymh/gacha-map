import { useState, useCallback } from "react";
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
import GachaProductSearch from "@/components/organisms/GachaProductSearch";
import type { GachaProduct } from "@gacha-map/shared";
import {
  PRIMARY,
  TEXT_DARK,
  TEXT_GRAY,
  GRAY_100,
  GRAY_200,
  WHITE,
  BORDER,
  THUMBNAIL_PLACEHOLDER,
} from "@/constants/colors";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

export default function GachaReportScreen() {
  const router = useRouter();
  const { shopId } = useLocalSearchParams<{ shopId: string }>();
  const { t } = useTranslation();

  const [inputMode, setInputMode] = useState<"search" | "manual">("search");
  const [selectedProduct, setSelectedProduct] = useState<GachaProduct | null>(
    null,
  );
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [priceKrw, setPriceKrw] = useState("");
  const [manualName, setManualName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    try {
      const { getAuthHeaders } = await import("@/lib/supabase");
      const headers = await getAuthHeaders();

      if (inputMode === "manual") {
        const trimmedName = manualName.trim();
        if (!trimmedName) {
          Alert.alert(t("gacha.report.manualInputError"));
          return;
        }
        const res = await fetch(`${API_BASE}/api/reports`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({
            report_type: "other",
            shop_id: shopId,
            content: `[가챠 상품 직접 입력] ${trimmedName}`,
          }),
        });
        if (!res.ok) throw new Error();
        Alert.alert(t("gacha.report.manualInputSuccess"));
        router.back();
        return;
      }

      if (!selectedProduct) {
        Alert.alert(t("gacha.report.errorRequired"));
        return;
      }

      const body: Record<string, unknown> = {
        gacha_product_id: selectedProduct.id,
      };
      const parsed = parseInt(priceKrw, 10);
      if (!isNaN(parsed) && parsed >= 0) {
        body.price_krw = parsed;
      }

      const res = await fetch(
        `${API_BASE}/api/shops/${shopId}/gacha-products`,
        {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );

      if (!res.ok) {
        const errBody = (res.headers.get("content-type") ?? "").includes(
          "application/json",
        )
          ? await res.json().catch(() => ({}))
          : {};
        throw new Error(errBody.error ?? "");
      }
      Alert.alert(t("gacha.report.successNew"));
      router.back();
    } catch (err) {
      const msg =
        err instanceof Error && err.message
          ? err.message
          : t("gacha.report.errorRequired");
      Alert.alert(msg);
    } finally {
      setIsSubmitting(false);
    }
  }, [inputMode, selectedProduct, manualName, priceKrw, shopId, router, t]);

  const switchToManual = useCallback(() => {
    setSelectedProduct(null);
    setInputMode("manual");
  }, []);

  const switchToSearch = useCallback(() => {
    setManualName("");
    setInputMode("search");
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

      {/* 검색 섹션: ScrollView 밖에 배치해야 드롭다운 스크롤이 동작함 */}
      {inputMode === "search" && (
        <View style={styles.searchSection}>
          <GachaProductSearch
            placeholder={t("gacha.report.searchPlaceholder")}
            onSelect={(product) => {
              setSelectedProduct(product);
            }}
            onResultsChange={setIsSearchDropdownOpen}
          />
          <TouchableOpacity onPress={switchToManual} style={styles.modeToggle}>
            <Text style={styles.modeToggleText}>
              {t("gacha.report.manualInputBtn")} →
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="none"
        showsVerticalScrollIndicator={false}
        scrollEnabled={!isSearchDropdownOpen}
      >
        <View style={styles.content}>
          {inputMode === "search" ? (
            <>
              {/* 선택된 상품 표시 */}
              {selectedProduct && (
                <View style={styles.selectedCard}>
                  <View style={styles.selectedCardRow}>
                    {selectedProduct.official_image_url ? (
                      <TouchableOpacity
                        onPress={() => setShowImageViewer(true)}
                        activeOpacity={0.85}
                      >
                        <Image
                          source={{ uri: selectedProduct.official_image_url }}
                          style={styles.selectedThumbnail}
                        />
                      </TouchableOpacity>
                    ) : (
                      <View
                        style={[
                          styles.selectedThumbnail,
                          styles.selectedThumbnailPlaceholder,
                        ]}
                      />
                    )}
                    <View style={styles.selectedInfo}>
                      <Text style={styles.selectedLabel} numberOfLines={2}>
                        {selectedProduct.name_ko ??
                          selectedProduct.name_ja ??
                          selectedProduct.name}
                      </Text>
                      {selectedProduct.name_ja != null && (
                        <Text style={styles.selectedNameJa} numberOfLines={2}>
                          {selectedProduct.name_ja}
                        </Text>
                      )}
                      <View style={styles.manufacturerTag}>
                        <Text style={styles.manufacturerTagText}>
                          {selectedProduct.manufacturer}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              )}

              {/* 가격 입력 */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>
                  {t("gacha.report.priceLabel")}
                </Text>
                <TextInput
                  style={styles.input}
                  value={priceKrw}
                  onChangeText={setPriceKrw}
                  keyboardType="number-pad"
                  placeholder={t("gacha.report.pricePlaceholder")}
                  placeholderTextColor={TEXT_GRAY}
                />
              </View>
            </>
          ) : (
            <>
              {/* 검색으로 돌아가기 */}
              <TouchableOpacity
                onPress={switchToSearch}
                style={styles.modeToggle}
              >
                <Text style={styles.modeToggleText}>
                  {t("gacha.report.backToSearch")}
                </Text>
              </TouchableOpacity>

              {/* 직접 입력 필드 */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>
                  {t("gacha.report.manualInputLabel")}
                </Text>
                <TextInput
                  style={styles.input}
                  value={manualName}
                  onChangeText={setManualName}
                  placeholder={t("gacha.report.manualInputPlaceholder")}
                  placeholderTextColor={TEXT_GRAY}
                  autoCorrect={false}
                  autoCapitalize="none"
                />
                <Text style={styles.hintText}>
                  {t("gacha.report.manualInputHint")}
                </Text>
              </View>
            </>
          )}

          {/* 제출 버튼 */}
          <TouchableOpacity
            style={[styles.submitBtn, isSubmitting && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color={WHITE} size="small" />
            ) : (
              <Text style={styles.submitBtnText}>
                {t("gacha.report.submitBtn")}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => router.back()}
          >
            <Text style={styles.cancelBtnText}>
              {t("gacha.report.cancelBtn")}
            </Text>
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
  content: {
    padding: 16,
    gap: 16,
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    zIndex: 20,
    backgroundColor: WHITE,
    overflow: "visible",
  },
  modeToggle: {
    alignSelf: "flex-end",
  },
  modeToggleText: {
    fontSize: 13,
    color: PRIMARY,
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
  hintText: {
    fontSize: 12,
    color: TEXT_GRAY,
    lineHeight: 18,
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
