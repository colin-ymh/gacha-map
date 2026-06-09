"use client";

import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { Shop } from "@/types";
import type { RootState } from "../store";

const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX = 50;

interface CacheEntry {
  data: Shop;
  cachedAt: number;
}

interface ShopCacheState {
  cache: Record<string, CacheEntry>;
  order: string[];
}

const initialState: ShopCacheState = {
  cache: {},
  order: [],
};

const shopCacheSlice = createSlice({
  name: "shopCache",
  initialState,
  reducers: {
    cacheShop(state, action: PayloadAction<{ id: string; data: Shop }>) {
      const { id, data } = action.payload;
      state.order = state.order.filter((oid) => oid !== id);
      state.order.unshift(id);
      while (state.order.length > CACHE_MAX) {
        const evictId = state.order.pop();
        if (evictId) delete state.cache[evictId];
      }
      state.cache[id] = { data, cachedAt: Date.now() };
    },
    invalidateShop(state, action: PayloadAction<string>) {
      const id = action.payload;
      delete state.cache[id];
      state.order = state.order.filter((oid) => oid !== id);
    },
  },
});

export const { cacheShop, invalidateShop } = shopCacheSlice.actions;

export const selectCachedShop = (
  state: RootState,
  shopId: string,
): Shop | null => {
  const entry = state.shopCache.cache[shopId];
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) return null;
  return entry.data;
};

export const selectCachedShopAny = (
  state: RootState,
  shopId: string,
): Shop | null => {
  return state.shopCache.cache[shopId]?.data ?? null;
};

export default shopCacheSlice.reducer;
