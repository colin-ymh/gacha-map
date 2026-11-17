"use client";

import { useEffect, useState } from "react";

export interface ShopApplicationCandidate {
  id: string;
  name: string;
  address: string | null;
  claimable: boolean;
}

export function useShopApplicationCandidates(
  name: string,
  enabled: boolean,
  lookup: (query: string, signal: AbortSignal) => Promise<ShopApplicationCandidate[]>,
) {
  const query = name.trim();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    query: string;
    attempt: number;
    items: ShopApplicationCandidate[];
    failed: boolean;
  }>();
  const active =
    enabled && (query.match(/[\p{L}\p{N}]/gu)?.length ?? 0) >= 2;

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    const { signal } = controller;
    const timer = setTimeout(async () => {
      try {
        const items = await lookup(query, signal);
        if (!signal.aborted) setResult({ query, attempt, items, failed: false });
      } catch {
        if (!signal.aborted) setResult({ query, attempt, items: [], failed: true });
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [active, attempt, lookup, query]);

  const current = active && result?.query === query && result.attempt === attempt
    ? result
    : undefined;
  return {
    items: current?.items.filter((shop) => shop.claimable).slice(0, 2) ?? [],
    failed: current?.failed ?? false,
    retry: () => setAttempt((value) => value + 1),
  };
}
