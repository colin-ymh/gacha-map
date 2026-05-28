import { useState, useRef, useCallback, useEffect } from "react";
import type { GachaProduct } from "@gacha-map/shared";
import GachaProductSearchView from "./GachaProductSearch.view";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";
const DEBOUNCE_MS = 300;

interface GachaProductSearchProps {
  onSelect: (product: GachaProduct) => void;
  placeholder?: string;
}

const GachaProductSearch = ({
  onSelect,
  placeholder,
}: GachaProductSearchProps) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GachaProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cache = useRef<Map<string, GachaProduct[]>>(new Map());
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortController = useRef<AbortController | null>(null);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    const key = q.trim().toLowerCase();

    if (cache.current.has(key)) {
      setResults(cache.current.get(key)!);
      setIsLoading(false);
      return;
    }

    abortController.current?.abort();
    abortController.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `${API_BASE}/api/gacha-products?q=${encodeURIComponent(q.trim())}&limit=20`,
        { signal: abortController.current.signal },
      );

      if (!res.ok) throw new Error("Search failed");

      const data = await res.json();
      const products: GachaProduct[] = data.products ?? [];

      cache.current.set(key, products);
      setResults(products);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError("검색 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (!query.trim()) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    debounceTimer.current = setTimeout(() => {
      search(query);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query, search]);

  useEffect(() => {
    return () => {
      abortController.current?.abort();
    };
  }, []);

  return (
    <GachaProductSearchView
      query={query}
      results={results}
      isLoading={isLoading}
      error={error}
      placeholder={placeholder}
      onQueryChange={setQuery}
      onSelect={onSelect}
    />
  );
};

export default GachaProductSearch;
