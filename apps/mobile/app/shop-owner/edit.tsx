import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import { PressableScale } from "@/components/ui/PressableScale";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { getAuthHeaders } from "@/lib/supabase";
import {
  formatKoreanPhone,
  parseBusinessHours,
  serializeBusinessHours,
  hasBusinessHoursErrors,
  type BusinessHoursData,
} from "@gacha-map/shared";
import BusinessHoursEditor from "@/components/organisms/BusinessHoursEditor";
import { SkeletonBone } from "@/components/ui/Skeleton";
import {
  PRIMARY,
  TEXT_DARK,
  TEXT_GRAY,
  GRAY_100,
  GRAY_200,
  WHITE,
  SUCCESS_TEXT,
  DANGER_BRIGHT,
} from "@/constants/colors";
import { GlassBackButton } from "@/components/ui/GlassBackButton";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

interface ShopOwnerShop {
  id: string;
  name: string;
  description: string | null;
  phone: string | null;
  opening_hours: string | null;
}

export default function ShopOwnerEditScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [shop, setShop] = useState<ShopOwnerShop | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{
    msg: string;
    isError: boolean;
  } | null>(null);

  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [businessHours, setBusinessHours] = useState<BusinessHoursData | null>(
    null,
  );

  const tP = (key: string) => t(`shopOwner.profile.${key}`);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/shop-owner/shop`, {
        headers: authHeaders,
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const s: ShopOwnerShop = data.shop;
      setShop(s);
      setDescription(s.description ?? "");
      setPhone(s.phone ?? "");
      setBusinessHours(parseBusinessHours(s.opening_hours));
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => load());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    if (hasBusinessHoursErrors(businessHours)) {
      setStatusMsg({ msg: tP("hoursInvalid"), isError: true });
      return;
    }
    setIsSaving(true);
    setStatusMsg(null);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/shop-owner/shop`, {
        method: "PATCH",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description || null,
          phone: phone || null,
          opening_hours: businessHours
            ? serializeBusinessHours(businessHours)
            : null,
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setShop(data.shop);
      setStatusMsg({ msg: tP("saveSuccess"), isError: false });
    } catch {
      setStatusMsg({ msg: tP("saveError"), isError: true });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (shop) {
      setDescription(shop.description ?? "");
      setPhone(shop.phone ?? "");
      setBusinessHours(parseBusinessHours(shop.opening_hours));
      setStatusMsg(null);
    }
  };

  const inputStyle = {
    borderWidth: 1,
    borderColor: GRAY_200,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: TEXT_DARK,
    backgroundColor: WHITE,
  };

  const labelStyle = {
    fontSize: 13,
    fontWeight: "600" as const,
    color: TEXT_DARK,
    marginBottom: 6,
  };

  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: GRAY_100 }}
    >
      <View
        style={[styles.floatRow, { top: insets.top + 8 }]}
        pointerEvents="box-none"
      >
        <GlassBackButton onPress={() => router.back()} />
      </View>

      {isLoading ? (
        <View style={{ flex: 1, padding: 20, paddingTop: 64 }}>
          <View style={{ alignItems: "center", marginBottom: 32 }}>
            <SkeletonBone width={80} height={80} borderRadius={40} />
          </View>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ marginBottom: 20 }}>
              <SkeletonBone
                width="30%"
                height={13}
                style={{ marginBottom: 8 }}
              />
              <SkeletonBone height={44} borderRadius={8} />
            </View>
          ))}
          <SkeletonBone height={48} borderRadius={8} style={{ marginTop: 8 }} />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={{ padding: 16, paddingTop: 64, gap: 20 }}>
              <Text style={{ fontSize: 12, color: PRIMARY }}>
                {tP("notice")}
              </Text>

              {/* 샵 이름 (읽기 전용) */}
              <View>
                <Text style={labelStyle}>{tP("nameLabel")}</Text>
                <View style={[inputStyle, { backgroundColor: "#F9FAFB" }]}>
                  <Text style={{ fontSize: 14, color: TEXT_GRAY }}>
                    {shop?.name ?? ""}
                  </Text>
                </View>
              </View>

              {/* 소개 */}
              <View>
                <Text style={labelStyle}>{tP("descriptionLabel")}</Text>
                <TextInput
                  style={[
                    inputStyle,
                    { minHeight: 80, textAlignVertical: "top" },
                  ]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder={tP("descriptionPlaceholder")}
                  placeholderTextColor={TEXT_GRAY}
                  multiline
                />
              </View>

              {/* 전화번호 */}
              <View>
                <Text style={labelStyle}>{tP("phoneLabel")}</Text>
                <TextInput
                  style={inputStyle}
                  value={phone}
                  onChangeText={(v) => setPhone(formatKoreanPhone(v))}
                  placeholder={tP("phonePlaceholder")}
                  placeholderTextColor={TEXT_GRAY}
                  keyboardType="phone-pad"
                />
              </View>

              {/* 영업시간 */}
              <View>
                <Text style={labelStyle}>{tP("hoursLabel")}</Text>
                <BusinessHoursEditor
                  value={businessHours}
                  onChange={setBusinessHours}
                />
              </View>

              {statusMsg && (
                <Text
                  style={{
                    fontSize: 13,
                    color: statusMsg.isError ? DANGER_BRIGHT : SUCCESS_TEXT,
                  }}
                >
                  {statusMsg.msg}
                </Text>
              )}

              {/* 버튼 */}
              <View style={{ flexDirection: "row", gap: 12 }}>
                <PressableScale
                  onPress={handleSave}
                  disabled={isSaving}
                  style={{
                    flex: 1,
                    backgroundColor: PRIMARY,
                    borderRadius: 10,
                    paddingVertical: 14,
                    alignItems: "center",
                    opacity: isSaving ? 0.6 : 1,
                  }}
                >
                  <Text
                    style={{ fontSize: 15, fontWeight: "700", color: WHITE }}
                  >
                    {isSaving ? tP("saving") : tP("saveBtn")}
                  </Text>
                </PressableScale>

                <PressableScale
                  onPress={handleCancel}
                  style={{
                    flex: 1,
                    backgroundColor: WHITE,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: GRAY_200,
                    paddingVertical: 14,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "600",
                      color: TEXT_DARK,
                    }}
                  >
                    {tP("cancelBtn")}
                  </Text>
                </PressableScale>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  floatRow: {
    position: "absolute",
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 10,
  },
});
