import { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from "react-native";
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
} from "@/constants/colors";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

export default function GachaReportScreen() {
  const router = useRouter();
  const { shopId } = useLocalSearchParams<{ shopId: string }>();
  const { t } = useTranslation();

  const [selectedProduct, setSelectedProduct] = useState<GachaProduct | null>(
    null,
  );
  const [priceKrw, setPriceKrw] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!selectedProduct) {
      Alert.alert(t("gacha.report.errorRequired"));
      return;
    }

    setIsSubmitting(true);
    try {
      const { getAuthHeaders } = await import("@/lib/supabase");
      const headers = await getAuthHeaders();
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

      if (!res.ok) throw new Error();
      Alert.alert(t("gacha.report.successNew"));
      router.back();
    } catch {
      Alert.alert(t("gacha.report.errorRequired"));
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedProduct, priceKrw, shopId, router, t]);

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

      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          {/* 상품 검색 */}
          <GachaProductSearch
            placeholder={t("gacha.report.searchPlaceholder")}
            onSelect={(product) => {
              setSelectedProduct(product);
            }}
          />

          {/* 선택된 상품 표시 */}
          {selectedProduct && (
            <View style={styles.selectedCard}>
              <Text style={styles.selectedLabel}>
                {selectedProduct.name_ko ??
                  selectedProduct.name_ja ??
                  selectedProduct.name}
              </Text>
              <Text style={styles.selectedSub}>
                {selectedProduct.manufacturer}
              </Text>
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
  selectedCard: {
    backgroundColor: GRAY_100,
    borderRadius: 8,
    padding: 12,
    gap: 2,
  },
  selectedLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: TEXT_DARK,
  },
  selectedSub: {
    fontSize: 12,
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
