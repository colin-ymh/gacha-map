import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { fetchShops } from "@gacha-map/shared";
import type { Bounds, ShopSummary, SortOption } from "@gacha-map/shared";
import {
  toggleWishAndPersistAsync,
  optimisticToggleWish,
} from "./wishlist.slice";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";
const CACHE_SIZE = 8;
const CACHE_TTL_MS = 5 * 60 * 1000;
const PAGE_LIMIT = 20;

interface BoundsCacheEntry {
  key: string;
  sort: SortOption | null;
  shops: ShopSummary[];
  total: number;
  timestamp: number;
}

type FetchMode = "map" | "search";
type LoadStatus = "idle" | "loading" | "success" | "error";
type LocationPermission = "unknown" | "granted" | "denied";

interface ShopsState {
  mode: FetchMode;

  mapShops: ShopSummary[];
  mapTotal: number;
  mapOffset: number;
  mapHasMore: boolean;
  currentBounds: Bounds | null;

  searchShops: ShopSummary[];
  searchTotal: number;
  searchOffset: number;
  searchHasMore: boolean;
  searchQuery: string;

  selectedShopId: string | null;
  sort: SortOption | null;
  userLocation: { lat: number; lng: number } | null;

  requestSeq: number;

  status: LoadStatus;
  loadingMore: boolean;
  error: string | null;

  locationPermission: LocationPermission;

  boundsCache: BoundsCacheEntry[];
}

const initialState: ShopsState = {
  mode: "map",
  mapShops: [],
  mapTotal: 0,
  mapOffset: 0,
  mapHasMore: false,
  currentBounds: null,
  searchShops: [],
  searchTotal: 0,
  searchOffset: 0,
  searchHasMore: false,
  searchQuery: "",
  selectedShopId: null,
  sort: "recommended",
  userLocation: null,
  requestSeq: 0,
  status: "idle",
  loadingMore: false,
  error: null,
  locationPermission: "unknown",
  boundsCache: [],
};

function boundsKey(bounds: Bounds): string {
  return [
    bounds.swLat.toFixed(6),
    bounds.swLng.toFixed(6),
    bounds.neLat.toFixed(6),
    bounds.neLng.toFixed(6),
  ].join("/");
}

function applyWishlistCountDelta(
  state: ShopsState,
  shopId: string,
  delta: 1 | -1,
) {
  const updateShop = (shop: ShopSummary) =>
    shop.id === shopId
      ? {
          ...shop,
          wishlist_count: Math.max(0, (shop.wishlist_count ?? 0) + delta),
        }
      : shop;

  state.mapShops = state.mapShops.map(updateShop);
  state.searchShops = state.searchShops.map(updateShop);
  state.boundsCache = state.boundsCache.map((entry) => ({
    ...entry,
    shops: entry.shops.map(updateShop),
  }));
}

const shopsSlice = createSlice({
  name: "shops",
  initialState,
  reducers: {
    startFetch(
      state,
      action: PayloadAction<{
        mode: FetchMode;
        bounds?: Bounds;
        query?: string;
        seq: number;
      }>,
    ) {
      const { mode, bounds, query, seq } = action.payload;
      state.mode = mode;
      state.requestSeq = seq;
      state.status = "loading";
      state.error = null;

      if (mode === "map" && bounds) {
        state.currentBounds = bounds;
      } else if (mode === "search" && query) {
        state.searchQuery = query;
        state.searchOffset = 0;
      }
    },

    fetchMapSuccess(
      state,
      action: PayloadAction<{
        shops: ShopSummary[];
        total: number;
        boundsKey: string;
        seq: number;
      }>,
    ) {
      const { shops, total, boundsKey, seq } = action.payload;
      if (state.requestSeq !== seq) return;

      state.status = "success";
      state.mapShops = shops;
      state.mapTotal = total;
      state.mapOffset = shops.length;
      state.mapHasMore = shops.length < total;

      const entry: BoundsCacheEntry = {
        key: boundsKey,
        sort: state.sort,
        shops,
        total,
        timestamp: Date.now(),
      };
      state.boundsCache = [
        entry,
        ...state.boundsCache.slice(0, CACHE_SIZE - 1),
      ];
    },

    fetchSearchSuccess(
      state,
      action: PayloadAction<{
        shops: ShopSummary[];
        total: number;
        seq: number;
      }>,
    ) {
      const { shops, total, seq } = action.payload;
      if (state.requestSeq !== seq) return;

      state.status = "success";
      state.searchShops = shops;
      state.searchTotal = total;
      state.searchOffset = shops.length;
      state.searchHasMore = shops.length < total;
    },

    fetchFromCache(
      state,
      action: PayloadAction<{
        shops: ShopSummary[];
        total: number;
        seq: number;
      }>,
    ) {
      const { shops, total, seq } = action.payload;
      if (state.requestSeq !== seq) return;

      state.status = "success";
      state.mapShops = shops;
      state.mapOffset = shops.length;
      state.mapTotal = total;
      state.mapHasMore = false;
    },

    fetchError(state, action: PayloadAction<string>) {
      state.status = "error";
      state.error = action.payload;
    },

    exitSearchMode(state) {
      state.mode = "map";
      state.searchQuery = "";
      state.searchShops = [];
      state.searchTotal = 0;
      state.searchOffset = 0;
      state.searchHasMore = false;
    },

    startLoadMore(state) {
      state.loadingMore = true;
    },

    loadMoreSuccess(
      state,
      action: PayloadAction<{
        shops: ShopSummary[];
        total: number;
        mode: FetchMode;
      }>,
    ) {
      const { shops, total, mode } = action.payload;
      state.loadingMore = false;

      if (mode === "map") {
        const existingIds = new Set(state.mapShops.map((s) => s.id));
        const newShops = shops.filter((s) => !existingIds.has(s.id));
        state.mapShops = [...state.mapShops, ...newShops];
        state.mapTotal = total;
        state.mapOffset = state.mapShops.length;
        state.mapHasMore = state.mapShops.length < total;
      } else {
        const existingIds = new Set(state.searchShops.map((s) => s.id));
        const newShops = shops.filter((s) => !existingIds.has(s.id));
        state.searchShops = [...state.searchShops, ...newShops];
        state.searchTotal = total;
        state.searchOffset = state.searchShops.length;
        state.searchHasMore = state.searchShops.length < total;
      }
    },

    cancelLoadMore(state) {
      state.loadingMore = false;
    },

    setSort(state, action: PayloadAction<SortOption | null>) {
      state.sort = action.payload;
    },

    setUserLocation(
      state,
      action: PayloadAction<{ lat: number; lng: number } | null>,
    ) {
      state.userLocation = action.payload;
    },

    setLocationPermission(state, action: PayloadAction<LocationPermission>) {
      state.locationPermission = action.payload;
    },

    setSelectedShop(state, action: PayloadAction<string | null>) {
      state.selectedShopId = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(optimisticToggleWish, (state, action) => {
        const { shopId, wasWished } = action.payload;
        applyWishlistCountDelta(state, shopId, wasWished ? -1 : 1);
      })
      .addCase(toggleWishAndPersistAsync.rejected, (state, action) => {
        const { shopId, isWished } = action.meta.arg;
        applyWishlistCountDelta(state, shopId, isWished ? 1 : -1);
      });
  },
});

export const {
  setUserLocation,
  setLocationPermission,
  setSelectedShop,
  setSort,
  exitSearchMode,
} = shopsSlice.actions;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ThunkDispatch = (action: any) => void;
type ThunkGetState = () => { shops: ShopsState };

export const fetchByBounds =
  (bounds: Bounds) =>
  async (dispatch: ThunkDispatch, getState: ThunkGetState) => {
    const { shops: state } = getState();

    // Don't fire a new request if one is already in flight (map mode only)
    if (state.status === "loading" && state.mode === "map") return;

    if (state.mode === "search") {
      dispatch(shopsSlice.actions.exitSearchMode());
    }

    const seq = state.requestSeq + 1;
    const key = boundsKey(bounds);

    dispatch(shopsSlice.actions.startFetch({ mode: "map", bounds, seq }));

    try {
      const { sort, userLocation, boundsCache } = state;

      // viewport bounds에 20% padding 적용 (가장자리 샵 누락 방지)
      const latPad = (bounds.neLat - bounds.swLat) * 0.2;
      const lngPad = (bounds.neLng - bounds.swLng) * 0.2;
      const fetchBounds: Bounds = {
        swLat: bounds.swLat - latPad,
        swLng: bounds.swLng - lngPad,
        neLat: bounds.neLat + latPad,
        neLng: bounds.neLng + lngPad,
      };
      const fetchKey = boundsKey(fetchBounds);

      const now = Date.now();
      const hit = boundsCache.find(
        (e) =>
          e.key === fetchKey &&
          e.sort === sort &&
          now - e.timestamp < CACHE_TTL_MS,
      );

      if (hit) {
        dispatch(
          shopsSlice.actions.fetchFromCache({
            shops: hit.shops,
            total: hit.total,
            seq,
          }),
        );
        return;
      }

      const result = await fetchShops(API_BASE, {
        bounds: fetchBounds,
        sort: sort ?? undefined,
        limit: PAGE_LIMIT,
        offset: 0,
        ...(userLocation && {
          userLat: userLocation.lat,
          userLng: userLocation.lng,
        }),
      });

      if (getState().shops.requestSeq !== seq) return;
      dispatch(
        shopsSlice.actions.fetchMapSuccess({
          shops: result.shops,
          total: result.total,
          boundsKey: fetchKey,
          seq,
        }),
      );
    } catch (e) {
      if (getState().shops.requestSeq !== seq) return;
      dispatch(shopsSlice.actions.fetchError((e as Error).message));
    }
  };

export const fetchBySearch =
  (query: string) =>
  async (dispatch: ThunkDispatch, getState: ThunkGetState) => {
    if (!query.trim()) {
      dispatch(shopsSlice.actions.exitSearchMode());
      return;
    }

    const state = getState().shops;
    const seq = state.requestSeq + 1;

    dispatch(shopsSlice.actions.startFetch({ mode: "search", query, seq }));

    try {
      const result = await fetchShops(API_BASE, {
        q: query.trim(),
        limit: PAGE_LIMIT,
        offset: 0,
      });

      if (getState().shops.requestSeq !== seq) return;
      dispatch(
        shopsSlice.actions.fetchSearchSuccess({
          shops: result.shops,
          total: result.total,
          seq,
        }),
      );
    } catch (e) {
      if (getState().shops.requestSeq !== seq) return;
      dispatch(shopsSlice.actions.fetchError((e as Error).message));
    }
  };

export const exitSearch = () => (dispatch: ThunkDispatch) => {
  dispatch(shopsSlice.actions.exitSearchMode());
};

export const loadMore =
  () => async (dispatch: ThunkDispatch, getState: ThunkGetState) => {
    const state = getState().shops;
    const isMap = state.mode === "map";
    const hasMore = isMap ? state.mapHasMore : state.searchHasMore;
    if (!hasMore || state.loadingMore || (isMap && !state.currentBounds)) {
      return;
    }

    const snapshotSeq = state.requestSeq;
    const snapshotMode = state.mode;

    dispatch(shopsSlice.actions.startLoadMore());

    try {
      const offset = isMap ? state.mapOffset : state.searchOffset;
      let params: Parameters<typeof fetchShops>[1];
      if (isMap) {
        const vb = state.currentBounds!;
        const latPad = (vb.neLat - vb.swLat) * 0.2;
        const lngPad = (vb.neLng - vb.swLng) * 0.2;
        const paddedBounds: Bounds = {
          swLat: vb.swLat - latPad,
          swLng: vb.swLng - lngPad,
          neLat: vb.neLat + latPad,
          neLng: vb.neLng + lngPad,
        };
        params = {
          bounds: paddedBounds,
          sort: state.sort ?? undefined,
          limit: PAGE_LIMIT,
          offset,
          ...(state.userLocation && {
            userLat: state.userLocation.lat,
            userLng: state.userLocation.lng,
          }),
        };
      } else {
        params = { q: state.searchQuery.trim(), limit: PAGE_LIMIT, offset };
      }

      const result = await fetchShops(API_BASE, params);

      const current = getState().shops;
      if (current.requestSeq !== snapshotSeq || current.mode !== snapshotMode) {
        dispatch(shopsSlice.actions.cancelLoadMore());
        return;
      }

      dispatch(
        shopsSlice.actions.loadMoreSuccess({
          shops: result.shops,
          total: result.total,
          mode: snapshotMode,
        }),
      );
    } catch {
      dispatch(shopsSlice.actions.cancelLoadMore());
    }
  };

export const refetchCurrentMode =
  () => (dispatch: ThunkDispatch, getState: ThunkGetState) => {
    const { shops: state } = getState();
    if (state.mode === "map") {
      if (state.currentBounds) {
        dispatch(fetchByBounds(state.currentBounds));
      }
    } else {
      dispatch(fetchBySearch(state.searchQuery));
    }
  };

export default shopsSlice.reducer;

export const selectDisplayShops = (state: { shops: ShopsState }) =>
  state.shops.mode === "search"
    ? state.shops.searchShops
    : state.shops.mapShops;
