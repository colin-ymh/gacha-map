import { Tabs } from "expo-router";
import GlassTabBar from "@/components/ui/GlassTabBar";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <GlassTabBar {...props} />}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="map" />
      <Tabs.Screen name="browse" />
      <Tabs.Screen name="search" />
      <Tabs.Screen name="profile" />
      {/* view 파일들이 Expo Router에 의해 자동 탭으로 등록되는 것 방지 */}
      <Tabs.Screen name="browse.view" options={{ href: null }} />
      <Tabs.Screen name="search.view" options={{ href: null }} />
      <Tabs.Screen name="profile.view" options={{ href: null }} />
    </Tabs>
  );
}
