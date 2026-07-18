"use client";

import {
  createAsyncThunk,
  createSelector,
  createSlice,
} from "@reduxjs/toolkit";
import type { GachaProduct } from "@gacha-map/shared";
import type { RootState } from "../store";

export type WishlistedProduct = GachaProduct & { available_shop_count: number };

interface ProductWishlistState {
  wishlistedProducts: WishlistedProduct[];
  loading: boolean;
  error: string | null;
  hasFetched: boolean;
  pendingToggleCount: number;
}

const initialState: ProductWishlistState = {
  wishlistedProducts: [],
  loading: false,
  error: null,
  hasFetched: false,
  pendingToggleCount: 0,
};

export const fetchProductWishlistAsync = createAsyncThunk(
  "productWishlist/fetch",
  async (_, { rejectWithValue }) => {
    const res = await fetch("/api/product-wishlist");
    if (!res.ok) return rejectWithValue("Failed to fetch product wishlist");
    const { products } = await res.json();
    return (products ?? []) as WishlistedProduct[];
  },
);

export const toggleProductWishlistAsync = createAsyncThunk(
  "productWishlist/toggle",
  async (
    { productId, product }: { productId: string; product?: WishlistedProduct },
    { getState, rejectWithValue },
  ) => {
    const state = getState() as RootState;
    const isWishlisted = state.productWishlist.wishlistedProducts.some(
      (p) => p.id === productId,
    );

    if (isWishlisted) {
      const res = await fetch(`/api/product-wishlist/${productId}`, {
        method: "DELETE",
      });
      if (!res.ok)
        return rejectWithValue({ productId, action: "remove", failed: true });
      return { productId, action: "remove" as const };
    } else {
      const res = await fetch("/api/product-wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      if (!res.ok)
        return rejectWithValue({ productId, action: "add", failed: true });
      return { productId, action: "add" as const, product };
    }
  },
);

const productWishlistSlice = createSlice({
  name: "productWishlist",
  initialState,
  reducers: {
    clearProductWishlist(state) {
      state.wishlistedProducts = [];
      state.hasFetched = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProductWishlistAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProductWishlistAsync.fulfilled, (state, action) => {
        state.loading = false;
        state.hasFetched = true;
        if (state.pendingToggleCount === 0) {
          state.wishlistedProducts = action.payload;
        }
      })
      .addCase(fetchProductWishlistAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        state.hasFetched = true;
      })
      .addCase(toggleProductWishlistAsync.pending, (state, action) => {
        state.pendingToggleCount++;
        const { productId, product } = action.meta.arg;
        const exists = state.wishlistedProducts.some((p) => p.id === productId);
        if (exists) {
          state.wishlistedProducts = state.wishlistedProducts.filter(
            (p) => p.id !== productId,
          );
        } else if (product) {
          state.wishlistedProducts = [product, ...state.wishlistedProducts];
        }
      })
      .addCase(toggleProductWishlistAsync.fulfilled, (state) => {
        state.pendingToggleCount = Math.max(0, state.pendingToggleCount - 1);
      })
      .addCase(toggleProductWishlistAsync.rejected, (state, action) => {
        state.pendingToggleCount = Math.max(0, state.pendingToggleCount - 1);
        state.error = "찜 변경에 실패했습니다.";
        const payload = action.payload as
          | { productId: string; action: "add" | "remove"; failed: boolean }
          | undefined;
        if (!payload?.failed) return;
        if (payload.action === "remove") {
          const product = action.meta.arg.product;
          if (
            product &&
            !state.wishlistedProducts.some((p) => p.id === payload.productId)
          ) {
            state.wishlistedProducts = [product, ...state.wishlistedProducts];
          }
        } else {
          state.wishlistedProducts = state.wishlistedProducts.filter(
            (p) => p.id !== payload.productId,
          );
        }
      });
  },
});

export const { clearProductWishlist } = productWishlistSlice.actions;

export const selectProductWishlistedSet = createSelector(
  (state: RootState) => state.productWishlist.wishlistedProducts,
  (products) => new Set(products.map((p) => p.id)),
);

export default productWishlistSlice.reducer;
