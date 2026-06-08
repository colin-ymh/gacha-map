import { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TouchableOpacity,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import {
  PRIMARY,
  TEXT_DARK,
  TEXT_GRAY,
  TEXT_PLACEHOLDER,
  TEXT_SECONDARY,
  WHITE,
  GRAY_100,
  GRAY_200,
  SURFACE_SUBTLE,
  THUMBNAIL_PLACEHOLDER,
  DANGER_BRIGHT,
} from "@/constants/colors";

interface UserProfile {
  nickname: string;
  oauthProvider?: "kakao" | "naver" | "apple" | "google";
  avatar_url?: string | null;
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
  isShopOwner?: boolean;
  contributionCount?: number;
  mainBadge?: { id: string; name: string; icon_url: string } | null;
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
  isShopOwner = false,
  contributionCount = 0,
  mainBadge,
  onLoginPress,
  onEditPress,
  onMenuPress,
}: ProfileViewProps) {
  const { t } = useTranslation();
  const [avatarError, setAvatarError] = useState(false);

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
          { id: "badges", label: t("mypage.badgesMenu"), showArrow: true },
          { id: "wishlist", label: t("mypage.wishlistMenu"), showArrow: true },
          { id: "reports", label: t("mypage.reportsMenu"), showArrow: true },
          ...(isShopOwner
            ? [
                {
                  id: "shopManagement",
                  label: t("mypage.shopManagementMenu"),
                  showArrow: true,
                },
              ]
            : [
                {
                  id: "myShop",
                  label: t("mypage.myShopMenu"),
                  showArrow: true,
                },
                {
                  id: "shopApplications",
                  label: t("mypage.shopApplicationsMenu"),
                  showArrow: true,
                },
              ]),
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
            color: TEXT_DARK,
          },
          {
            id: "withdraw",
            label: t("mypage.withdraw"),
            showArrow: false,
            color: DANGER_BRIGHT,
          },
        ],
      },
    ],
    [t, isShopOwner],
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
          borderBottomColor: GRAY_200,
        }}
      >
        <Text style={{ fontSize: 17, fontWeight: "700", color: TEXT_DARK }}>
          {t("mypage.title")}
        </Text>
      </View>

      <ScrollView className="flex-1">
        {/* Profile Section */}
        <View
          style={{
            paddingHorizontal: 20,
            paddingVertical: 16,
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
          }}
        >
          {/* Avatar */}
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: THUMBNAIL_PLACEHOLDER,
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              overflow: "hidden",
            }}
          >
            {user.avatar_url && !avatarError ? (
              <Image
                source={{ uri: user.avatar_url }}
                style={{ width: 56, height: 56 }}
                resizeMode="cover"
                onError={() => setAvatarError(true)}
              />
            ) : (
              <Ionicons name="person" size={28} color={TEXT_PLACEHOLDER} />
            )}
          </View>

          {isLoggedIn ? (
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{ fontSize: 16, fontWeight: "700", color: TEXT_DARK }}
                numberOfLines={1}
              >
                {user.nickname}
              </Text>
              {mainBadge && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    marginTop: 3,
                  }}
                >
                  <Text style={{ fontSize: 13 }}>
                    {mainBadge.icon_url?.startsWith("http")
                      ? "🏅"
                      : mainBadge.icon_url || "🏅"}
                  </Text>
                  <Text
                    style={{ fontSize: 11, color: PRIMARY, fontWeight: "600" }}
                  >
                    {mainBadge.name}
                  </Text>
                </View>
              )}
              {oauthLabel && (
                <Text style={{ fontSize: 11, color: TEXT_GRAY, marginTop: 2 }}>
                  {oauthLabel}
                </Text>
              )}
              {onEditPress && (
                <Pressable onPress={onEditPress} style={{ marginTop: 6 }}>
                  <Text style={{ fontSize: 13, color: PRIMARY }}>
                    {t("mypage.editProfile")}
                  </Text>
                </Pressable>
              )}
            </View>
          ) : (
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{
                  fontSize: 14,
                  color: TEXT_GRAY,
                  marginBottom: 10,
                  lineHeight: 20,
                }}
              >
                {t("mypage.loginPrompt")}
              </Text>
              <TouchableOpacity
                style={{
                  alignSelf: "flex-start",
                  backgroundColor: PRIMARY,
                  borderRadius: 8,
                  paddingVertical: 8,
                  paddingHorizontal: 16,
                }}
                onPress={onLoginPress}
              >
                <Text style={{ fontSize: 14, fontWeight: "700", color: WHITE }}>
                  {t("mypage.loginBtn")}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Divider */}
        <View style={{ height: 8, backgroundColor: GRAY_100 }} />

        {/* Menu Sections */}
        {visibleSections.map((section, sectionIndex) => (
          <View key={section.title}>
            <View
              style={{
                paddingHorizontal: 16,
                paddingVertical: 10,
                backgroundColor: SURFACE_SUBTLE,
              }}
            >
              <Text
                style={{ fontSize: 12, color: TEXT_GRAY, fontWeight: "600" }}
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
                    style={{ fontSize: 15, color: item.color ?? TEXT_DARK }}
                  >
                    {item.label}
                  </Text>

                  {item.rightText ? (
                    <Text style={{ fontSize: 13, color: TEXT_GRAY }}>
                      {item.rightText}
                    </Text>
                  ) : item.showArrow !== false ? (
                    <Text style={{ fontSize: 16, color: TEXT_PLACEHOLDER }}>
                      ›
                    </Text>
                  ) : null}
                </Pressable>

                {itemIndex < section.items.length - 1 && (
                  <View
                    style={{
                      height: 1,
                      backgroundColor: GRAY_100,
                      marginHorizontal: 16,
                    }}
                  />
                )}
              </View>
            ))}

            {sectionIndex < visibleSections.length - 1 && (
              <View style={{ height: 8, backgroundColor: GRAY_100 }} />
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
