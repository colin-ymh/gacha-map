import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "@gacha_map/pinned_gacha";

export type PinnedGacha = {
  id: string;
  name: string;
  imageUrl: string | null;
};

export function usePinnedGacha() {
  const [pinned, setPinned] = useState<PinnedGacha | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((raw) => {
      if (raw) setPinned(JSON.parse(raw));
    });
  }, []);

  const pin = useCallback((gacha: PinnedGacha) => {
    AsyncStorage.setItem(KEY, JSON.stringify(gacha));
    setPinned(gacha);
  }, []);

  const unpin = useCallback(() => {
    AsyncStorage.removeItem(KEY);
    setPinned(null);
  }, []);

  const toggle = useCallback((gacha: PinnedGacha) => {
    setPinned((prev) => {
      if (prev?.id === gacha.id) {
        AsyncStorage.removeItem(KEY);
        return null;
      }
      AsyncStorage.setItem(KEY, JSON.stringify(gacha));
      return gacha;
    });
  }, []);

  return { pinned, pin, unpin, toggle };
}
