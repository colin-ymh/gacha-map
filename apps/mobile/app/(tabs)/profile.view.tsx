import { useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TouchableOpacity,
} from "react-native";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";

interface UserProfile {
  nickname: string;
  oauthProvider?: "kakao" | "naver" | "apple" | "google";
}

interface MenuItem {
  id: string;
  label: string;
  color?: string;
  showArrow?: boolean;
  rightText?: string;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
  requireLogin?: boolean;
}

interface ProfileViewProps {
  user: UserProfile;
  isLoggedIn: boolean;
  onLoginPress?: () => void;
  onEditPress?: () => void;
  onMenuPress: (menuId: string) => void;
}

const LANG_LABELS: Record<string, string> = {
  ko: "한국어",
  en: "English",
  ja: "日本語",
  zh: "中文",
};

const OAUTH_KEYS: Record<"kakao" | "naver" | "apple" | "google", string> = {
  kakao: "mypage.oauthKakao",
  naver: "mypage.oauthNaver",
  apple: "mypage.oauthApple",
  google: "mypage.oauthGoogle",
};

export default function ProfileView({
  user,
  isLoggedIn,
  onLoginPress,
  onEditPress,
  onMenuPress,
}: ProfileViewProps) {
  const { t } = useTranslation();

  const oauthLabel = useMemo(() => {
    if (!user.oauthProvider) return undefined;
    return t(OAUTH_KEYS[user.oauthProvider]);
  }, [user.oauthProvider, t]);

  const menuSections: MenuSection[] = useMemo(
    () => [
      {
        title: t("mypage.activitySection"),
        requireLogin: true,
        items: [
          { id: "wishlist", label: t("mypage.wishlistMenu"), showArrow: true },
          { id: "reports", label: t("mypage.reportsMenu"), showArrow: true },
        ],
      },
      {
        title: t("mypage.settingsSection"),
        items: [
          {
            id: "language",
            label: t("mypage.languageMenu"),
            showArrow: true,
            rightText: LANG_LABELS[i18n.language] ?? i18n.language,
          },
        ],
      },
      {
        title: t("mypage.infoSection"),
        items: [
          { id: "terms", label: t("mypage.terms"), showArrow: true },
          { id: "privacy", label: t("mypage.privacy"), showArrow: true },
          { id: "contact", label: t("mypage.contact"), showArrow: true },
          {
            id: "version",
            label: t("mypage.version"),
            showArrow: false,
            rightText: "1.0.0",
          },
        ],
      },
      {
        title: t("mypage.accountSection"),
        requireLogin: true,
        items: [
          {
            id: "logout",
            label: t("mypage.logout"),
            showArrow: false,
            color: "#1a1a1a",
          },
          {
            id: "withdraw",
            label: t("mypage.withdraw"),
            showArrow: false,
            color: "#ff4444",
          },
        ],
      },
    ],
    [t],
  );

  const visibleSections = menuSections.filter(
    (s) => !s.requireLogin || isLoggedIn,
  );

  return (
    <View className="flex-1">
      {/* Header */}
      <View
        style={{
          height: 52,
          alignItems: "center",
          justifyContent: "center",
          borderBottomWidth: 1,
          borderBottomColor: "#e5e7eb",
        }}
      >
        <Text style={{ fontSize: 17, fontWeight: "700", color: "#1a1a1a" }}>
          {t("mypage.title")}
        </Text>
      </View>

      <ScrollView className="flex-1">
        {/* Profile Section */}
        <View style={{ paddingHorizontal: 20, paddingVertical: 20 }}>
          {/* Avatar */}
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: "#dedede",
              marginBottom: 12,
            }}
          />

          {isLoggedIn ? (
            <>
              <Text
                style={{ fontSize: 16, fontWeight: "700", color: "#1a1a1a" }}
              >
                {user.nickname}
              </Text>
              {oauthLabel && (
                <Text style={{ fontSize: 11, color: "#888888", marginTop: 8 }}>
                  {oauthLabel}
                </Text>
              )}
              {onEditPress && (
                <Pressable onPress={onEditPress}>
                  <Text
                    style={{
                      fontSize: 13,
                      color: "#e94b8c",
                      marginTop: 8,
                    }}
                  >
                    {t("mypage.editProfile")}
                  </Text>
                </Pressable>
              )}
            </>
          ) : (
            <>
              <Text
                style={{
                  fontSize: 14,
                  color: "#888888",
                  marginBottom: 12,
                  lineHeight: 20,
                }}
              >
                {t("mypage.loginPrompt")}
              </Text>
              <TouchableOpacity
                style={{
                  alignSelf: "flex-start",
                  backgroundColor: "#e94b8c",
                  borderRadius: 8,
                  paddingVertical: 8,
                  paddingHorizontal: 16,
                }}
                onPress={onLoginPress}
              >
                <Text
                  style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}
                >
                  {t("mypage.loginBtn")}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Divider */}
        <View style={{ height: 8, backgroundColor: "#f3f4f6" }} />

        {/* Menu Sections */}
        {visibleSections.map((section, sectionIndex) => (
          <View key={section.title}>
            <View
              style={{
                paddingHorizontal: 16,
                paddingVertical: 10,
                backgroundColor: "#fafafa",
              }}
            >
              <Text
                style={{ fontSize: 12, color: "#888888", fontWeight: "600" }}
              >
                {section.title}
              </Text>
            </View>

            {section.items.map((item, itemIndex) => (
              <View key={item.id}>
                <Pressable
                  onPress={() => onMenuPress(item.id)}
                  style={{
                    height: 52,
                    paddingHorizontal: 16,
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{ fontSize: 15, color: item.color || "#1a1a1a" }}
                  >
                    {item.label}
                  </Text>

                  {item.rightText ? (
                    <Text style={{ fontSize: 13, color: "#888888" }}>
                      {item.rightText}
                    </Text>
                  ) : item.showArrow !== false ? (
                    <Text style={{ fontSize: 16, color: "#aaaaaa" }}>›</Text>
                  ) : null}
                </Pressable>

                {itemIndex < section.items.length - 1 && (
                  <View
                    style={{
                      height: 1,
                      backgroundColor: "#f3f4f6",
                      marginHorizontal: 16,
                    }}
                  />
                )}
              </View>
            ))}

            {sectionIndex < visibleSections.length - 1 && (
              <View style={{ height: 8, backgroundColor: "#f3f4f6" }} />
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
