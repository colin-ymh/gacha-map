"use client";

import styled from "styled-components";

export type TabKey = "products" | "reviews";

export interface TabBarProps {
  tabs: { key: TabKey; label: string }[];
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
}

const Bar = styled.div`
  display: flex;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.white};
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 10;
`;

const TabButton = styled.button<{ $active: boolean }>`
  flex: 1;
  padding: 12px 0;
  background: none;
  border: none;
  border-bottom: 2px solid
    ${({ $active, theme }) => ($active ? theme.colors.primary : "transparent")};
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: ${({ $active }) => ($active ? "600" : "400")};
  color: ${({ $active, theme }) =>
    $active ? theme.colors.primary : theme.colors.gray500};
  cursor: pointer;
  transition:
    color 0.15s,
    border-color 0.15s;

  &:hover {
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const TabBar = ({ tabs, activeTab, onTabChange }: TabBarProps) => (
  <Bar>
    {tabs.map(({ key, label }) => (
      <TabButton
        key={key}
        $active={activeTab === key}
        onClick={() => onTabChange(key)}
      >
        {label}
      </TabButton>
    ))}
  </Bar>
);

export default TabBar;
