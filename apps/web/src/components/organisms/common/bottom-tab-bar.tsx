"use client";

import BottomTabBarView from "./bottom-tab-bar.view";

export type ActiveTab = "home" | "wishlist" | "mypage";

interface BottomTabBarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
}

const BottomTabBar = ({ activeTab, onTabChange }: BottomTabBarProps) => (
  <BottomTabBarView activeTab={activeTab} onTabChange={onTabChange} />
);

export default BottomTabBar;
