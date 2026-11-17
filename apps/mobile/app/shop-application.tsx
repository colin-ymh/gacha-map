import {
  View,
  Text,
  TextInput,
  ScrollView,
  Alert,
  StyleSheet,
  Animated,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useState, useCallback, useEffect, useRef } from "react";
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
import {
  useShopApplicationCandidates,
  type ShopApplicationCandidate,
} from "@gacha-map/shared/src/hooks/useShopApplicationCandidates";
import { useAppSelector } from "@/store/hooks";
import LoginModal from "@/components/ui/LoginModal";
import {
  consumeLocationPickerResult,
  clearLocationPickerResult,
} from "@/lib/locationPickerResult";
import {
  consumeAddressPickerResult,
  clearAddressPickerResult,
} from "@/lib/addressPickerResult";
import {
  PRIMARY,
  PRIMARY_BG_SOFT,
  BLACK,
  TEXT_DARK,
  TEXT_BODY,
  TEXT_GRAY,
  TEXT_PLACEHOLDER,
  WHITE,
  GRAY_100,
  GRAY_200,
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

async function lookupShops(query: string, signal: AbortSignal) {
  const headers = await getAuthHeaders();
  const res = await fetch(
    `${API_BASE}/api/shop-applications/shop-candidates?q=${encodeURIComponent(query)}`,
    { headers, signal },
  );
  if (!res.ok) throw new Error("Shop lookup failed");
  const data: { candidates: ShopApplicationCandidate[] } = await res.json();
  return data.candidates;
}

export default function ShopApplicationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { shopId, shopName: rawShopName } = useLocalSearchParams<{
    shopId?: string;
    shopName?: string;
  }>();
  const [selectedShop, setSelectedShop] =
    useState<ShopApplicationCandidate | null>(null);
  const candidateShop = shopId ? null : selectedShop;
  const targetShopId = shopId || candidateShop?.id;
  const shopName =
    candidateShop?.name ?? (rawShopName ? decodeURIComponent(rawShopName) : "");
  const isClaim = !!targetShopId;
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
  const formRegion = useRef<View>(null);
  const nameAnchor = useRef<View>(null);
  const nameInput = useRef<TextInput>(null);
  const focusNameAfterChange = useRef(false);
  const [nameFocused, setNameFocused] = useState(false);
  const [candidatePosition, setCandidatePosition] = useState<{
    left: number;
    width: number;
    top?: number;
    bottom?: number;
    maxHeight: number;
  } | null>(null);
  const candidates = useShopApplicationCandidates(
    shopNameInput,
    !!API_BASE && isLoggedIn === true && !isClaim,
    lookupShops,
  );
  const showCandidates = nameFocused && !isClaim &&
    (candidates.items.length > 0 || candidates.failed);

  const measureCandidates = useCallback(() => {
    const region = formRegion.current;
    const anchor = nameAnchor.current;
    if (!region || !anchor) return;
    region.measureInWindow((regionX, regionY, _width, height) => {
      anchor.measureInWindow((x, y, width, fieldHeight) => {
        if (nameAnchor.current !== anchor) return;
        const top = y - regionY;
        const bottom = height - top - fieldHeight;
        const header = insets.top + 56;
        if (top + fieldHeight <= header || bottom < 0 || width <= 0) {
          setCandidatePosition(null);
          return;
        }
        const roomBelow = bottom - 6;
        const roomAbove = top - header - 6;
        const alignBelow = roomBelow >= 164 || roomBelow >= roomAbove;
        setCandidatePosition({
          left: x - regionX,
          width,
          ...(alignBelow ? { top: top + fieldHeight + 6 } : { bottom: height - top + 6 }),
          maxHeight: Math.max(0, Math.min(220, alignBelow ? roomBelow : roomAbove)),
        });
      });
    });
  }, [insets.top]);

  useEffect(() => {
    if (showCandidates) measureCandidates();
  }, [measureCandidates, showCandidates]);

  const [coords, setCoords] = useState<Coords | null>(null);
  const geocodeRequest = useRef<AbortController | null>(null);
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

  useEffect(() => () => geocodeRequest.current?.abort(), []);

  // Daum 우편번호 검색이 확정한 주소로 지오코딩을 딱 1번만 호출한다.
  // 타이핑 중 매 pause마다 API를 쏘던 이전 방식(불완전한 주소로도 호출되는
  // 낭비)을 없애고, 위젯이 정확한 도로명주소를 줄 때만 1콜한다.
  const geocodeAddress = useCallback(async (query: string) => {
    geocodeRequest.current?.abort();
    setCoords(null);
    if (!query || !API_BASE) {
      setGeocodeState("idle");
      return;
    }
    const controller = new AbortController();
    geocodeRequest.current = controller;
    setGeocodeState("loading");
    try {
      const res = await fetch(
        `${API_BASE}/api/geocode/forward?query=${encodeURIComponent(query)}`,
        { signal: controller.signal },
      );
      if (!res.ok) throw new Error("Geocoding failed");
      const data = (await res.json()) as {
        results?: Array<{
          lat: number;
          lng: number;
          roadAddress?: string;
          jibunAddress?: string;
        }>;
      };
      if (controller.signal.aborted) return;
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
      if (controller.signal.aborted) return;
      setCoords(null);
      setGeocodeState("failed");
    }
  }, []);

  // 주소 검색(Daum) / 지도 보정, 두 피커에서 돌아왔을 때 결과를 회수한다.
  // source를 지정해야 다른 화면의 잔여 결과가 새어들지 않는다.
  useFocusEffect(
    useCallback(() => {
      const pickedAddress = consumeAddressPickerResult("shop-application");
      if (pickedAddress) {
        setAddress(pickedAddress.address);
        setErrors((prev) => ({ ...prev, address: "", location: "" }));
        geocodeAddress(pickedAddress.address);
        return;
      }

      const pickedLocation = consumeLocationPickerResult("shop-application");
      if (pickedLocation) {
        geocodeRequest.current?.abort();
        setCoords({
          lat: pickedLocation.lat,
          lng: pickedLocation.lng,
          address: pickedLocation.address,
        });
        setGeocodeState("idle");
      }
    }, [geocodeAddress]),
  );

  const openAddressPicker = () => {
    clearAddressPickerResult();
    router.push("/address-picker?source=shop-application" as never);
  };

  const openLocationPicker = () => {
    // 이전 화면이 남긴 미소비 결과를 버리고 들어간다.
    clearLocationPickerResult();
    const coordsQuery = coords
      ? `&initialLat=${coords.lat}&initialLng=${coords.lng}`
      : "";
    const addressQuery = coords?.address
      ? `&initialAddress=${encodeURIComponent(coords.address)}`
      : "";
    router.push(
      `/report-location-picker?source=shop-application${coordsQuery}${addressQuery}` as never,
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
        body.shop_id = targetShopId;
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
      <View
        ref={formRegion}
        collapsable={false}
        style={styles.formRegion}
        onLayout={() => {
          if (showCandidates) measureCandidates();
        }}
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
          onScroll={showCandidates ? measureCandidates : undefined}
          scrollEventThrottle={32}
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
            {shopId && shopName ? (
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

            {!shopId && (
              <View style={styles.card}>
                <Text style={styles.fieldLabel}>
                  {t("shopApplication.shopNameLabel")}{" "}
                  <Text style={{ color: PRIMARY }}>*</Text>
                </Text>
                {candidateShop ? (
                  <View style={styles.selectedName}>
                    <View style={styles.selectedNameText}>
                      <Text style={styles.candidateName}>{candidateShop.name}</Text>
                      {candidateShop.address && (
                        <Text style={styles.candidateAddress}>{candidateShop.address}</Text>
                      )}
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      disabled={isSubmitting}
                      style={styles.candidateAction}
                      onPress={() => {
                      focusNameAfterChange.current = true;
                        setSelectedShop(null);
                        setErrors({});
                      }}
                    >
                      <Text style={styles.locationButtonText}>
                        {t("shopApplication.candidateChange")}
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  <View ref={nameAnchor} collapsable={false} onLayout={() => {
                    if (focusNameAfterChange.current) {
                      focusNameAfterChange.current = false;
                      nameInput.current?.focus();
                    }
                    if (showCandidates) measureCandidates();
                  }}>
                    <TextInput
                      ref={nameInput}
                      style={[styles.inputField, errors.shopName && styles.inputError]}
                      placeholder={t("shopApplication.shopNamePlaceholder")}
                      placeholderTextColor={TEXT_PLACEHOLDER}
                      value={shopNameInput}
                      onChangeText={setShopNameInput}
                      onFocus={() => setNameFocused(true)}
                      onBlur={() => {
                        setNameFocused(false);
                        setCandidatePosition(null);
                      }}
                      maxLength={100}
                    />
                  </View>
                )}
                {errors.shopName ? (
                  <Text style={styles.errorText}>{errors.shopName}</Text>
                ) : null}
              </View>
            )}

            {!isClaim && (
              <>
                {/* 주소 + 위치 확인 (Daum 우편번호 서비스)
                    좌표 없이 승인되면 샵이 0,0에 생성되므로 여기서 반드시 확보한다.
                    자유 텍스트 입력 대신 위젯으로 주소를 확정하고, 그 결과로
                    지오코딩을 1번만 호출한다 — 별도 "위치 확인" 단계를 두지 않는다. */}
                <View style={styles.card}>
                  <Text style={styles.fieldLabel}>
                    {t("shopApplication.addressLabel")}{" "}
                    <Text style={{ color: PRIMARY }}>*</Text>
                  </Text>

                  {coords ? (
                    <>
                      <View style={styles.locationOk}>
                        <Ionicons
                          name="location"
                          size={16}
                          color={PRIMARY}
                          style={{ marginTop: 1 }}
                        />
                        <Text style={styles.locationOkText}>
                          {coords.address ?? address}
                          {"\n"}
                          <Text style={styles.coordHint}>
                            ({coords.lat.toFixed(5)}, {coords.lng.toFixed(5)})
                          </Text>
                        </Text>
                      </View>
                      <View style={styles.addressActionsRow}>
                        <Pressable
                          style={styles.addressActionButton}
                          onPress={openAddressPicker}
                        >
                          <Ionicons
                            name="search-outline"
                            size={16}
                            color={PRIMARY}
                          />
                          <Text style={styles.locationButtonText}>
                            {t("shopApplication.addressClear")}
                          </Text>
                        </Pressable>
                        <Pressable
                          style={styles.addressActionButton}
                          onPress={openLocationPicker}
                        >
                          <Ionicons name="map-outline" size={16} color={PRIMARY} />
                          <Text style={styles.locationButtonText}>
                            {t("shopApplication.locationEditButton")}
                          </Text>
                        </Pressable>
                      </View>
                    </>
                  ) : (
                    <>
                      <Pressable
                        style={styles.locationButton}
                        onPress={openAddressPicker}
                      >
                        <Ionicons
                          name="search-outline"
                          size={16}
                          color={PRIMARY}
                        />
                        <Text style={styles.locationButtonText}>
                          {t("shopApplication.addressSearch")}
                        </Text>
                      </Pressable>
                      {geocodeState === "loading" ? (
                        <Text style={styles.locationHint}>
                          {t("shopApplication.locationSearching")}
                        </Text>
                      ) : null}
                      {geocodeState === "failed" ? (
                        <>
                          <View style={styles.locationWarn}>
                            <Text style={styles.locationWarnText}>
                              {t("shopApplication.locationFailed")}
                            </Text>
                          </View>
                          <Pressable
                            style={styles.locationButton}
                            onPress={openLocationPicker}
                          >
                            <Ionicons
                              name="map-outline"
                              size={16}
                              color={PRIMARY}
                            />
                            <Text style={styles.locationButtonText}>
                              {t("shopApplication.locationEditButton")}
                            </Text>
                          </Pressable>
                        </>
                      ) : null}
                    </>
                  )}

                  {errors.address ? (
                    <Text style={styles.errorText}>{errors.address}</Text>
                  ) : null}
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

        {showCandidates && candidatePosition && candidatePosition.maxHeight >= 44 && (
          <View style={[styles.candidatePanel, candidatePosition]}>
            <ScrollView
              keyboardShouldPersistTaps="always"
              style={{ maxHeight: candidatePosition.maxHeight }}
              contentContainerStyle={styles.candidatePanelContent}
            >
              {candidates.failed ? (
                <>
                  <Text style={styles.locationHint} accessibilityLiveRegion="polite">
                    {t("shopApplication.candidateError")}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    style={styles.candidateAction}
                    onPress={candidates.retry}
                  >
                    <Text style={styles.locationButtonText}>
                      {t("shopApplication.candidateRetry")}
                    </Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.candidateHeading}>
                    {t("shopApplication.candidateHeading")}
                  </Text>
                  {candidates.items.map((shop, index) => (
                    <Pressable
                      key={shop.id}
                      accessibilityRole="button"
                      disabled={isSubmitting}
                      accessibilityState={{ disabled: isSubmitting }}
                      style={[styles.candidateRow, index > 0 && styles.candidateRowDivider]}
                      onPress={() => {
                        setNameFocused(false);
                        setCandidatePosition(null);
                        Keyboard.dismiss();
                        setSelectedShop(shop);
                        setErrors({});
                      }}
                    >
                      <Text style={styles.candidateName} numberOfLines={1}>{shop.name}</Text>
                      {shop.address && (
                        <Text style={styles.candidateAddress} numberOfLines={1}>{shop.address}</Text>
                      )}
                    </Pressable>
                  ))}
                </>
              )}
            </ScrollView>
          </View>
        )}
      </View>
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
  formRegion: { flex: 1 },
  candidatePanel: {
    position: "absolute",
    zIndex: 8,
    elevation: 6,
    borderRadius: 12,
    backgroundColor: WHITE,
    shadowColor: BLACK,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  candidatePanelContent: { gap: 4, padding: 12 },
  candidateHeading: {
    color: TEXT_BODY,
    fontSize: 12,
    fontWeight: "600",
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: GRAY_200,
  },
  candidateRow: { minHeight: 44, paddingVertical: 6, gap: 3 },
  candidateRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: GRAY_200,
  },
  candidateName: { fontSize: 14, fontWeight: "700", color: TEXT_DARK },
  candidateAddress: { fontSize: 12, color: TEXT_GRAY },
  candidateAction: { minHeight: 40, justifyContent: "center" },
  selectedName: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 44,
    paddingVertical: 4,
    paddingHorizontal: 14,
    backgroundColor: GRAY_100,
    borderRadius: 8,
  },
  selectedNameText: { flex: 1, gap: 3 },
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
  coordHint: {
    fontSize: 11,
    color: TEXT_GRAY,
  },
  addressActionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  addressActionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 40,
    borderRadius: 8,
    backgroundColor: GRAY_100,
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
