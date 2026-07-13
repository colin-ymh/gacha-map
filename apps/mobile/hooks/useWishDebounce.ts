import { useRef, useEffect, useCallback } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  optimisticToggleWish,
  toggleWishAndPersistAsync,
} from "@/store/slices/wishlist.slice";
import { addPendingBadge } from "@/store/slices/auth.slice";
import { useWishToast } from "@/components/ui/WishToast";

const DEBOUNCE_MS = 400;

export function useWishDebounce() {
  const dispatch = useAppDispatch();
  const wishedShopIds = useAppSelector((s) => s.wishlist.shopIds);
  const isLoggedIn = useAppSelector((s) => s.auth.isLoggedIn);
  const { showToast } = useWishToast();

  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const initialStates = useRef<Map<string, boolean>>(new Map());
  const clickCounts = useRef<Map<string, number>>(new Map());

  const flush = useCallback(
    (shopId: string) => {
      const timer = timers.current.get(shopId);
      if (timer !== undefined) clearTimeout(timer);

      const count = clickCounts.current.get(shopId) ?? 0;
      const initialIsWished = initialStates.current.get(shopId);

      timers.current.delete(shopId);
      initialStates.current.delete(shopId);
      clickCounts.current.delete(shopId);

      if (count % 2 !== 0 && initialIsWished !== undefined) {
        dispatch(
          toggleWishAndPersistAsync({ shopId, isWished: initialIsWished }),
        )
          .unwrap()
          .then((result) => {
            if (result.action === "add" && result.newBadge) {
              dispatch(addPendingBadge(result.newBadge));
            }
          })
          .catch(() => {
            showToast("error");
          });
      }
    },
    [dispatch, showToast],
  );

  useEffect(() => {
    const timersSnapshot = timers.current;
    const shopIds = Array.from(timersSnapshot.keys());
    return () => {
      for (const shopId of shopIds) {
        flush(shopId);
      }
    };
  }, [flush]);

  const handleWishToggle = useCallback(
    (shopId: string, onLoginRequired?: () => void) => {
      if (isLoggedIn === false) {
        onLoginRequired?.();
        return;
      }

      const wasWished = wishedShopIds.includes(shopId);

      if (!initialStates.current.has(shopId)) {
        initialStates.current.set(shopId, wasWished);
      }

      const count = (clickCounts.current.get(shopId) ?? 0) + 1;
      clickCounts.current.set(shopId, count);

      // 로컬 즉시 반영
      dispatch(optimisticToggleWish({ shopId, wasWished }));
      showToast(wasWished ? "removed" : "added");

      const prev = timers.current.get(shopId);
      if (prev !== undefined) clearTimeout(prev);

      // 서버 동기화는 백그라운드에서
      timers.current.set(
        shopId,
        setTimeout(() => {
          const finalCount = clickCounts.current.get(shopId) ?? 0;
          const initialIsWished = initialStates.current.get(shopId);

          timers.current.delete(shopId);
          initialStates.current.delete(shopId);
          clickCounts.current.delete(shopId);

          if (finalCount % 2 !== 0 && initialIsWished !== undefined) {
            dispatch(
              toggleWishAndPersistAsync({
                shopId,
                isWished: initialIsWished,
              }),
            )
              .unwrap()
              .then((result) => {
                if (result.action === "add" && result.newBadge) {
                  dispatch(addPendingBadge(result.newBadge));
                }
              })
              .catch(() => {
                showToast("error");
              });
          }
        }, DEBOUNCE_MS),
      );
    },
    [dispatch, isLoggedIn, wishedShopIds, showToast],
  );

  return { handleWishToggle };
}
