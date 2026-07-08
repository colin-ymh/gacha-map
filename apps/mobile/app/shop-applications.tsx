import { useCallback, useEffect, useState } from "react";
import { SkeletonBone } from "@/components/ui/Skeleton";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { getAuthHeaders } from "@/lib/supabase";
import { useAppSelector } from "@/store/hooks";
import LoginModal from "@/components/ui/LoginModal";
import {
  PRIMARY,
  TEXT_DARK,
  TEXT_GRAY,
  GRAY_200,
  GRAY_100,
  SUCCESS_TEXT,
  SUCCESS_BG,
  DANGER_BG,
  DANGER_DARK,
  STATUS_DEFAULT_BG,
  WHITE,
  BADGE_NEW_SHOP_BG,
  BADGE_NEW_SHOP_TEXT,
  BADGE_CLAIM_SHOP_BG,
  BADGE_CLAIM_SHOP_TEXT,
} from "@/constants/colors";
import { Ionicons } from "@expo/vector-icons";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

type ApplicationType = "new_shop" | "claim_shop";
type ApplicationStatus = "pending" | "approved" | "rejected";

interface ShopApplication {
  id: string;
  type: ApplicationType;
  status: ApplicationStatus;
  shop_name: string | null;
  created_at: string;
  admin_note: string | null;
}

export default function ShopApplicationsScreen() {
  const router = useRouter();
  const isLoggedIn = useAppSelector((s) => s.auth.isLoggedIn);
  const { t } = useTranslation();

  const [applications, setApplications] = useState<ShopApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const load = useCallback(async () => {
    if (!isLoggedIn) {
      setShowLoginModal(true);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setHasError(false);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/shop-applications`, {
        headers: authHeaders,
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setApplications(data.applications ?? []);
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    load();
  }, [load]);

  const getTypeBadge = (type: ApplicationType) => {
    if (type === "claim_shop") {
      return {
        bg: BADGE_CLAIM_SHOP_BG,
        color: BADGE_CLAIM_SHOP_TEXT,
        label: t("myShopApplications.typeClaimShop"),
      };
    }
    return {
      bg: BADGE_NEW_SHOP_BG,
      color: BADGE_NEW_SHOP_TEXT,
      label: t("myShopApplications.typeNewShop"),
    };
  };

  const getStatusBadge = (status: ApplicationStatus) => {
    if (status === "approved")
      return {
        bg: SUCCESS_BG,
        color: SUCCESS_TEXT,
        label: t("myShopApplications.statusApproved"),
      };
    if (status === "rejected")
      return {
        bg: DANGER_BG,
        color: DANGER_DARK,
        label: t("myShopApplications.statusRejected"),
      };
    return {
      bg: STATUS_DEFAULT_BG,
      color: TEXT_GRAY,
      label: t("myShopApplications.statusPending"),
    };
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
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
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            paddingHorizontal: 16,
            height: "100%",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="chevron-back" size={24} color={TEXT_DARK} />
        </TouchableOpacity>
        <Text
          style={{
            flex: 1,
            textAlign: "center",
            fontSize: 16,
            fontWeight: "700",
            color: TEXT_DARK,
          }}
        >
          {t("myShopApplications.title")}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={{ flex: 1, padding: 16 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View
              key={i}
              style={{
                paddingVertical: 14,
                gap: 8,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <SkeletonBone width="50%" height={16} />
                <SkeletonBone width={70} height={20} borderRadius={10} />
              </View>
              <SkeletonBone width="35%" height={12} />
              <SkeletonBone width="75%" height={12} />
            </View>
          ))}
        </View>
      ) : hasError ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <Text style={{ fontSize: 14, color: TEXT_GRAY, marginBottom: 16 }}>
            {t("myShopApplications.errorMsg")}
          </Text>
          <TouchableOpacity
            onPress={load}
            style={{
              paddingHorizontal: 20,
              paddingVertical: 10,
              borderRadius: 20,
              backgroundColor: PRIMARY,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "600", color: WHITE }}>
              {t("myShopApplications.retry")}
            </Text>
          </TouchableOpacity>
        </View>
      ) : applications.length === 0 ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <Text style={{ fontSize: 14, color: TEXT_GRAY, marginBottom: 20 }}>
            {t("myShopApplications.empty")}
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/shop-application" as never)}
            style={{
              paddingHorizontal: 20,
              paddingVertical: 10,
              borderRadius: 20,
              backgroundColor: PRIMARY,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "600", color: WHITE }}>
              {t("myShopApplications.emptyAction")}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          <View style={{ paddingVertical: 8 }}>
            {applications.map((app) => {
              const typeBadge = getTypeBadge(app.type);
              const statusBadge = getStatusBadge(app.status);
              return (
                <View
                  key={app.id}
                  style={{
                    marginHorizontal: 16,
                    marginVertical: 6,
                    padding: 16,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: GRAY_200,
                    backgroundColor: WHITE,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    <View
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 3,
                        borderRadius: 99,
                        backgroundColor: typeBadge.bg,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "600",
                          color: typeBadge.color,
                        }}
                      >
                        {typeBadge.label}
                      </Text>
                    </View>
                    <View
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 3,
                        borderRadius: 99,
                        backgroundColor: statusBadge.bg,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "600",
                          color: statusBadge.color,
                        }}
                      >
                        {statusBadge.label}
                      </Text>
                    </View>
                  </View>

                  {app.shop_name ? (
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: "600",
                        color: TEXT_DARK,
                        marginBottom: 4,
                      }}
                    >
                      {app.shop_name}
                    </Text>
                  ) : null}

                  <Text style={{ fontSize: 12, color: TEXT_GRAY }}>
                    {formatDate(app.created_at)}
                  </Text>

                  {app.status === "rejected" && app.admin_note ? (
                    <View
                      style={{
                        marginTop: 10,
                        padding: 10,
                        borderRadius: 8,
                        backgroundColor: GRAY_100,
                      }}
                    >
                      <Text style={{ fontSize: 12, color: TEXT_GRAY }}>
                        {t("myShopApplications.rejectionReason", {
                          reason: app.admin_note,
                        })}
                      </Text>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}

      <LoginModal
        visible={showLoginModal}
        onClose={() => {
          setShowLoginModal(false);
          router.back();
        }}
        onLoginPress={() => {
          setShowLoginModal(false);
          router.push("/login" as never);
        }}
      />
    </SafeAreaView>
  );
}
