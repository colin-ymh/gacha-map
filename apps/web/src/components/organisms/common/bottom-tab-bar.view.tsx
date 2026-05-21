"use client";

import styled from "styled-components";
import {
  HomeIcon,
  HeartOutlineIcon,
  PersonIcon,
} from "@/components/atoms/icons";
import { WHITE, PRIMARY, TEXT_GRAY } from "@/styles/color";
import type { ActiveTab } from "./bottom-tab-bar";

interface BottomTabBarViewProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
}

const Bar = styled.nav`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 56px;
  background: ${WHITE};
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: stretch;
  z-index: 200;

  @media (min-width: 769px) {
    display: none;
  }
`;

const Tab = styled.button<{ $active: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  flex: 1;
  background: none;
  border: none;
  cursor: pointer;
  color: ${({ $active }) => ($active ? PRIMARY : TEXT_GRAY)};
  padding: 0;
  transition: color 0.15s;
`;

const TabLabel = styled.span`
  font-size: 10px;
  font-weight: 500;
  line-height: 1;
`;

const BottomTabBarView = ({
  activeTab,
  onTabChange,
}: BottomTabBarViewProps) => (
  <Bar>
    <Tab $active={activeTab === "home"} onClick={() => onTabChange("home")}>
      <HomeIcon size={20} />
      <TabLabel>홈</TabLabel>
    </Tab>
    <Tab
      $active={activeTab === "wishlist"}
      onClick={() => onTabChange("wishlist")}
    >
      <HeartOutlineIcon size={20} />
      <TabLabel>찜</TabLabel>
    </Tab>
    <Tab $active={activeTab === "mypage"} onClick={() => onTabChange("mypage")}>
      <PersonIcon size={20} />
      <TabLabel>마이페이지</TabLabel>
    </Tab>
  </Bar>
);

export default BottomTabBarView;
