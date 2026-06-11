"use client";

import styled from "styled-components";
import {
  PRIMARY,
  GRAY_200,
  TEXT_DARK,
  TAB_INACTIVE_TEXT,
} from "@/styles/color";

interface SearchTabsViewProps {
  activeTab: "shop" | "gacha";
  tabs: Array<{ key: "shop" | "gacha"; label: string }>;
  onTabChange: (tab: "shop" | "gacha") => void;
}

const TabsContainer = styled.div`
  display: flex;
  border-bottom: 1px solid ${GRAY_200};
  margin-top: 16px;
  margin-bottom: 16px;
`;

const Tab = styled.button<{ $isActive: boolean }>`
  flex: 1;
  padding: 12px 0;
  border: none;
  background: none;
  font-size: 16px;
  font-weight: 500;
  color: ${({ $isActive }) => ($isActive ? TEXT_DARK : TAB_INACTIVE_TEXT)};
  cursor: pointer;
  transition: color 0.2s ease;
  position: relative;

  &:hover {
    color: ${TEXT_DARK};
  }

  ${({ $isActive }) =>
    $isActive &&
    `
      &::after {
        content: '';
        position: absolute;
        bottom: -1px;
        left: 0;
        right: 0;
        height: 2px;
        background-color: ${PRIMARY};
      }
    `}
`;

export default function SearchTabsView({
  activeTab,
  tabs,
  onTabChange,
}: SearchTabsViewProps) {
  return (
    <TabsContainer>
      {tabs.map((tab) => (
        <Tab
          key={tab.key}
          $isActive={activeTab === tab.key}
          onClick={() => onTabChange(tab.key)}
        >
          {tab.label}
        </Tab>
      ))}
    </TabsContainer>
  );
}
