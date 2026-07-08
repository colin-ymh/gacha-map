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
        tabBarShowLabel: false,
        tabBarActiveTintColor: ACTIVE_COLOR,
        tabBarInactiveTintColor: INACTIVE_COLOR,
        tabBarStyle: {
          height: tabBarHeight,
          paddingBottom: insets.bottom,
          borderTopWidth: 1,
          borderTopColor: GRAY_200,
          backgroundColor: WHITE,
        },
        tabBarIconStyle: { marginTop: 8 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={focused ? "dice" : "dice-outline"}
              size={28}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={focused ? "map" : "map-outline"}
              size={28}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={focused ? "heart" : "heart-outline"}
              size={28}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={focused ? "person" : "person-outline"}
              size={28}
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
