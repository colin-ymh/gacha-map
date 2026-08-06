import { useCallback, useEffect, useState } from "react";
import { getAuthHeaders } from "@/lib/supabase";
import type { GachaDailyQuota } from "@gacha-map/shared";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

/**
 * 오늘 남은 뽑기 횟수.
 *
 * 서버가 유일한 계산 주체다 (get_daily_roll_quota RPC). 앱은 base + bonus - used를
 * 직접 계산하지 않는다 — 친구 초대 보너스가 다른 기기에서 늘어날 수 있어서
 * 로컬 계산은 반드시 어긋난다.
 *
 * 화면에 들어올 때와 뽑기 직후에 refetch 한다.
 */
export function useDailyQuota(isLoggedIn: boolean) {
  const [quota, setQuota] = useState<GachaDailyQuota | null>(null);

  const refetch = useCallback(async () => {
    if (!isLoggedIn) {
      setQuota(null);
      return;
    }

    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/gacha/quota`, { headers });
      if (!res.ok) return;
      setQuota((await res.json()) as GachaDailyQuota);
    } catch {
      // 조회 실패 시 직전 값을 유지한다. 뽑기 자체는 서버가 다시 막아준다.
    }
  }, [isLoggedIn]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { quota, setQuota, refetch };
}
