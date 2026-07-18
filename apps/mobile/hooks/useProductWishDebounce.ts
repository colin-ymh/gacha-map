import { useRef, useEffect, useCallback } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  optimisticToggleProductWish,
  toggleProductWishAndPersistAsync,
} from "@/store/slices/product-wishlist.slice";
import { useWishToast } from "@/components/ui/WishToast";

const DEBOUNCE_MS = 400;

export function useProductWishDebounce() {
  const dispatch = useAppDispatch();
  const wishedProductIds = useAppSelector((s) => s.productWishlist.productIds);
  const isLoggedIn = useAppSelector((s) => s.auth.isLoggedIn);
  const { showToast } = useWishToast();

  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const initialStates = useRef<Map<string, boolean>>(new Map());
  const clickCounts = useRef<Map<string, number>>(new Map());

  const flush = useCallback(
    (productId: string) => {
      const timer = timers.current.get(productId);
      if (timer !== undefined) clearTimeout(timer);

      const count = clickCounts.current.get(productId) ?? 0;
      const initialIsWished = initialStates.current.get(productId);

      timers.current.delete(productId);
      initialStates.current.delete(productId);
      clickCounts.current.delete(productId);

      if (count % 2 !== 0 && initialIsWished !== undefined) {
        dispatch(
          toggleProductWishAndPersistAsync({
            productId,
            isWished: initialIsWished,
          }),
        )
          .unwrap()
          .catch(() => {
            showToast("error");
          });
      }
    },
    [dispatch, showToast],
  );

  useEffect(() => {
    const timersSnapshot = timers.current;
    const productIds = Array.from(timersSnapshot.keys());
    return () => {
      for (const productId of productIds) {
        flush(productId);
      }
    };
  }, [flush]);

  const handleProductWishToggle = useCallback(
    (productId: string, onLoginRequired?: () => void) => {
      if (isLoggedIn === false) {
        onLoginRequired?.();
        return;
      }

      const wasWished = wishedProductIds.includes(productId);

      if (!initialStates.current.has(productId)) {
        initialStates.current.set(productId, wasWished);
      }

      const count = (clickCounts.current.get(productId) ?? 0) + 1;
      clickCounts.current.set(productId, count);

      dispatch(optimisticToggleProductWish({ productId, wasWished }));
      showToast(wasWished ? "removed" : "added");

      const prev = timers.current.get(productId);
      if (prev !== undefined) clearTimeout(prev);

      timers.current.set(
        productId,
        setTimeout(() => {
          const finalCount = clickCounts.current.get(productId) ?? 0;
          const initialIsWished = initialStates.current.get(productId);

          timers.current.delete(productId);
          initialStates.current.delete(productId);
          clickCounts.current.delete(productId);

          if (finalCount % 2 !== 0 && initialIsWished !== undefined) {
            dispatch(
              toggleProductWishAndPersistAsync({
                productId,
                isWished: initialIsWished,
              }),
            )
              .unwrap()
              .catch(() => {
                showToast("error");
              });
          }
        }, DEBOUNCE_MS),
      );
    },
    [dispatch, isLoggedIn, wishedProductIds, showToast],
  );

  return { handleProductWishToggle };
}
