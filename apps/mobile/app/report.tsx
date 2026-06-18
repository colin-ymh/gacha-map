import {
  View,
  TouchableOpacity,
  Text,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
  BORDER,
  PLACEHOLDER_LIGHT,
  TEXT_PLACEHOLDER,
  GRAY_200,
  WHITE,
} from "@/constants/colors";
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

      Alert.alert(t("report.successTitle"), t("report.success"), [
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
    <SafeAreaView edges={["top"]} className="flex-1 bg-white">
      <View
        className="h-[52px] flex-row items-center border-b border-gray-200"
        style={{ borderColor: GRAY_200 }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          className="px-4 items-center justify-center h-full"
        >
          <Text style={{ fontSize: 24, color: TEXT_DARK }}>‹</Text>
        </TouchableOpacity>
        <Text
          className="flex-1 text-center"
          style={{ fontSize: 16, fontWeight: "700", color: TEXT_DARK }}
        >
          {t("report.title")}
        </Text>
        <View className="w-[40px]" />
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-4 py-5">
          {shopId && shopName ? (
            <View
              className="mb-5 px-4 py-3 rounded-xl"
              style={{ backgroundColor: PRIMARY_BG_SOFT }}
            >
              <Text style={{ fontSize: 14, color: PRIMARY, fontWeight: "600" }}>
                {t("report.shopContext", { shopName })}
              </Text>
            </View>
          ) : null}

          {/* Report type chips */}
          <View className="mb-5">
            <Text
              style={{ fontSize: 14, fontWeight: "600", color: TEXT_DARK }}
              className="mb-2.5"
            >
              {t("report.typeLabel")}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {availableTypes.map((type) => {
                const isActive = reportType === type;
                return (
                  <TouchableOpacity
                    key={type}
                    onPress={() => setReportType(type)}
                    className="h-9 px-4 rounded-full items-center justify-center"
                    style={{
                      borderWidth: isActive ? 1.5 : 1,
                      borderColor: isActive ? PRIMARY : BORDER,
                      backgroundColor: WHITE,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        color: isActive ? PRIMARY : TEXT_GRAY,
                      }}
                    >
                      {TYPE_LABELS[type]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Shop search for fix_info / closed without pre-selected shop */}
          {needsShopSearch && (
            <View className="mb-5">
              <Text
                style={{ fontSize: 14, fontWeight: "600", color: TEXT_DARK }}
                className="mb-2.5"
              >
                {t("report.shopSearchLabel")}
              </Text>
              {selectedShop ? (
                <View
                  className="rounded-lg border px-3.5 py-3 flex-row items-center"
                  style={{
                    borderColor: PRIMARY,
                    backgroundColor: PRIMARY_BG_SOFT,
                  }}
                >
                  <View className="flex-1">
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
                <View>
                  <TextInput
                    className="w-full h-11 rounded-lg border px-3.5"
                    style={{ fontSize: 14, borderColor: BORDER }}
                    placeholder={t("report.shopSearchPlaceholder")}
                    placeholderTextColor={PLACEHOLDER_LIGHT}
                    value={shopQuery}
                    onChangeText={(v) => {
                      setShopQuery(v);
                      setSelectedShop(null);
                    }}
                    returnKeyType="search"
                  />
                  {shopQuery.trim().length > 0 && shopSearchLoading && (
                    <View className="py-3 items-center">
                      <ActivityIndicator size="small" color={PRIMARY} />
                    </View>
                  )}
                  {shopQuery.trim().length > 0 && !shopSearchLoading && (
                    <View
                      className="rounded-lg border mt-1"
                      style={{ borderColor: BORDER }}
                    >
                      {shopResults.length > 0 ? (
                        shopResults.map((shop, idx) => (
                          <TouchableOpacity
                            key={shop.id}
                            onPress={() => {
                              setSelectedShop(shop);
                              setShopQuery(shop.name);
                              setShopResults([]);
                            }}
                            className="px-3.5 py-3"
                            style={
                              idx < shopResults.length - 1
                                ? { borderBottomWidth: 1, borderColor: BORDER }
                                : undefined
                            }
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
                        <View className="px-3.5 py-3">
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

          {/* New shop: shop name field */}
          {isNewShop && (
            <View className="mb-5">
              <Text
                style={{ fontSize: 14, fontWeight: "600", color: TEXT_DARK }}
                className="mb-2.5"
              >
                {t("report.shopNameLabel")}{" "}
                <Text style={{ color: PRIMARY }}>*</Text>
              </Text>
              <TextInput
                className="w-full h-11 rounded-lg border px-3.5"
                style={{ fontSize: 14, borderColor: BORDER }}
                placeholder={t("report.shopNamePlaceholder")}
                placeholderTextColor={PLACEHOLDER_LIGHT}
                maxLength={100}
                value={proposedShopName}
                onChangeText={setProposedShopName}
                returnKeyType="done"
              />
              {proposedShopName.length === 0 && (
                <Text style={{ fontSize: 11, color: TEXT_GRAY, marginTop: 4 }}>
                  {t("report.shopNameRequired")}
                </Text>
              )}
            </View>
          )}

          {/* New shop: location picker */}
          {isNewShop && (
            <View className="mb-5">
              <Text
                style={{ fontSize: 14, fontWeight: "600", color: TEXT_DARK }}
                className="mb-2.5"
              >
                {t("report.locationLabel")}
              </Text>
              {proposedLocation ? (
                <View
                  className="rounded-lg border px-3.5 py-3"
                  style={{
                    borderColor: PRIMARY,
                    backgroundColor: PRIMARY_BG_SOFT,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      color: TEXT_DARK,
                      marginBottom: 6,
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
                  className="h-11 rounded-lg border items-center justify-center"
                  style={{ borderColor: BORDER }}
                >
                  <Text style={{ fontSize: 14, color: TEXT_GRAY }}>
                    {t("report.locationButton")}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Content field */}
          <View className="mb-5">
            <Text
              style={{ fontSize: 14, fontWeight: "600", color: TEXT_DARK }}
              className="mb-2.5"
            >
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
              className="w-full h-32 rounded-lg border border-gray-200 px-3.5 pt-3"
              style={{ fontSize: 14, borderColor: BORDER }}
              placeholder={
                isNewShop
                  ? t("report.additionalInfoPlaceholder")
                  : (contentHint ?? t("report.contentPlaceholder"))
              }
              placeholderTextColor={PLACEHOLDER_LIGHT}
              multiline
              maxLength={1000}
              textAlignVertical="top"
              value={content}
              onChangeText={setContent}
            />
            <View className="flex-row justify-between items-center mt-1">
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

          {!isLoggedIn && (
            <View className="mb-5">
              <Text
                style={{ fontSize: 14, fontWeight: "600", color: TEXT_DARK }}
                className="mb-2.5"
              >
                {t("report.nameLabel")}
              </Text>
              <TextInput
                className="w-full h-11 rounded-lg border px-3.5"
                style={{ fontSize: 14, borderColor: BORDER }}
                placeholder={t("report.namePlaceholder")}
                placeholderTextColor={PLACEHOLDER_LIGHT}
                value={reporterName}
                onChangeText={setReporterName}
                maxLength={50}
              />
            </View>
          )}

          <View className="mb-6">
            <Text
              style={{ fontSize: 14, fontWeight: "600", color: TEXT_DARK }}
              className="mb-2.5"
            >
              {t("report.contactLabel")}
            </Text>
            <TextInput
              className="w-full h-11 rounded-lg border px-3.5"
              style={{ fontSize: 14, borderColor: BORDER }}
              placeholder={t("report.contactPlaceholder")}
              placeholderTextColor={PLACEHOLDER_LIGHT}
              value={contact}
              onChangeText={(v) => setContact(formatKoreanPhone(v))}
              maxLength={100}
            />
          </View>

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isSubmitDisabled || isSubmitting}
            className="w-full h-12 rounded-full items-center justify-center"
            style={{
              backgroundColor:
                isSubmitDisabled || isSubmitting ? BORDER : PRIMARY,
            }}
          >
            {isSubmitting ? (
              <ActivityIndicator color={TEXT_PLACEHOLDER} />
            ) : (
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "600",
                  color: isSubmitDisabled ? TEXT_PLACEHOLDER : WHITE,
                }}
              >
                {t("report.submit")}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
