import { useMemo, useState } from "react";
import Constants from "expo-constants";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TouchableOpacity,
  Image,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import {
  PRIMARY,
  PRIMARY_BG,
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
import GachaPlaceholder from "@/components/ui/GachaPlaceholder";
import { LiquidGlass } from "@/components/ui/LiquidGlass";
import { GlassModalButton } from "@/components/ui/GlassModal";
import { useLiquidGlassPress } from "@/hooks/useLiquidGlassPress";

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
  hasShopApplications?: boolean;
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
  hasShopApplications = false,
  contributionCount = 0,
  mainBadge,
  onLoginPress,
  onEditPress,
  onMenuPress,
}: ProfileViewProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
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
          {
            id: "collections",
            label: t("mypage.collectionsMenu"),
            showArrow: true,
          },
          { id: "wishlist", label: t("mypage.wishlistMenu"), showArrow: true },
          { id: "reports", label: t("mypage.reportsMenu"), showArrow: true },
          {
            id: "notificationSettings",
            label: t("mypage.notificationSettingsMenu"),
            showArrow: true,
          },
          ...(isShopOwner
            ? [
                {
                  id: "shopManagement",
                  label: t("mypage.shopManagementMenu"),
                  showArrow: true,
                },
              ]
            : hasShopApplications
              ? [
                  {
                    id: "shopApplications",
                    label: t("mypage.shopApplicationsMenu"),
                    showArrow: true,
                  },
                ]
              : [
                  {
                    id: "myShop",
                    label: t("mypage.myShopMenu"),
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
            rightText: Constants.expoConfig?.version ?? "1.0.0",
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
    [t, isShopOwner, hasShopApplications],
  );

  const visibleSections = menuSections.filter(
    (s) => !s.requireLogin || isLoggedIn,
  );

  return (
    <View className="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
      >
        {/* Profile Section */}
        <View
          style={{
            paddingHorizontal: 20,
            paddingVertical: 24,
            flexDirection: "row",
            alignItems: "center",
            gap: 16,
          }}
        >
          {/* Avatar */}
          <View
            style={{
              width: 62,
              height: 62,
              borderRadius: 31,
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
                style={{ width: 62, height: 62 }}
                resizeMode="cover"
                onError={() => setAvatarError(true)}
              />
            ) : (
              <GachaPlaceholder size={62} borderRadius={31} />
            )}
          </View>

          {isLoggedIn ? (
            <View style={{ flex: 1, minWidth: 0 }}>
              {/* badge + nickname + edit button on one row */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {mainBadge && (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 3,
                      backgroundColor: PRIMARY_BG,
                      borderRadius: 99,
                      paddingHorizontal: 7,
                      paddingVertical: 2,
                    }}
                  >
                    {mainBadge.icon_url?.startsWith("http") ? (
                      <Image
                        source={{ uri: mainBadge.icon_url }}
                        style={{ width: 12, height: 12, borderRadius: 6 }}
                        resizeMode="contain"
                      />
                    ) : (
                      <Text style={{ fontSize: 11 }}>
                        {mainBadge.icon_url || "🏅"}
                      </Text>
                    )}
                    <Text
                      style={{
                        fontSize: 12,
                        color: PRIMARY,
                        fontWeight: "600",
                      }}
                    >
                      {mainBadge.name}
                    </Text>
                  </View>
                )}
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "700",
                    color: TEXT_DARK,
                    flex: 1,
                  }}
                  numberOfLines={1}
                >
                  {user.nickname}
                </Text>
                {onEditPress && <GlassEditButton onPress={onEditPress} />}
              </View>
              {oauthLabel && (
                <Text style={{ fontSize: 12, color: TEXT_GRAY, marginTop: 4 }}>
                  {oauthLabel}
                </Text>
              )}
            </View>
          ) : (
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{
                  fontSize: 14,
                  color: TEXT_GRAY,
                  marginBottom: 12,
                  lineHeight: 20,
                }}
              >
                {t("mypage.loginPrompt")}
              </Text>
              <GlassModalButton
                label={t("mypage.loginBtn")}
                onPress={onLoginPress ?? (() => {})}
                style={{ alignSelf: "flex-start", width: 120 }}
              />
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
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={TEXT_PLACEHOLDER}
                    />
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

function GlassEditButton({ onPress }: { onPress: () => void }) {
  const { onPressIn, onPressOut, animatedStyle, brightnessValue } =
    useLiquidGlassPress();
  return (
    <LiquidGlass
      borderRadius={14}
      style={animatedStyle}
      brightnessOpacity={brightnessValue}
    >
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
        hitSlop={4}
        style={{
          paddingHorizontal: 12,
          height: 30,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: 13, fontWeight: "600", color: TEXT_GRAY }}>
          수정
        </Text>
      </TouchableOpacity>
    </LiquidGlass>
  );
}
