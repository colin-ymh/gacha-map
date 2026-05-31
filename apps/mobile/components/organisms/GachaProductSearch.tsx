import { useState, useRef, useCallback, useEffect } from "react";
import type { GachaProduct } from "@gacha-map/shared";
import GachaProductSearchView from "./GachaProductSearch.view";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";
const DEBOUNCE_MS = 300;

interface GachaProductSearchProps {
  onSelect: (product: GachaProduct) => void;
  placeholder?: string;
  onResultsChange?: (hasResults: boolean) => void;
}

const GachaProductSearch = ({
  onSelect,
  placeholder,
  onResultsChange,
}: GachaProductSearchProps) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GachaProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cache = useRef<Map<string, GachaProduct[]>>(new Map());
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
    const timer = setTimeout(() => {
      if (!query.trim()) {
        setResults([]);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      search(query);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, search]);

  useEffect(() => {
    return () => {
      abortController.current?.abort();
    };
  }, []);

  useEffect(() => {
    onResultsChange?.(results.length > 0);
  }, [results.length, onResultsChange]);

  return (
    <GachaProductSearchView
      query={query}
      results={results}
      isLoading={isLoading}
      error={error}
      placeholder={placeholder}
      onQueryChange={setQuery}
      onSelect={onSelect}
      onDismiss={() => setResults([])}
    />
  );
};

export default GachaProductSearch;
