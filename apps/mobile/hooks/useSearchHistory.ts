import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const HISTORY_KEY = "@gacha_map/search_history";
const MAX = 10;

export function useSearchHistory() {
  const [history, setHistory] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(HISTORY_KEY).then((raw) => {
      if (raw) setHistory(JSON.parse(raw));
      setLoaded(true);
    });
  }, []);

  const addQuery = useCallback(
    (q: string) => {
      if (!loaded) return;
      setHistory((prev) => {
        const next = [q, ...prev.filter((x) => x !== q)].slice(0, MAX);
        AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
        return next;
      });
    },
    [loaded],
  );

  const removeQuery = useCallback(
    (q: string) => {
      if (!loaded) return;
      setHistory((prev) => {
        const next = prev.filter((x) => x !== q);
        AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
        return next;
      });
    },
    [loaded],
  );

  const clearAll = useCallback(() => {
    if (!loaded) return;
    setHistory([]);
    AsyncStorage.removeItem(HISTORY_KEY);
  }, [loaded]);

  return { history, addQuery, removeQuery, clearAll };
}
