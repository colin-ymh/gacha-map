"use client";

import styled from "styled-components";
import { useTranslations } from "next-intl";
import Input from "@/components/atoms/common/input";
import { SearchIcon } from "@/components/atoms/icons";

// ── Styled ────────────────────────────────────────────────────────────────────

const Form = styled.form`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const SubmitButton = styled.button`
  width: 40px;
  height: 40px;
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  background: ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.white};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
`;

// ── View ──────────────────────────────────────────────────────────────────────

interface SearchBarViewProps {
  defaultValue?: string;
  placeholder?: string;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}

const SearchBarView = ({
  defaultValue,
  placeholder,
  onSubmit,
}: SearchBarViewProps) => {
  const t = useTranslations("search");

  return (
    <Form onSubmit={onSubmit}>
      <Input
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder ?? t("placeholder")}
      />
      <SubmitButton type="submit" aria-label={t("button")}>
        <SearchIcon size={18} />
      </SubmitButton>
    </Form>
  );
};

export default SearchBarView;
