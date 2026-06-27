import { useState, useEffect, useCallback } from "react";
import { getAuthHeaders } from "@/lib/supabase";
import type { GachaProductVariant, GachaRollResult } from "@gacha-map/shared";

export type GachaRollStatus =
  | "idle"
  | "loading_variants"
  | "animating"
  | "result"
  | "already_rolled"
  | "no_variants"
  | "error";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";
const ANIMATION_DURATION_MS = 2500;

export function useGachaRoll(productId: string) {
  const [variants, setVariants] = useState<GachaProductVariant[]>([]);
  const [status, setStatus] = useState<GachaRollStatus>("loading_variants");
  const [result, setResult] = useState<GachaRollResult | null>(null);
  const [nextAvailableAt, setNextAvailableAt] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchVariants() {
      setStatus("loading_variants");
      try {
        const res = await fetch(
          `${API_BASE}/api/gacha-products/${productId}/variants`,
        );
        if (!res.ok) throw new Error("fetch_variants_failed");
        const json = await res.json();
        if (cancelled) return;

        const fetched: GachaProductVariant[] = json.variants ?? [];
        setVariants(fetched);
        setStatus(fetched.length === 0 ? "no_variants" : "idle");
      } catch {
        if (!cancelled) {
          setVariants([]);
          setStatus("idle");
        }
      }
    }

    fetchVariants();
    return () => {
      cancelled = true;
    };
  }, [productId]);

  const roll = useCallback(async () => {
    setStatus("animating");

    let headers: Record<string, string>;
    try {
      headers = await getAuthHeaders();
    } catch {
      setStatus("error");
      setErrorMessage("인증 정보를 가져오지 못했어요");
      return;
    }

    // Run animation timer and API call in parallel
    const [, res] = await Promise.all([
      new Promise<void>((resolve) => setTimeout(resolve, ANIMATION_DURATION_MS)),
      fetch(`${API_BASE}/api/gacha-products/${productId}/roll`, {
        method: "POST",
        headers,
      }).catch(() => null as null),
    ]);

    if (!res) {
      setStatus("error");
      setErrorMessage("네트워크 오류가 발생했어요");
      return;
    }

    const json = await res.json().catch(() => ({}));

    if (res.status === 409) {
      setNextAvailableAt((json as { nextAvailableAt?: string }).nextAvailableAt ?? null);
      setStatus("already_rolled");
      return;
    }

    if (res.status === 422 && (json as { error?: string }).error === "no_variants") {
      setStatus("no_variants");
      return;
    }

    if (!res.ok) {
      setStatus("error");
      setErrorMessage((json as { error?: string }).error ?? "알 수 없는 오류가 발생했어요");
      return;
    }

    setResult(json as GachaRollResult);
    setStatus("result");
  }, [productId]);

  return {
    variants,
    status,
    result,
    nextAvailableAt,
    errorMessage,
    roll,
  };
}
