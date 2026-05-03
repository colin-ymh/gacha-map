import { Tabs } from "expo-router";
import { View, Text } from "react-native";

const ACTIVE_COLOR = "#e94b8c";
const INACTIVE_COLOR = "#888888";

function TabIcon({
  icon,
  label,
  focused,
}: {
  icon: string;
  label: string;
  focused: boolean;
}) {
  const color = focused ? ACTIVE_COLOR : INACTIVE_COLOR;
  return (
    <View className="items-center justify-center gap-0.5">
      <Text style={{ color, fontSize: 14 }}>{icon}</Text>
      <Text style={{ color, fontSize: 11 }}>{label}</Text>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          height: 55,
          borderTopWidth: 1,
          borderTopColor: "#e5e7eb",
          backgroundColor: "#ffffff",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "홈",
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="⌂" label="홈" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "찜",
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="♡" label="찜" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "마이페이지",
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="○" label="마이페이지" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
