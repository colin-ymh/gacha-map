"use client";

import styled from "styled-components";
import { useTranslations } from "next-intl";
import { PRIMARY, GRAY_100, GRAY_400, WHITE } from "@/styles/color";

export type SortOption = "name" | "distance" | "wishlist_count";

interface SortBarProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
}

const Container = styled.div`
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;

  /* Hide scrollbar for a cleaner look */
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
`;

const Chip = styled.button<{ $active: boolean }>`
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 10px;
  height: 26px;
  border-radius: 13px;
  border: none;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;

  ${({ $active }) => {
    if ($active) {
      return `
        background-color: ${PRIMARY};
        color: ${WHITE};
      `;
    } else {
      return `
        background-color: ${GRAY_100};
        color: ${GRAY_400};

        &:active {
          background-color: #e0e1e7;
        }
      `;
    }
  }}
`;

const SortBar = ({ value, onChange }: SortBarProps) => {
  const t = useTranslations("sortBar");

  const options: SortOption[] = ["name", "distance", "wishlist_count"];

  return (
    <Container>
      {options.map((option) => (
        <Chip
          key={option}
          $active={value === option}
          onClick={() => onChange(option)}
        >
          {t(option)}
        </Chip>
      ))}
    </Container>
  );
};

export default SortBar;
