import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { fetchShops } from "@gacha-map/shared";
import type { ShopSummary, Bounds, SortOption } from "@gacha-map/shared";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";
const CACHE_SIZE = 8;
const CACHE_TTL_MS = 5 * 60 * 1000;
const PAGE_LIMIT = 20;
// 뷰포트보다 20% 넓은 영역을 API에 요청해 경계 근처 마커 누락 방지
const BOUNDS_PADDING = 0.2;

interface BoundsCacheEntry {
  bounds: Bounds;
  sort: SortOption | undefined;
  shops: ShopSummary[];
  total: number;
  timestamp: number;
}

interface ShopsState {
  shops: ShopSummary[];
  total: number;
  offset: number;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  boundsCache: BoundsCacheEntry[];
  currentBounds: Bounds | null;
  currentSort: SortOption | undefined;
  userLocation: { lat: number; lng: number } | null;
}

const initialState: ShopsState = {
  shops: [],
  total: 0,
  offset: 0,
  hasMore: false,
  loading: false,
  loadingMore: false,
  error: null,
  boundsCache: [],
  currentBounds: null,
  currentSort: undefined,
  userLocation: null,
};

function applyPadding(bounds: Bounds): Bounds {
  const latDelta = bounds.neLat - bounds.swLat;
  const lngDelta = bounds.neLng - bounds.swLng;
  const latPad = latDelta * BOUNDS_PADDING;
  const lngPad = lngDelta * BOUNDS_PADDING;
  return {
    swLat: bounds.swLat - latPad,
    swLng: bounds.swLng - lngPad,
    neLat: bounds.neLat + latPad,
    neLng: bounds.neLng + lngPad,
  };
}

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
    setLoadingMore(state, action: PayloadAction<boolean>) {
      state.loadingMore = action.payload;
    },
    fetchSuccess(
      state,
      action: PayloadAction<{
        shops: ShopSummary[];
        total: number;
        bounds: Bounds;
        sort: SortOption | undefined;
      }>,
    ) {
      const { shops, total, bounds, sort } = action.payload;
      state.loading = false;
      state.shops = shops;
      state.total = total;
      state.offset = shops.length;
      state.hasMore = shops.length < total;
      state.currentBounds = bounds;
      state.currentSort = sort;

      const entry: BoundsCacheEntry = {
        bounds: applyPadding(bounds),
        sort,
        shops,
        total,
        timestamp: Date.now(),
      };
      state.boundsCache = [
        entry,
        ...state.boundsCache.slice(0, CACHE_SIZE - 1),
      ];
    },
    fetchMoreSuccess(
      state,
      action: PayloadAction<{ shops: ShopSummary[]; total: number }>,
    ) {
      const { shops, total } = action.payload;
      state.loadingMore = false;
      state.shops = [...state.shops, ...shops];
      state.total = total;
      state.offset = state.shops.length;
      state.hasMore = state.shops.length < total;
    },
    fetchError(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },
    setUserLocation(
      state,
      action: PayloadAction<{ lat: number; lng: number } | null>,
    ) {
      state.userLocation = action.payload;
    },
  },
});

export const { setUserLocation } = shopsSlice.actions;

type ThunkDispatch = (
  action: ReturnType<
    (typeof shopsSlice.actions)[keyof typeof shopsSlice.actions]
  >,
) => void;
type ThunkGetState = () => { shops: ShopsState };

export const fetchShopsByBoundsAsync =
  (
    viewportBounds: Bounds,
    sort?: SortOption,
    userLocation?: { lat: number; lng: number } | null,
  ) =>
  async (dispatch: ThunkDispatch, getState: ThunkGetState) => {
    const { shops: state } = getState();
    const now = Date.now();
    const paddedBounds = applyPadding(viewportBounds);

    // 정렬 기준이 같은 캐시만 재사용
    const matchingCache = state.boundsCache.filter(
      (e) => e.sort === sort && now - e.timestamp < CACHE_TTL_MS,
    );

    // Full cache hit
    const fullHit = matchingCache.find((e) =>
      boundsContains(e.bounds, paddedBounds),
    );
    if (fullHit) {
      dispatch(
        shopsSlice.actions.setShops(
          filterToViewport(fullHit.shops, viewportBounds),
        ),
      );
      return;
    }

    // Partial cache hit (≥80% overlap): 즉시 stale 데이터 표시 후 백그라운드 갱신
    let hasPartialCache = false;
    for (const entry of matchingCache) {
      if (boundsOverlapRatio(entry.bounds, paddedBounds) >= 0.8) {
        dispatch(
          shopsSlice.actions.setShops(
            filterToViewport(entry.shops, viewportBounds),
          ),
        );
        hasPartialCache = true;
        break;
      }
    }

    if (!hasPartialCache) {
      dispatch(shopsSlice.actions.setLoading(true));
    }

    try {
      const params: Parameters<typeof fetchShops>[1] = {
        bounds: paddedBounds,
        limit: PAGE_LIMIT,
        offset: 0,
        ...(sort && { sort }),
        ...(userLocation && {
          userLat: userLocation.lat,
          userLng: userLocation.lng,
        }),
      };
      const result = await fetchShops(API_BASE, params);
      dispatch(
        shopsSlice.actions.fetchSuccess({
          shops: result.shops,
          total: result.total,
          bounds: viewportBounds,
          sort,
        }),
      );
    } catch (e) {
      if (!hasPartialCache) {
        dispatch(shopsSlice.actions.fetchError((e as Error).message));
      }
    }
  };

export const loadMoreShopsByBoundsAsync =
  () => async (dispatch: ThunkDispatch, getState: ThunkGetState) => {
    const { shops: state } = getState();
    if (!state.hasMore || state.loadingMore || !state.currentBounds) return;

    const snapshotBounds = state.currentBounds;
    const snapshotSort = state.currentSort;

    dispatch(shopsSlice.actions.setLoadingMore(true));

    try {
      const paddedBounds = applyPadding(snapshotBounds);
      const params: Parameters<typeof fetchShops>[1] = {
        bounds: paddedBounds,
        limit: PAGE_LIMIT,
        offset: state.offset,
        ...(snapshotSort && { sort: snapshotSort }),
        ...(state.userLocation && {
          userLat: state.userLocation.lat,
          userLng: state.userLocation.lng,
        }),
      };
      const result = await fetchShops(API_BASE, params);

      // 요청 시점과 현재 bounds가 달라졌으면 결과 폐기
      const currentState = getState().shops;
      if (
        currentState.currentBounds !== snapshotBounds ||
        currentState.currentSort !== snapshotSort
      ) {
        dispatch(shopsSlice.actions.setLoadingMore(false));
        return;
      }

      dispatch(
        shopsSlice.actions.fetchMoreSuccess({
          shops: result.shops,
          total: result.total,
        }),
      );
    } catch {
      dispatch(shopsSlice.actions.setLoadingMore(false));
    }
  };

export default shopsSlice.reducer;
