"use client";

import {
  createAsyncThunk,
  createSelector,
  createSlice,
} from "@reduxjs/toolkit";
import type { ShopSummary } from "@/types";
import type { RootState } from "../store";

interface WishlistState {
  wishlistShops: ShopSummary[];
  loading: boolean;
  error: string | null;
  hasFetched: boolean;
}

const initialState: WishlistState = {
  wishlistShops: [],
  loading: false,
  error: null,
  hasFetched: false,
};

export const fetchWishlistAsync = createAsyncThunk(
  "wishlist/fetch",
  async (_, { rejectWithValue }) => {
    const res = await fetch("/api/wishlist");
    if (!res.ok) return rejectWithValue("Failed to fetch wishlist");
    const { shops } = await res.json();
    return (shops ?? []) as ShopSummary[];
  },
);

export const toggleWishlistAsync = createAsyncThunk(
  "wishlist/toggle",
  async (
    { shopId, shop }: { shopId: string; shop?: ShopSummary },
    { getState, rejectWithValue },
  ) => {
    const state = getState() as RootState;
    const isWishlisted = state.wishlist.wishlistShops.some(
      (s) => s.id === shopId,
    );

    if (isWishlisted) {
      const res = await fetch(`/api/wishlist/${shopId}`, { method: "DELETE" });
      if (!res.ok)
        return rejectWithValue({ shopId, action: "remove", failed: true });
      return { shopId, action: "remove" as const };
    } else {
      const res = await fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopId }),
      });
      if (!res.ok)
        return rejectWithValue({ shopId, action: "add", failed: true });
      return { shopId, action: "add" as const, shop };
    }
  },
);

export const removeFromWishlistAsync = createAsyncThunk(
  "wishlist/remove",
  async (shopId: string, { rejectWithValue }) => {
    const res = await fetch(`/api/wishlist/${shopId}`, { method: "DELETE" });
    if (!res.ok) return rejectWithValue(shopId);
    return shopId;
  },
);

const wishlistSlice = createSlice({
  name: "wishlist",
  initialState,
  reducers: {
    clearWishlist(state) {
      state.wishlistShops = [];
      state.hasFetched = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchWishlistAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchWishlistAsync.fulfilled, (state, action) => {
        state.loading = false;
        state.wishlistShops = action.payload;
        state.hasFetched = true;
      })
      .addCase(fetchWishlistAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        state.hasFetched = true;
      })
      // toggleWishlistAsync: 옵티미스틱 업데이트
      .addCase(toggleWishlistAsync.pending, (state, action) => {
        const { shopId, shop } = action.meta.arg;
        const exists = state.wishlistShops.some((s) => s.id === shopId);
        if (exists) {
          state.wishlistShops = state.wishlistShops.filter(
            (s) => s.id !== shopId,
          );
        } else if (shop) {
          state.wishlistShops = [shop, ...state.wishlistShops];
        }
      })
      .addCase(toggleWishlistAsync.rejected, (state) => {
        state.error = "위시리스트 변경에 실패했습니다.";
      })
      .addCase(removeFromWishlistAsync.fulfilled, (state, action) => {
        state.wishlistShops = state.wishlistShops.filter(
          (s) => s.id !== action.payload,
        );
      });
  },
});

export const { clearWishlist } = wishlistSlice.actions;

export const selectWishlistedSet = createSelector(
  (state: RootState) => state.wishlist.wishlistShops,
  (shops) => new Set(shops.map((s) => s.id)),
);

export default wishlistSlice.reducer;
