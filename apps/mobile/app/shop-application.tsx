import {
  View,
  Text,
  TextInput,
  ScrollView,
  Alert,
  StyleSheet,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useState, useEffect, useCallback } from "react";
import { Pressable, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { useTranslation } from "react-i18next";
import { GlassBackButton } from "@/components/ui/GlassBackButton";
import { GlassSubmitButton } from "@/components/ui/GlassSubmitButton";
import { getAuthHeaders } from "@/lib/supabase";
import {
  formatBizReg,
  formatKoreanPhone,
  validateBizReg,
} from "@gacha-map/shared";
import { useAppSelector } from "@/store/hooks";
import LoginModal from "@/components/ui/LoginModal";
import {
  consumeLocationPickerResult,
  clearLocationPickerResult,
} from "@/lib/locationPickerResult";
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

/**
 * 서버가 내려주는 error code -> i18n 키.
 * 서버(apps/web/src/app/api/shop-applications/route.ts)의 fail() code와 1:1이다.
 * 모르는 code는 generic 문구로 폴백한다.
 */
const ERROR_CODE_KEYS: Record<string, string> = {
  biz_reg_invalid_length: "shopApplication.errorBizRegLength",
  biz_reg_invalid_checksum: "shopApplication.errorBizRegChecksum",
  consent_required: "shopApplication.errorConsentRequired",
  geocode_failed: "shopApplication.errorGeocodeFailed",
  shop_already_owned: "shopApplication.errorShopAlreadyOwned",
  shop_not_active: "shopApplication.errorShopNotActive",
  shop_not_found: "shopApplication.errorShopNotFound",
  duplicate_pending: "shopApplication.errorDuplicate",
  profanity: "shopApplication.errorProfanity",
  document_required: "shopApplication.errorDocumentRequired",
  document_too_large: "shopApplication.errorDocumentTooLarge",
  document_invalid_type: "shopApplication.errorDocumentInvalidType",
  too_many_documents: "shopApplication.errorTooManyDocuments",
  document_upload_failed: "shopApplication.errorDocumentUploadFailed",
};

type Coords = { lat: number; lng: number; address: string | null };

/** 서버(business-docs 버킷)와 동일한 상한. */
const MAX_DOCUMENTS = 3;

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

  const [coords, setCoords] = useState<Coords | null>(null);
  const [geocodeState, setGeocodeState] = useState<
    "idle" | "loading" | "failed"
  >("idle");
  const [consent, setConsent] = useState(false);
  const [documents, setDocuments] = useState<string[]>([]);

  const pickDocuments = useCallback(async () => {
    const remaining = MAX_DOCUMENTS - documents.length;
    if (remaining <= 0) return;

    // quality:1로 원본을 받고 압축은 아래 JS 단계에서 한다.
    // 네이티브 압축 exporter가 일부 삼성 기기에서 피커 promise를 멈춘다.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 1,
    });
    if (result.canceled) return;

    const compressed = await Promise.all(
      result.assets.map(async (asset) => {
        try {
          const fixed = await ImageManipulator.manipulateAsync(
            asset.uri,
            [{ resize: { width: 1800 } }],
            { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
          );
          return fixed.uri;
        } catch {
          return asset.uri;
        }
      }),
    );

    setDocuments((prev) => [...prev, ...compressed].slice(0, MAX_DOCUMENTS));
  }, [documents.length]);

  const removeDocument = (uri: string) =>
    setDocuments((prev) => prev.filter((u) => u !== uri));

  // 주소를 입력하면 서버 지오코딩으로 좌표를 미리 잡아둔다.
  // 좌표 없이 승인되면 샵이 0,0에 생성되므로 신청 단계에서 반드시 확보해야 한다.
  useEffect(() => {
    if (isClaim) return;
    const query = address.trim();
    if (!query || !API_BASE) {
      setCoords(null);
      setGeocodeState("idle");
      return;
    }

    setGeocodeState("loading");
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/geocode/forward?query=${encodeURIComponent(query)}`,
        );
        const data = (await res.json()) as {
          results?: Array<{
            lat: number;
            lng: number;
            roadAddress?: string;
            jibunAddress?: string;
          }>;
        };
        const first = data.results?.[0];
        if (first) {
          setCoords({
            lat: first.lat,
            lng: first.lng,
            address: first.roadAddress ?? first.jibunAddress ?? null,
          });
          setGeocodeState("idle");
        } else {
          setCoords(null);
          setGeocodeState("failed");
        }
      } catch {
        setCoords(null);
        setGeocodeState("failed");
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [address, isClaim]);

  // 지도 피커에서 돌아왔을 때 결과를 회수한다.
  // source를 지정해야 report 화면의 잔여 결과가 새어들지 않는다.
  useFocusEffect(
    useCallback(() => {
      const picked = consumeLocationPickerResult("shop-application");
      if (picked) {
        setCoords({
          lat: picked.lat,
          lng: picked.lng,
          address: picked.address,
        });
        setGeocodeState("idle");
      }
    }, []),
  );

  const openLocationPicker = () => {
    // 이전 화면이 남긴 미소비 결과를 버리고 들어간다.
    clearLocationPickerResult();
    const query = coords
      ? `&initialLat=${coords.lat}&initialLng=${coords.lng}`
      : "";
    router.push(
      `/report-location-picker?source=shop-application${query}` as never,
    );
  };

  const validate = () => {
    const next: Record<string, string> = {};

    if (!bizReg.trim()) {
      next.bizReg = t("shopApplication.validationBizReg");
    } else if (validateBizReg(bizReg)) {
      next.bizReg = t("shopApplication.validationBizRegInvalid");
    }

    if (!repName.trim()) next.repName = t("shopApplication.validationRepName");
    if (!phone.trim()) next.phone = t("shopApplication.validationPhone");
    if (!isClaim) {
      if (!shopNameInput.trim())
        next.shopName = t("shopApplication.validationShopName");
      if (!address.trim())
        next.address = t("shopApplication.validationAddress");
      if (!coords) next.location = t("shopApplication.validationLocation");
      // 새 샵 등록은 관리자가 대조할 근거가 없으므로 사업자등록증이 필수다.
      if (documents.length === 0)
        next.documents = t("shopApplication.validationDocuments");
    }
    if (!consent) next.consent = t("shopApplication.validationConsent");

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const isSubmitDisabled =
    !bizReg.trim() ||
    !repName.trim() ||
    !phone.trim() ||
    !consent ||
    (!isClaim &&
      (!shopNameInput.trim() ||
        !address.trim() ||
        !coords ||
        documents.length === 0));

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
        // 서버는 동의 '시각'을 직접 now()로 기록한다. 여기서는 동의 여부만 보낸다.
        consent_privacy: true,
      };
      if (isClaim) {
        body.shop_id = shopId;
      } else {
        body.shop_name = shopNameInput.trim();
        body.address = address.trim();
        body.lat = coords?.lat;
        body.lng = coords?.lng;
      }

      // 서류가 있으면 multipart(payload + documents), 없으면 JSON.
      // Content-Type을 직접 지정하지 않는다 — multipart boundary는 런타임이 붙인다.
      let res: Response;
      if (documents.length > 0) {
        const form = new FormData();
        form.append("payload", JSON.stringify(body));
        documents.forEach((uri, i) => {
          form.append("documents", {
            uri,
            name: `bizreg-${i}.jpg`,
            type: "image/jpeg",
          } as unknown as Blob);
        });
        res = await fetch(`${API_BASE}/api/shop-applications`, {
          method: "POST",
          headers: authHeaders,
          body: form,
        });
      } else {
        res = await fetch(`${API_BASE}/api/shop-applications`, {
          method: "POST",
          headers: { ...authHeaders, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) {
        // 서버가 내려준 code로 구체적인 문구를 고른다. 모르는 code면 generic.
        const payload = (await res.json().catch(() => null)) as {
          code?: string;
        } | null;
        const key = payload?.code ? ERROR_CODE_KEYS[payload.code] : undefined;
        Alert.alert(
          t("shopApplication.errorTitle"),
          key ? t(key) : t("shopApplication.error"),
        );
        return;
      }

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
      <View
        style={[styles.floatRow, { top: insets.top + 8 }]}
        pointerEvents="box-none"
      >
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
          {/* 화면 제목 — 사업자가 무엇을 신청하는지 명시 */}
          <View style={styles.titleBlock}>
            <Text style={styles.screenTitle}>
              {isClaim
                ? t("shopApplication.titleClaim")
                : t("shopApplication.titleNew")}
            </Text>
            <Text style={styles.screenSubtitle}>
              {t("shopApplication.sectionLabel")}
            </Text>
          </View>

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
                  style={[
                    styles.inputField,
                    errors.shopName && styles.inputError,
                  ]}
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
                  style={[
                    styles.inputField,
                    errors.address && styles.inputError,
                  ]}
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

              {/* 위치 확인 카드
                  좌표 없이 승인되면 샵이 0,0에 생성되므로 여기서 반드시 확보한다. */}
              <View style={styles.card}>
                <Text style={styles.fieldLabel}>
                  {t("shopApplication.locationLabel")}{" "}
                  <Text style={{ color: PRIMARY }}>*</Text>
                </Text>

                {geocodeState === "loading" ? (
                  <Text style={styles.locationHint}>
                    {t("shopApplication.locationSearching")}
                  </Text>
                ) : coords ? (
                  <View style={styles.locationOk}>
                    <Ionicons
                      name="location"
                      size={16}
                      color={PRIMARY}
                      style={{ marginTop: 1 }}
                    />
                    <Text style={styles.locationOkText}>
                      {coords.address ??
                        `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.locationWarn}>
                    <Text style={styles.locationWarnText}>
                      {address.trim()
                        ? t("shopApplication.locationFailed")
                        : t("shopApplication.locationEmpty")}
                    </Text>
                  </View>
                )}

                <Pressable
                  style={styles.locationButton}
                  onPress={openLocationPicker}
                >
                  <Ionicons name="map-outline" size={16} color={PRIMARY} />
                  <Text style={styles.locationButtonText}>
                    {t("shopApplication.locationEditButton")}
                  </Text>
                </Pressable>

                {errors.location ? (
                  <Text style={styles.errorText}>{errors.location}</Text>
                ) : null}
              </View>
            </>
          )}

          {/* 증빙 서류 (사업자등록증)
              new_shop은 필수, claim_shop은 선택. 비공개 버킷에 저장되고
              관리자만 단기 서명 URL로 열람한다. */}
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>
              {t("shopApplication.documentsLabel")}
              {!isClaim ? <Text style={{ color: PRIMARY }}> *</Text> : null}
            </Text>
            <Text style={styles.documentsHint}>
              {t("shopApplication.documentsHint")}
            </Text>

            {documents.length > 0 ? (
              <View style={styles.documentsRow}>
                {documents.map((uri) => (
                  <View key={uri} style={styles.documentThumbWrap}>
                    <Image
                      source={{ uri }}
                      style={styles.documentThumb}
                      resizeMode="cover"
                    />
                    <Pressable
                      style={styles.documentRemove}
                      onPress={() => removeDocument(uri)}
                      accessibilityLabel={t("shopApplication.documentsRemove")}
                    >
                      <Ionicons name="close" size={14} color={WHITE} />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}

            {documents.length < MAX_DOCUMENTS ? (
              <Pressable style={styles.locationButton} onPress={pickDocuments}>
                <Ionicons name="camera-outline" size={16} color={PRIMARY} />
                <Text style={styles.locationButtonText}>
                  {t("shopApplication.documentsPick")}
                </Text>
              </Pressable>
            ) : null}

            {errors.documents ? (
              <Text style={styles.errorText}>{errors.documents}</Text>
            ) : null}
          </View>

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

          {/* 개인정보 수집·이용 동의 (필수)
              대표자명·전화번호·사업자등록번호를 수집하므로 동의 없이는 제출할 수 없다.
              동의 '시각'은 서버가 기록한다(클라이언트 값은 위조 가능). */}
          <View style={styles.card}>
            <Pressable
              style={styles.consentRow}
              onPress={() => setConsent((v) => !v)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: consent }}
            >
              <Ionicons
                name={consent ? "checkbox" : "square-outline"}
                size={22}
                color={consent ? PRIMARY : TEXT_PLACEHOLDER}
              />
              <Text style={styles.consentLabel}>
                {t("shopApplication.consentLabel")}{" "}
                <Text style={{ color: PRIMARY }}>*</Text>
              </Text>
            </Pressable>
            <Text style={styles.consentDetail}>
              {t("shopApplication.consentDetail")}
            </Text>
            {errors.consent ? (
              <Text style={styles.errorText}>{errors.consent}</Text>
            ) : null}
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
  titleBlock: {
    paddingHorizontal: 4,
    marginBottom: 2,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: TEXT_DARK,
  },
  screenSubtitle: {
    fontSize: 13,
    color: TEXT_GRAY,
    marginTop: 4,
  },
  locationHint: {
    fontSize: 13,
    color: TEXT_GRAY,
  },
  locationOk: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: PRIMARY_BG_SOFT,
    borderRadius: 8,
    padding: 12,
  },
  locationOkText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: TEXT_DARK,
  },
  locationWarn: {
    backgroundColor: WARNING_BG,
    borderRadius: 8,
    padding: 12,
  },
  locationWarnText: {
    fontSize: 13,
    lineHeight: 19,
    color: WARNING_TEXT,
  },
  locationButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 10,
    height: 40,
    borderRadius: 8,
    backgroundColor: GRAY_100,
  },
  locationButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: PRIMARY,
  },
  consentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  consentLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: TEXT_DARK,
  },
  consentDetail: {
    fontSize: 12,
    lineHeight: 18,
    color: TEXT_GRAY,
    marginTop: 8,
  },
  documentsHint: {
    fontSize: 12,
    lineHeight: 18,
    color: TEXT_GRAY,
    marginTop: -4,
    marginBottom: 10,
  },
  documentsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 4,
  },
  documentThumbWrap: {
    width: 72,
    height: 72,
  },
  documentThumb: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: GRAY_100,
  },
  documentRemove: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: TEXT_DARK,
    alignItems: "center",
    justifyContent: "center",
  },
});
