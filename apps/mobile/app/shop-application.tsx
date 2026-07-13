import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { GlassBackButton } from "@/components/ui/GlassBackButton";
import { getAuthHeaders } from "@/lib/supabase";
import { formatBizReg, formatKoreanPhone } from "@gacha-map/shared";
import { useAppSelector } from "@/store/hooks";
import LoginModal from "@/components/ui/LoginModal";
import {
  PRIMARY,
  PRIMARY_BG_SOFT,
  TEXT_DARK,
  TEXT_GRAY,
  BORDER,
  PLACEHOLDER_LIGHT,
  WHITE,
  WARNING_BG,
  WARNING_TEXT,
} from "@/constants/colors";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

export default function ShopApplicationScreen() {
  const router = useRouter();
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
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: WHITE }}>
      {/* 헤더 */}
      <View
        style={{
          height: 52,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <GlassBackButton onPress={() => router.back()} />
        <Text
          style={{
            flex: 1,
            textAlign: "center",
            fontSize: 16,
            fontWeight: "700",
            color: TEXT_DARK,
          }}
        >
          {isClaim
            ? t("shopApplication.titleClaim")
            : t("shopApplication.titleNew")}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View
          style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40 }}
        >
          {/* claim 대상 샵 표시 */}
          {isClaim && shopName ? (
            <View
              style={{
                marginBottom: 20,
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: PRIMARY_BG_SOFT,
              }}
            >
              <Text style={{ fontSize: 12, color: TEXT_GRAY, marginBottom: 2 }}>
                {t("shopApplication.targetShopLabel")}
              </Text>
              <Text
                style={{ fontSize: 15, fontWeight: "600", color: TEXT_DARK }}
              >
                {shopName}
              </Text>
            </View>
          ) : null}

          {/* 안내 박스 */}
          <View
            style={{
              marginBottom: 20,
              paddingHorizontal: 14,
              paddingVertical: 12,
              borderRadius: 10,
              backgroundColor: WARNING_BG,
            }}
          >
            <Text style={{ fontSize: 13, color: WARNING_TEXT, lineHeight: 20 }}>
              {t("shopApplication.infoText")}
            </Text>
          </View>

          <Text
            style={{
              fontSize: 13,
              fontWeight: "600",
              color: TEXT_GRAY,
              marginBottom: 16,
            }}
          >
            {t("shopApplication.sectionLabel")}
          </Text>

          {/* 사업자등록번호 */}
          <View style={{ marginBottom: 14 }}>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: TEXT_DARK,
                marginBottom: 6,
              }}
            >
              {t("shopApplication.bizRegLabel")}{" "}
              <Text style={{ color: PRIMARY }}>*</Text>
            </Text>
            <TextInput
              style={{
                height: 44,
                borderWidth: 1,
                borderColor: errors.bizReg ? PRIMARY : BORDER,
                borderRadius: 8,
                paddingHorizontal: 14,
                fontSize: 14,
                color: TEXT_DARK,
              }}
              placeholder={t("shopApplication.bizRegPlaceholder")}
              placeholderTextColor={PLACEHOLDER_LIGHT}
              value={bizReg}
              onChangeText={(v) => setBizReg(formatBizReg(v))}
              maxLength={12}
              keyboardType="numeric"
            />
            {errors.bizReg ? (
              <Text style={{ fontSize: 12, color: PRIMARY, marginTop: 4 }}>
                {errors.bizReg}
              </Text>
            ) : null}
          </View>

          {/* 대표자명 */}
          <View style={{ marginBottom: 14 }}>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: TEXT_DARK,
                marginBottom: 6,
              }}
            >
              {t("shopApplication.repNameLabel")}{" "}
              <Text style={{ color: PRIMARY }}>*</Text>
            </Text>
            <TextInput
              style={{
                height: 44,
                borderWidth: 1,
                borderColor: errors.repName ? PRIMARY : BORDER,
                borderRadius: 8,
                paddingHorizontal: 14,
                fontSize: 14,
                color: TEXT_DARK,
              }}
              placeholder={t("shopApplication.repNamePlaceholder")}
              placeholderTextColor={PLACEHOLDER_LIGHT}
              value={repName}
              onChangeText={setRepName}
              maxLength={50}
            />
            {errors.repName ? (
              <Text style={{ fontSize: 12, color: PRIMARY, marginTop: 4 }}>
                {errors.repName}
              </Text>
            ) : null}
          </View>

          {/* 전화번호 */}
          <View style={{ marginBottom: 14 }}>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: TEXT_DARK,
                marginBottom: 6,
              }}
            >
              {t("shopApplication.phoneLabel")}{" "}
              <Text style={{ color: PRIMARY }}>*</Text>
            </Text>
            <TextInput
              style={{
                height: 44,
                borderWidth: 1,
                borderColor: errors.phone ? PRIMARY : BORDER,
                borderRadius: 8,
                paddingHorizontal: 14,
                fontSize: 14,
                color: TEXT_DARK,
              }}
              placeholder={t("shopApplication.phonePlaceholder")}
              placeholderTextColor={PLACEHOLDER_LIGHT}
              value={phone}
              onChangeText={(v) => setPhone(formatKoreanPhone(v))}
              keyboardType="phone-pad"
              maxLength={20}
            />
            {errors.phone ? (
              <Text style={{ fontSize: 12, color: PRIMARY, marginTop: 4 }}>
                {errors.phone}
              </Text>
            ) : null}
          </View>

          {/* new_shop 전용 필드 */}
          {!isClaim && (
            <>
              <View style={{ marginBottom: 14 }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "600",
                    color: TEXT_DARK,
                    marginBottom: 6,
                  }}
                >
                  {t("shopApplication.shopNameLabel")}{" "}
                  <Text style={{ color: PRIMARY }}>*</Text>
                </Text>
                <TextInput
                  style={{
                    height: 44,
                    borderWidth: 1,
                    borderColor: errors.shopName ? PRIMARY : BORDER,
                    borderRadius: 8,
                    paddingHorizontal: 14,
                    fontSize: 14,
                    color: TEXT_DARK,
                  }}
                  placeholder={t("shopApplication.shopNamePlaceholder")}
                  placeholderTextColor={PLACEHOLDER_LIGHT}
                  value={shopNameInput}
                  onChangeText={setShopNameInput}
                  maxLength={100}
                />
                {errors.shopName ? (
                  <Text style={{ fontSize: 12, color: PRIMARY, marginTop: 4 }}>
                    {errors.shopName}
                  </Text>
                ) : null}
              </View>

              <View style={{ marginBottom: 14 }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "600",
                    color: TEXT_DARK,
                    marginBottom: 6,
                  }}
                >
                  {t("shopApplication.addressLabel")}{" "}
                  <Text style={{ color: PRIMARY }}>*</Text>
                </Text>
                <TextInput
                  style={{
                    height: 44,
                    borderWidth: 1,
                    borderColor: errors.address ? PRIMARY : BORDER,
                    borderRadius: 8,
                    paddingHorizontal: 14,
                    fontSize: 14,
                    color: TEXT_DARK,
                  }}
                  placeholder={t("shopApplication.addressPlaceholder")}
                  placeholderTextColor={PLACEHOLDER_LIGHT}
                  value={address}
                  onChangeText={setAddress}
                  maxLength={200}
                />
                {errors.address ? (
                  <Text style={{ fontSize: 12, color: PRIMARY, marginTop: 4 }}>
                    {errors.address}
                  </Text>
                ) : null}
              </View>
            </>
          )}

          {/* 추가 메시지 */}
          <View style={{ marginBottom: 28 }}>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: TEXT_DARK,
                marginBottom: 6,
              }}
            >
              {t("shopApplication.messageLabel")}
            </Text>
            <TextInput
              style={{
                height: 100,
                borderWidth: 1,
                borderColor: BORDER,
                borderRadius: 8,
                paddingHorizontal: 14,
                paddingTop: 12,
                fontSize: 14,
                color: TEXT_DARK,
              }}
              placeholder={t("shopApplication.messagePlaceholder")}
              placeholderTextColor={PLACEHOLDER_LIGHT}
              value={message}
              onChangeText={setMessage}
              multiline
              maxLength={500}
              textAlignVertical="top"
            />
          </View>

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isSubmitting}
            style={{
              height: 50,
              borderRadius: 25,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: isSubmitting ? BORDER : PRIMARY,
            }}
          >
            {isSubmitting ? (
              <ActivityIndicator color={WHITE} />
            ) : (
              <Text style={{ fontSize: 16, fontWeight: "700", color: WHITE }}>
                {isClaim
                  ? t("shopApplication.submitClaim")
                  : t("shopApplication.submitNew")}
              </Text>
            )}
          </TouchableOpacity>
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
    </SafeAreaView>
  );
}
