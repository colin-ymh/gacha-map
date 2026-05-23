import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PRIMARY, TEXT_GRAY, GRAY_200, WHITE } from "@/constants/colors";

const ACTIVE_COLOR = PRIMARY;
const INACTIVE_COLOR = TEXT_GRAY;

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = Platform.OS === "ios" ? 49 + insets.bottom : 56;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: ACTIVE_COLOR,
        tabBarInactiveTintColor: INACTIVE_COLOR,
        tabBarLabelStyle: { fontSize: 11 },
        tabBarStyle: {
          height: tabBarHeight,
          paddingBottom: insets.bottom,
          borderTopWidth: 1,
          borderTopColor: GRAY_200,
          backgroundColor: WHITE,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "홈",
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={focused ? "home" : "home-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "찜",
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={focused ? "heart" : "heart-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "마이페이지",
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={focused ? "person" : "person-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />
      {/* view 파일들이 Expo Router에 의해 자동 탭으로 등록되는 것 방지 */}
      <Tabs.Screen name="search.view" options={{ href: null }} />
      <Tabs.Screen name="profile.view" options={{ href: null }} />
    </Tabs>
  );
}
