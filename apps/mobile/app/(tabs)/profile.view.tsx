import { View, Text, ScrollView, Pressable } from "react-native";

interface UserProfile {
  nickname: string;
  oauthProvider: "kakao" | "apple" | "google";
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
}

interface ProfileViewProps {
  user: UserProfile;
  onEditPress?: () => void;
  onMenuPress: (menuId: string) => void;
}

const OAUTH_LABELS: Record<string, string> = {
  kakao: "카카오 계정으로 로그인됨",
  apple: "Apple 계정으로 로그인됨",
  google: "Google 계정으로 로그인됨",
};

const MENU_SECTIONS: MenuSection[] = [
  {
    title: "내 활동",
    items: [
      { id: "wishlist", label: "찜 목록", showArrow: true },
      { id: "reports", label: "제보 내역", showArrow: true },
    ],
  },
  {
    title: "앱 설정",
    items: [{ id: "language", label: "언어", showArrow: true }],
  },
  {
    title: "정보",
    items: [
      { id: "terms", label: "이용약관", showArrow: true },
      { id: "privacy", label: "개인정보처리방침", showArrow: true },
      { id: "contact", label: "문의하기", showArrow: true },
      {
        id: "version",
        label: "버전 정보",
        showArrow: false,
        rightText: "1.0.0",
      },
    ],
  },
  {
    title: "계정 관리",
    items: [
      { id: "logout", label: "로그아웃", showArrow: false, color: "#1a1a1a" },
      { id: "withdraw", label: "회원탈퇴", showArrow: false, color: "#ff4444" },
    ],
  },
];

export default function ProfileView({
  user,
  onEditPress,
  onMenuPress,
}: ProfileViewProps) {
  return (
    <View className="flex-1">
      {/* Header */}
      <View
        className="h-[52px] items-center justify-center border-b border-gray-200"
        style={{ borderBottomWidth: 1, borderBottomColor: "#e5e7eb" }}
      >
        <Text style={{ fontSize: 17, fontWeight: "700", color: "#1a1a1a" }}>
          마이페이지
        </Text>
      </View>

      <ScrollView className="flex-1">
        {/* Profile Section */}
        <View
          className="px-5 py-5"
          style={{ paddingHorizontal: 20, paddingVertical: 20 }}
        >
          {/* Avatar */}
          <View
            className="rounded-full bg-gray-300 mb-3"
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: "#dedede",
              marginBottom: 12,
            }}
          />

          {/* Nickname */}
          <Text
            style={{
              fontSize: 16,
              fontWeight: "700",
              color: "#1a1a1a",
            }}
          >
            {user.nickname}
          </Text>

          {/* OAuth Info */}
          <Text
            style={{
              fontSize: 11,
              color: "#888888",
              marginTop: 8,
            }}
          >
            {OAUTH_LABELS[user.oauthProvider]}
          </Text>

          {/* Edit Button */}
          <Pressable onPress={onEditPress}>
            <Text
              style={{
                fontSize: 13,
                color: "#e63946",
                marginTop: 8,
              }}
            >
              편집 ›
            </Text>
          </Pressable>
        </View>

        {/* Divider */}
        <View
          style={{
            height: 8,
            backgroundColor: "#f3f4f6",
          }}
        />

        {/* Menu Sections */}
        {MENU_SECTIONS.map((section, sectionIndex) => (
          <View key={section.title}>
            {/* Section Header */}
            <View
              className="px-4 py-2.5"
              style={{
                paddingHorizontal: 16,
                paddingVertical: 10,
                backgroundColor: "#fafafa",
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  color: "#888888",
                  fontWeight: "600",
                }}
              >
                {section.title}
              </Text>
            </View>

            {/* Menu Items */}
            {section.items.map((item, itemIndex) => (
              <View key={item.id}>
                <Pressable
                  onPress={() => onMenuPress(item.id)}
                  className="h-[52px] px-4 flex-row justify-between items-center"
                  style={{
                    height: 52,
                    paddingHorizontal: 16,
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      color: item.color || "#1a1a1a",
                    }}
                  >
                    {item.label}
                  </Text>

                  {item.rightText ? (
                    <Text
                      style={{
                        fontSize: 13,
                        color: "#888888",
                      }}
                    >
                      {item.rightText}
                    </Text>
                  ) : item.showArrow !== false ? (
                    <Text
                      style={{
                        fontSize: 16,
                        color: "#aaaaaa",
                      }}
                    >
                      ›
                    </Text>
                  ) : null}
                </Pressable>

                {/* Item Separator */}
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

            {/* Section Separator */}
            {sectionIndex < MENU_SECTIONS.length - 1 && (
              <View
                style={{
                  height: 8,
                  backgroundColor: "#f3f4f6",
                }}
              />
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
