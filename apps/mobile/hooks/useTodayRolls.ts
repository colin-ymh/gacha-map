import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "@gacha_map/today_rolls";

export type RolledEntry = {
  productId: string;
  productName: string;
  productImageUrl: string | null;
  variantId: string;
  variantName: string;
  variantImageUrl: string | null;
  rolledAt: string;
};

function todayKST(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

export function useTodayRolls() {
  const [rolls, setRolls] = useState<RolledEntry[]>([]);

  const load = useCallback(() => {
    AsyncStorage.getItem(KEY).then((raw) => {
      const all: RolledEntry[] = raw ? JSON.parse(raw) : [];
      const today = todayKST();
      setRolls(all.filter((r) => r.rolledAt.slice(0, 10) === today));
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const addRoll = useCallback((entry: Omit<RolledEntry, "rolledAt">) => {
    const next: RolledEntry = { ...entry, rolledAt: new Date().toISOString() };
    AsyncStorage.getItem(KEY).then((raw) => {
      const all: RolledEntry[] = raw ? JSON.parse(raw) : [];
      const today = todayKST();
      // 당일 데이터만 유지 + 같은 productId 중복 제거 후 최신으로 교체
      const filtered = all.filter(
        (r) => r.rolledAt.slice(0, 10) === today && r.productId !== entry.productId
      );
      const updated = [next, ...filtered];
      AsyncStorage.setItem(KEY, JSON.stringify(updated));
      setRolls(updated);
    });
  }, []);

  return { rolls, addRoll, reload: load };
}
