import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { fetchShops } from "@gacha-map/shared";
import type { ShopSummary, Bounds } from "@gacha-map/shared";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";
const CACHE_SIZE = 8;
const CACHE_TTL_MS = 5 * 60 * 1000;

interface BoundsCacheEntry {
  bounds: Bounds;
  shops: ShopSummary[];
  timestamp: number;
}

interface ShopsState {
  shops: ShopSummary[];
  boundsCache: BoundsCacheEntry[];
  loading: boolean;
  error: string | null;
}

const initialState: ShopsState = {
  shops: [],
  boundsCache: [],
  loading: false,
  error: null,
};

function boundsContains(outer: Bounds, inner: Bounds): boolean {
  return (
    outer.swLat <= inner.swLat &&
    outer.swLng <= inner.swLng &&
    outer.neLat >= inner.neLat &&
    outer.neLng >= inner.neLng
  );
}

function boundsOverlapRatio(cache: Bounds, req: Bounds): number {
  const iSwLat = Math.max(cache.swLat, req.swLat);
  const iSwLng = Math.max(cache.swLng, req.swLng);
  const iNeLat = Math.min(cache.neLat, req.neLat);
  const iNeLng = Math.min(cache.neLng, req.neLng);
  if (iSwLat >= iNeLat || iSwLng >= iNeLng) return 0;
  const iArea = (iNeLat - iSwLat) * (iNeLng - iSwLng);
  const reqArea = (req.neLat - req.swLat) * (req.neLng - req.swLng);
  return iArea / reqArea;
}

function filterToViewport(shops: ShopSummary[], bounds: Bounds): ShopSummary[] {
  return shops.filter(
    (s) =>
      s.lat >= bounds.swLat &&
      s.lat <= bounds.neLat &&
      s.lng >= bounds.swLng &&
      s.lng <= bounds.neLng,
  );
}

const shopsSlice = createSlice({
  name: "shops",
  initialState,
  reducers: {
    setShops(state, action: PayloadAction<ShopSummary[]>) {
      state.shops = action.payload;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
      if (action.payload) state.error = null;
    },
    fetchSuccess(
      state,
      action: PayloadAction<{ shops: ShopSummary[]; bounds: Bounds }>,
    ) {
      state.loading = false;
      state.shops = action.payload.shops;
      const entry: BoundsCacheEntry = {
        bounds: action.payload.bounds,
        shops: action.payload.shops,
        timestamp: Date.now(),
      };
      state.boundsCache = [
        entry,
        ...state.boundsCache.slice(0, CACHE_SIZE - 1),
      ];
    },
    fetchError(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },
  },
});

type ThunkDispatch = (
  action: ReturnType<
    (typeof shopsSlice.actions)[keyof typeof shopsSlice.actions]
  >,
) => void;
type ThunkGetState = () => { shops: ShopsState };

export const fetchShopsByBoundsAsync =
  (bounds: Bounds) =>
  async (dispatch: ThunkDispatch, getState: ThunkGetState) => {
    const { shops: state } = getState();
    const now = Date.now();

    // Full cache hit: cached bounds completely covers the requested bounds
    const fullHit = state.boundsCache.find(
      (entry) =>
        now - entry.timestamp < CACHE_TTL_MS &&
        boundsContains(entry.bounds, bounds),
    );

    if (fullHit) {
      dispatch(
        shopsSlice.actions.setShops(filterToViewport(fullHit.shops, bounds)),
      );
      return;
    }

    // Partial cache hit (≥80% overlap): show stale data immediately, fetch fresh in background
    let hasPartialCache = false;
    for (const entry of state.boundsCache) {
      if (now - entry.timestamp >= CACHE_TTL_MS) continue;
      if (boundsOverlapRatio(entry.bounds, bounds) >= 0.8) {
        dispatch(
          shopsSlice.actions.setShops(filterToViewport(entry.shops, bounds)),
        );
        hasPartialCache = true;
        break;
      }
    }

    if (!hasPartialCache) {
      dispatch(shopsSlice.actions.setLoading(true));
    }

    try {
      const result = await fetchShops(API_BASE, { bounds, limit: 100 });
      dispatch(
        shopsSlice.actions.fetchSuccess({ shops: result.shops, bounds }),
      );
    } catch (e) {
      if (!hasPartialCache) {
        dispatch(shopsSlice.actions.fetchError((e as Error).message));
      }
    }
  };

export default shopsSlice.reducer;
