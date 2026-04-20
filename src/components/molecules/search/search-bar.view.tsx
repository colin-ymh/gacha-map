"use client";

import styled from "styled-components";
import { useTranslations } from "next-intl";
import Input from "@/components/atoms/common/input";
import Button from "@/components/atoms/common/button";

// ── Styled ────────────────────────────────────────────────────────────────────

const Form = styled.form`
  display: flex;
  gap: 8px;
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
      <Button type="submit">{t("button")}</Button>
    </Form>
  );
};

export default SearchBarView;
