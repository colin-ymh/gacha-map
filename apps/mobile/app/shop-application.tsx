import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { GlassBackButton } from "@/components/ui/GlassBackButton";
import { LiquidGlass } from "@/components/ui/LiquidGlass";
import { useLiquidGlassPress } from "@/hooks/useLiquidGlassPress";
import { Ionicons } from "@expo/vector-icons";
import { getAuthHeaders } from "@/lib/supabase";
import { formatBizReg, formatKoreanPhone } from "@gacha-map/shared";
import { useAppSelector } from "@/store/hooks";
import LoginModal from "@/components/ui/LoginModal";
import {
  PRIMARY,
  PRIMARY_BG_SOFT,
  TEXT_DARK,
  TEXT_GRAY,
  TEXT_PLACEHOLDER,
  WHITE,
  GRAY_100,
  WARNING_BG,
  WARNING_TEXT,
} from "@/constants/colors";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

export default function ShopApplicationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { shopId, shopName: rawShopName } = useLocalSearchParams<{
    shopId?: string;
    shopName?: string;
  }>();
  const shopName = rawShopName ? decodeURIComponent(rawShopName) : "";
  const isClaim = !!shopId;
  const isLoggedIn = useAppSelector((s) => s.auth.isLoggedIn);
  const { t } = useTranslation();

  const [bizReg, setBizReg] = useState("");
  const [repName, setRepName] = useState("");
  const [phone, setPhone] = useState("");
  const [shopNameInput, setShopNameInput] = useState("");
  const [address, setAddress] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(!isLoggedIn);

  const validate = () => {
    const next: Record<string, string> = {};
    if (!bizReg.trim()) next.bizReg = t("shopApplication.validationBizReg");
    if (!repName.trim()) next.repName = t("shopApplication.validationRepName");
    if (!phone.trim()) next.phone = t("shopApplication.validationPhone");
    if (!isClaim) {
      if (!shopNameInput.trim())
        next.shopName = t("shopApplication.validationShopName");
      if (!address.trim())
        next.address = t("shopApplication.validationAddress");
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const isSubmitDisabled =
    !bizReg.trim() || !repName.trim() || !phone.trim() ||
    (!isClaim && (!shopNameInput.trim() || !address.trim()));

  const handleSubmit = async () => {
    if (!isLoggedIn) {
      setShowLoginModal(true);
      return;
    }
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const authHeaders = await getAuthHeaders();
      const body: Record<string, unknown> = {
        type: isClaim ? "claim_shop" : "new_shop",
        business_registration_number: bizReg.trim(),
        representative_name: repName.trim(),
        phone_number: phone.trim(),
        message: message.trim() || undefined,
      };
      if (isClaim) {
        body.shop_id = shopId;
      } else {
        body.shop_name = shopNameInput.trim();
        body.address = address.trim();
      }

      const res = await fetch(`${API_BASE}/api/shop-applications`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.status === 409) {
        Alert.alert(
          t("shopApplication.errorTitle"),
          t("shopApplication.errorDuplicate"),
        );
        return;
      }
      if (!res.ok) throw new Error();

      Alert.alert(
        t("shopApplication.successTitle"),
        t("shopApplication.success"),
        [{ text: t("shopApplication.confirm"), onPress: () => router.back() }],
      );
    } catch {
      Alert.alert(t("shopApplication.errorTitle"), t("shopApplication.error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: GRAY_100 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* 플로팅 버튼 row */}
      <View style={[styles.floatRow, { top: insets.top + 8 }]} pointerEvents="box-none">
        <GlassBackButton onPress={() => router.back()} />
        <GlassSubmitButton
          onPress={handleSubmit}
          isLoading={isSubmitting}
          enabled={!isSubmitDisabled}
        />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.content, { paddingTop: insets.top + 64 }]}>
          {/* claim 대상 샵 표시 */}
          {isClaim && shopName ? (
            <View style={styles.contextBanner}>
              <Text style={{ fontSize: 12, color: TEXT_GRAY, marginBottom: 2 }}>
                {t("shopApplication.targetShopLabel")}
              </Text>
              <Text style={{ fontSize: 15, fontWeight: "600", color: PRIMARY }}>
                {shopName}
              </Text>
            </View>
          ) : null}

          {/* 안내 박스 */}
          <View style={styles.warnCard}>
            <Text style={{ fontSize: 13, color: WARNING_TEXT, lineHeight: 20 }}>
              {t("shopApplication.infoText")}
            </Text>
          </View>

          {/* 사업자등록번호 */}
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>
              {t("shopApplication.bizRegLabel")}{" "}
              <Text style={{ color: PRIMARY }}>*</Text>
            </Text>
            <TextInput
              style={[styles.inputField, errors.bizReg && styles.inputError]}
              placeholder={t("shopApplication.bizRegPlaceholder")}
              placeholderTextColor={TEXT_PLACEHOLDER}
              value={bizReg}
              onChangeText={(v) => setBizReg(formatBizReg(v))}
              maxLength={12}
              keyboardType="numeric"
            />
            {errors.bizReg ? (
              <Text style={styles.errorText}>{errors.bizReg}</Text>
            ) : null}
          </View>

          {/* 대표자명 */}
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>
              {t("shopApplication.repNameLabel")}{" "}
              <Text style={{ color: PRIMARY }}>*</Text>
            </Text>
            <TextInput
              style={[styles.inputField, errors.repName && styles.inputError]}
              placeholder={t("shopApplication.repNamePlaceholder")}
              placeholderTextColor={TEXT_PLACEHOLDER}
              value={repName}
              onChangeText={setRepName}
              maxLength={50}
            />
            {errors.repName ? (
              <Text style={styles.errorText}>{errors.repName}</Text>
            ) : null}
          </View>

          {/* 전화번호 */}
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>
              {t("shopApplication.phoneLabel")}{" "}
              <Text style={{ color: PRIMARY }}>*</Text>
            </Text>
            <TextInput
              style={[styles.inputField, errors.phone && styles.inputError]}
              placeholder={t("shopApplication.phonePlaceholder")}
              placeholderTextColor={TEXT_PLACEHOLDER}
              value={phone}
              onChangeText={(v) => setPhone(formatKoreanPhone(v))}
              keyboardType="phone-pad"
              maxLength={20}
            />
            {errors.phone ? (
              <Text style={styles.errorText}>{errors.phone}</Text>
            ) : null}
          </View>

          {/* new_shop 전용 필드 */}
          {!isClaim && (
            <>
              <View style={styles.card}>
                <Text style={styles.fieldLabel}>
                  {t("shopApplication.shopNameLabel")}{" "}
                  <Text style={{ color: PRIMARY }}>*</Text>
                </Text>
                <TextInput
                  style={[styles.inputField, errors.shopName && styles.inputError]}
                  placeholder={t("shopApplication.shopNamePlaceholder")}
                  placeholderTextColor={TEXT_PLACEHOLDER}
                  value={shopNameInput}
                  onChangeText={setShopNameInput}
                  maxLength={100}
                />
                {errors.shopName ? (
                  <Text style={styles.errorText}>{errors.shopName}</Text>
                ) : null}
              </View>

              <View style={styles.card}>
                <Text style={styles.fieldLabel}>
                  {t("shopApplication.addressLabel")}{" "}
                  <Text style={{ color: PRIMARY }}>*</Text>
                </Text>
                <TextInput
                  style={[styles.inputField, errors.address && styles.inputError]}
                  placeholder={t("shopApplication.addressPlaceholder")}
                  placeholderTextColor={TEXT_PLACEHOLDER}
                  value={address}
                  onChangeText={setAddress}
                  maxLength={200}
                />
                {errors.address ? (
                  <Text style={styles.errorText}>{errors.address}</Text>
                ) : null}
              </View>
            </>
          )}

          {/* 추가 메시지 */}
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>
              {t("shopApplication.messageLabel")}
            </Text>
            <TextInput
              style={[styles.inputField, styles.textarea]}
              placeholder={t("shopApplication.messagePlaceholder")}
              placeholderTextColor={TEXT_PLACEHOLDER}
              value={message}
              onChangeText={setMessage}
              multiline
              maxLength={500}
              textAlignVertical="top"
            />
          </View>
        </View>
      </ScrollView>

      <LoginModal
        visible={showLoginModal}
        onClose={() => {
          setShowLoginModal(false);
          if (!isLoggedIn) router.back();
        }}
        onLoginPress={() => {
          setShowLoginModal(false);
          router.push("/login" as never);
        }}
      />
    </KeyboardAvoidingView>
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
  contextBanner: {
    backgroundColor: PRIMARY_BG_SOFT,
    borderRadius: 12,
    padding: 14,
  },
  warnCard: {
    backgroundColor: WARNING_BG,
    borderRadius: 12,
    padding: 14,
  },
  card: {
    backgroundColor: WHITE,
    borderRadius: 12,
    padding: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: TEXT_DARK,
    marginBottom: 10,
  },
  inputField: {
    backgroundColor: GRAY_100,
    borderRadius: 8,
    height: 44,
    paddingHorizontal: 14,
    fontSize: 14,
    color: TEXT_DARK,
  },
  inputError: {
    borderWidth: 1,
    borderColor: PRIMARY,
  },
  textarea: {
    height: 100,
    paddingTop: 12,
  },
  errorText: {
    fontSize: 12,
    color: PRIMARY,
    marginTop: 4,
  },
});
