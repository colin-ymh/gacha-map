import {
  View,
  TouchableOpacity,
  Text,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { getAuthHeaders } from "@/lib/supabase";
import { formatKoreanPhone, containsProfanity } from "@gacha-map/shared";
import { useAppSelector } from "@/store/hooks";
import {
  PRIMARY,
  PRIMARY_BG_SOFT,
  TEXT_DARK,
  TEXT_GRAY,
  TEXT_PLACEHOLDER,
  BORDER,
  WHITE,
  GRAY_100,
} from "@/constants/colors";
import { GlassBackButton } from "@/components/ui/GlassBackButton";
import { GlassSubmitButton } from "@/components/ui/GlassSubmitButton";
import { LiquidGlass } from "@/components/ui/LiquidGlass";
import { useLiquidGlassPress } from "@/hooks/useLiquidGlassPress";
import { consumeLocationPickerResult } from "@/lib/locationPickerResult";
import type { LocationPickerResult } from "@/lib/locationPickerResult";

type ApiReportType = "new_shop" | "fix_info" | "closed" | "other";

const ALL_TYPES: ApiReportType[] = ["new_shop", "fix_info", "closed", "other"];
const SHOP_TYPES: ApiReportType[] = ["fix_info", "closed", "other"];

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

export default function ReportScreen() {
  const router = useRouter();
  const { shopId, shopName: rawShopName } = useLocalSearchParams<{
    shopId?: string;
    shopName?: string;
  }>();
  const shopName = rawShopName ? decodeURIComponent(rawShopName) : "";
  const isLoggedIn = useAppSelector((s) => s.auth.isLoggedIn);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const TYPE_LABELS: Record<ApiReportType, string> = {
    new_shop: t("report.typeNewShop"),
    fix_info: t("report.typeFixInfo"),
    closed: t("report.typeClosed"),
    other: t("report.typeOther"),
  };

  const availableTypes = shopId ? SHOP_TYPES : ALL_TYPES;
  const [reportType, setReportType] = useState<ApiReportType | null>(
    shopId ? "fix_info" : "new_shop",
  );
  const [content, setContent] = useState("");
  const [proposedShopName, setProposedShopName] = useState("");
  const [proposedLocation, setProposedLocation] =
    useState<LocationPickerResult | null>(null);
  const [selectedShop, setSelectedShop] = useState<{
    id: string;
    name: string;
    address: string | null;
  } | null>(null);
  const [shopQuery, setShopQuery] = useState("");
  const [shopResults, setShopResults] = useState<
    { id: string; name: string; address: string | null }[]
  >([]);
  const [shopSearchLoading, setShopSearchLoading] = useState(false);
  const [reporterName, setReporterName] = useState("");
  const [contact, setContact] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const result = consumeLocationPickerResult();
      if (result) {
        setProposedLocation(result);
      }
    }, []),
  );

  const isNewShop = reportType === "new_shop";
  const needsShopSearch =
    !shopId && (reportType === "fix_info" || reportType === "closed");

  const contentHint = (() => {
    if (shopId) return null;
    if (selectedShop) return null;
    if (reportType === "fix_info" || reportType === "closed")
      return t("report.hintShop");
    return null;
  })();

  useEffect(() => {
    if (!needsShopSearch || !shopQuery.trim()) {
      setShopResults([]);
      return;
    }
    setShopSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/shops?q=${encodeURIComponent(shopQuery.trim())}&limit=10`,
        );
        if (res.ok) {
          const data = (await res.json()) as {
            shops?: { id: string; name: string; address: string | null }[];
          };
          setShopResults(data.shops ?? []);
        }
      } catch {
        // ignore
      } finally {
        setShopSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [shopQuery, needsShopSearch]);

  const isSubmitDisabled = (() => {
    if (!reportType) return true;
    if (isNewShop) return proposedShopName.trim().length === 0;
    return content.trim().length < 10;
  })();

  const handleSubmit = async () => {
    if (isSubmitDisabled) return;
    if (!API_BASE) {
      Alert.alert(t("report.errorTitle"), t("report.serverError"));
      return;
    }

    if (isNewShop) {
      if (content.trim().length > 0 && containsProfanity(content.trim())) {
        Alert.alert(t("report.errorTitle"), t("report.profanity"));
        return;
      }
    } else {
      if (containsProfanity(content.trim())) {
        Alert.alert(t("report.errorTitle"), t("report.profanity"));
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const authHeaders = await getAuthHeaders();
      const body: Record<string, unknown> = {
        report_type: reportType,
        content: content.trim(),
      };
      const resolvedShopId = shopId ?? selectedShop?.id ?? null;
      if (resolvedShopId) body.shop_id = resolvedShopId;
      if (!isLoggedIn && reporterName.trim())
        body.reporter_name = reporterName.trim();
      if (contact.trim()) body.reporter_contact = contact.trim();
      if (isNewShop) {
        body.proposed_shop_name = proposedShopName.trim();
        if (proposedLocation) {
          body.proposed_address = proposedLocation.address;
          body.proposed_lat = proposedLocation.lat;
          body.proposed_lng = proposedLocation.lng;
        }
      }

      const res = await fetch(`${API_BASE}/api/reports`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const resBody = (res.headers.get("content-type") ?? "").includes(
        "application/json",
      )
        ? await res.json().catch(() => ({}))
        : {};
      if (!res.ok) {
        throw new Error(
          (resBody as { error?: string }).error ?? t("report.error"),
        );
      }

      const message = (resBody as { gachaBonusGranted?: boolean })
        .gachaBonusGranted
        ? `${t("report.success")}\n${t("gacha.bonusGranted.toastSuccess")}`
        : t("report.success");
      Alert.alert(t("report.successTitle"), message, [
        { text: t("report.successBtn"), onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert(
        t("report.errorTitle"),
        err instanceof Error ? err.message : t("report.error"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <SafeAreaView edges={["top"]} style={styles.safe}>
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
          <View style={styles.content}>
            {/* 샵 컨텍스트 배너 */}
            {shopId && shopName ? (
              <View style={styles.contextBanner}>
                <Text
                  style={{ fontSize: 14, color: PRIMARY, fontWeight: "600" }}
                >
                  {t("report.shopContext", { shopName })}
                </Text>
              </View>
            ) : null}

            {/* 제보 유형 */}
            <View style={styles.card}>
              <Text style={styles.fieldLabel}>{t("report.typeLabel")}</Text>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 8,
                  marginTop: 10,
                }}
              >
                {availableTypes.map((type) => (
                  <GlassChip
                    key={type}
                    label={TYPE_LABELS[type]}
                    isActive={reportType === type}
                    onPress={() => setReportType(type)}
                  />
                ))}
              </View>
            </View>

            {/* 샵 검색 (fix_info / closed) */}
            {needsShopSearch && (
              <View style={styles.card}>
                <Text style={styles.fieldLabel}>
                  {t("report.shopSearchLabel")}
                </Text>
                {selectedShop ? (
                  <View style={[styles.selectedBox, { marginTop: 10 }]}>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "600",
                          color: PRIMARY,
                        }}
                      >
                        {selectedShop.name}
                      </Text>
                      {selectedShop.address ? (
                        <Text
                          style={{
                            fontSize: 12,
                            color: TEXT_GRAY,
                            marginTop: 2,
                          }}
                        >
                          {selectedShop.address}
                        </Text>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        setSelectedShop(null);
                        setShopQuery("");
                        setShopResults([]);
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "600",
                          color: PRIMARY,
                        }}
                      >
                        {t("report.changeShop")}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={{ marginTop: 10 }}>
                    <TextInput
                      style={styles.inputField}
                      placeholder={t("report.shopSearchPlaceholder")}
                      placeholderTextColor={TEXT_PLACEHOLDER}
                      value={shopQuery}
                      onChangeText={(v) => {
                        setShopQuery(v);
                        setSelectedShop(null);
                      }}
                      returnKeyType="search"
                    />
                    {shopQuery.trim().length > 0 && shopSearchLoading && (
                      <View
                        style={{ paddingVertical: 12, alignItems: "center" }}
                      >
                        <ActivityIndicator size="small" color={PRIMARY} />
                      </View>
                    )}
                    {shopQuery.trim().length > 0 && !shopSearchLoading && (
                      <View style={styles.dropdown}>
                        {shopResults.length > 0 ? (
                          shopResults.map((shop, idx) => (
                            <TouchableOpacity
                              key={shop.id}
                              onPress={() => {
                                setSelectedShop(shop);
                                setShopQuery(shop.name);
                                setShopResults([]);
                              }}
                              style={[
                                styles.dropdownItem,
                                idx < shopResults.length - 1 &&
                                  styles.dropdownSep,
                              ]}
                            >
                              <Text style={{ fontSize: 14, color: TEXT_DARK }}>
                                {shop.name}
                              </Text>
                              {shop.address ? (
                                <Text
                                  style={{
                                    fontSize: 12,
                                    color: TEXT_GRAY,
                                    marginTop: 2,
                                  }}
                                >
                                  {shop.address}
                                </Text>
                              ) : null}
                            </TouchableOpacity>
                          ))
                        ) : (
                          <View style={styles.dropdownItem}>
                            <Text style={{ fontSize: 13, color: TEXT_GRAY }}>
                              {t("report.shopSearchEmpty")}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* 새 샵: 이름 */}
            {isNewShop && (
              <View style={styles.card}>
                <Text style={styles.fieldLabel}>
                  {t("report.shopNameLabel")}{" "}
                  <Text style={{ color: PRIMARY }}>*</Text>
                </Text>
                <TextInput
                  style={[styles.inputField, { marginTop: 10 }]}
                  placeholder={t("report.shopNamePlaceholder")}
                  placeholderTextColor={TEXT_PLACEHOLDER}
                  maxLength={100}
                  value={proposedShopName}
                  onChangeText={setProposedShopName}
                  returnKeyType="done"
                />
              </View>
            )}

            {/* 새 샵: 위치 */}
            {isNewShop && (
              <View style={styles.card}>
                <Text style={styles.fieldLabel}>
                  {t("report.locationLabel")}
                </Text>
                {proposedLocation ? (
                  <View style={[styles.selectedBox, { marginTop: 10 }]}>
                    <Text
                      style={{
                        fontSize: 13,
                        color: TEXT_DARK,
                        flex: 1,
                        marginRight: 8,
                      }}
                      numberOfLines={2}
                    >
                      {proposedLocation.address ?? t("report.unknownAddress")}
                    </Text>
                    <TouchableOpacity
                      onPress={() => router.push("/report-location-picker")}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          color: PRIMARY,
                          fontWeight: "600",
                        }}
                      >
                        {t("report.locationChange")}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={() => router.push("/report-location-picker")}
                    style={[styles.inputField, styles.locationBtn]}
                  >
                    <Text style={{ fontSize: 14, color: TEXT_GRAY }}>
                      {t("report.locationButton")}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* 추가 설명 / 내용 */}
            <View style={styles.card}>
              <Text style={styles.fieldLabel}>
                {isNewShop ? (
                  t("report.additionalInfo")
                ) : (
                  <>
                    {t("report.contentLabel")}{" "}
                    <Text style={{ color: PRIMARY }}>*</Text>
                  </>
                )}
              </Text>
              <TextInput
                style={[styles.inputField, styles.textarea]}
                placeholder={
                  isNewShop
                    ? t("report.additionalInfoPlaceholder")
                    : (contentHint ?? t("report.contentPlaceholder"))
                }
                placeholderTextColor={TEXT_PLACEHOLDER}
                multiline
                maxLength={1000}
                textAlignVertical="top"
                value={content}
                onChangeText={setContent}
              />
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: 4,
                }}
              >
                {!isNewShop && content.length > 0 && content.length < 10 ? (
                  <Text style={{ fontSize: 11, color: PRIMARY }}>
                    {t("report.validationMinLength")}
                  </Text>
                ) : (
                  <View />
                )}
                <Text style={{ fontSize: 11, color: TEXT_GRAY }}>
                  {content.length}/1000
                </Text>
              </View>
            </View>

            {/* 이름 (비로그인) */}
            {!isLoggedIn && (
              <View style={styles.card}>
                <Text style={styles.fieldLabel}>{t("report.nameLabel")}</Text>
                <TextInput
                  style={[styles.inputField, { marginTop: 10 }]}
                  placeholder={t("report.namePlaceholder")}
                  placeholderTextColor={TEXT_PLACEHOLDER}
                  value={reporterName}
                  onChangeText={setReporterName}
                  maxLength={50}
                />
              </View>
            )}

            {/* 연락처 */}
            <View style={styles.card}>
              <Text style={styles.fieldLabel}>{t("report.contactLabel")}</Text>
              <TextInput
                style={[styles.inputField, { marginTop: 10 }]}
                placeholder={t("report.contactPlaceholder")}
                placeholderTextColor={TEXT_PLACEHOLDER}
                value={contact}
                onChangeText={(v) => setContact(formatKoreanPhone(v))}
                maxLength={100}
              />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

function GlassChip({
  label,
  isActive,
  onPress,
}: {
  label: string;
  isActive: boolean;
  onPress: () => void;
}) {
  const { onPressIn, onPressOut, animatedStyle, brightnessValue } = useLiquidGlassPress();
  return (
    <LiquidGlass
      borderRadius={99}
      style={animatedStyle}
      brightnessOpacity={brightnessValue}
      overlayColor={isActive ? "rgba(233,75,140,0.22)" : "rgba(0,0,0,0.08)"}
    >
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
        style={{
          height: 36,
          paddingHorizontal: 16,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            fontSize: 13,
            fontWeight: isActive ? "600" : "400",
            color: isActive ? PRIMARY : TEXT_GRAY,
          }}
        >
          {label}
        </Text>
      </TouchableOpacity>
    </LiquidGlass>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: GRAY_100,
  },
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
    paddingTop: 64,
    paddingBottom: 32,
    gap: 12,
  },
  contextBanner: {
    backgroundColor: PRIMARY_BG_SOFT,
    borderRadius: 12,
    padding: 12,
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
  },
  inputField: {
    backgroundColor: GRAY_100,
    borderRadius: 8,
    height: 44,
    paddingHorizontal: 14,
    fontSize: 14,
    color: TEXT_DARK,
  },
  locationBtn: {
    marginTop: 10,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  textarea: {
    height: 128,
    paddingTop: 12,
    marginTop: 10,
  },
  typeChip: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 99,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: WHITE,
  },
  selectedBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: PRIMARY_BG_SOFT,
    borderRadius: 8,
    padding: 12,
  },
  dropdown: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: WHITE,
  },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dropdownSep: {
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
});
