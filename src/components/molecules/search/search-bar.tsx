"use client";

import { useRouter } from "@/i18n/navigation";
import SearchBarView from "./search-bar.view";

interface SearchBarProps {
  defaultValue?: string;
  placeholder?: string;
}

const SearchBar = ({ defaultValue, placeholder }: SearchBarProps) => {
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
    <SearchBarView
      defaultValue={defaultValue}
      placeholder={placeholder}
      onSubmit={handleSubmit}
    />
  );
};

export default SearchBar;
