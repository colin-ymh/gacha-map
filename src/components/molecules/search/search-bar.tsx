"use client";

import styled from "styled-components";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import Input from "@/components/atoms/common/input";
import Button from "@/components/atoms/common/button";

interface SearchBarProps {
  defaultValue?: string;
  placeholder?: string;
}

const Form = styled.form`
  display: flex;
  gap: 8px;
`;

const SearchBar = ({ defaultValue, placeholder }: SearchBarProps) => {
  const t = useTranslations("search");
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const q = (form.elements.namedItem("q") as HTMLInputElement).value.trim();
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    router.push(`/search?${params.toString()}`);
  };

  return (
    <Form onSubmit={handleSubmit}>
      <Input
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder ?? t("placeholder")}
      />
      <Button type="submit">{t("button")}</Button>
    </Form>
  );
};

export default SearchBar;
