import { createSlice, createAsyncThunk, createAction } from "@reduxjs/toolkit";
import { getAuthHeaders } from "@/lib/supabase";
import type { GachaProduct } from "@gacha-map/shared";

export type WishlistedProduct = GachaProduct & { available_shop_count: number };

export const optimisticToggleProductWish = createAction<{
  productId: string;
  wasWished: boolean;
}>("productWishlist/optimisticToggle");

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

interface ProductWishlistState {
  productIds: string[];
  products: WishlistedProduct[];
  pendingProductIds: string[];
  loading: boolean;
  hasFetched: boolean;
  isDirty: boolean;
}

const initialState: ProductWishlistState = {
  productIds: [],
  products: [],
  pendingProductIds: [],
  loading: false,
  hasFetched: false,
  isDirty: false,
};

export const fetchProductWishlistAsync = createAsyncThunk(
  "productWishlist/fetch",
  async () => {
    const headers = await getAuthHeaders();
    if (!headers.Authorization) return [];
    const res = await fetch(`${API_BASE}/api/product-wishlist`, { headers });
    if (!res.ok) return [];
    const { products } = await res.json();
    return (products ?? []) as WishlistedProduct[];
  },
);

export const toggleProductWishAndPersistAsync = createAsyncThunk(
  "productWishlist/toggleAndPersist",
  async (
    { productId, isWished }: { productId: string; isWished: boolean },
    { rejectWithValue },
  ) => {
    const headers = await getAuthHeaders();

    if (!headers.Authorization) {
      return rejectWithValue("Unauthorized");
    }

    if (isWished) {
      const res = await fetch(`${API_BASE}/api/product-wishlist/${productId}`, {
        method: "DELETE",
        headers,
      });
      if (!res.ok)
        return rejectWithValue(`Failed to remove wish: ${res.status}`);
      return { productId, action: "remove" as const };
    } else {
      const res = await fetch(`${API_BASE}/api/product-wishlist`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      if (!res.ok) return rejectWithValue(`Failed to add wish: ${res.status}`);
      return { productId, action: "add" as const };
    }
  },
);

const productWishlistSlice = createSlice({
  name: "productWishlist",
  initialState,
  reducers: {
    clearProductWishlist(state) {
      state.productIds = [];
      state.products = [];
      state.pendingProductIds = [];
      state.hasFetched = false;
      state.isDirty = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(optimisticToggleProductWish, (state, action) => {
        const { productId, wasWished } = action.payload;
        if (wasWished) {
          state.productIds = state.productIds.filter((id) => id !== productId);
        } else {
          if (!state.productIds.includes(productId))
            state.productIds.push(productId);
        }
        state.isDirty = true;
      })
      .addCase(fetchProductWishlistAsync.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchProductWishlistAsync.fulfilled, (state, action) => {
        state.products = action.payload;
        state.productIds = action.payload.map((p) => p.id);
        state.loading = false;
        state.hasFetched = true;
        state.isDirty = false;
      })
      .addCase(fetchProductWishlistAsync.rejected, (state) => {
        state.loading = false;
      })
      .addCase(toggleProductWishAndPersistAsync.pending, (state, action) => {
        const { productId } = action.meta.arg;
        if (!state.pendingProductIds.includes(productId)) {
          state.pendingProductIds.push(productId);
        }
      })
      .addCase(toggleProductWishAndPersistAsync.rejected, (state, action) => {
        const { productId, isWished } = action.meta.arg;
        state.pendingProductIds = state.pendingProductIds.filter(
          (id) => id !== productId,
        );
        if (isWished) {
          if (!state.productIds.includes(productId))
            state.productIds.push(productId);
        } else {
          state.productIds = state.productIds.filter((id) => id !== productId);
        }
      })
      .addCase(toggleProductWishAndPersistAsync.fulfilled, (state, action) => {
        state.pendingProductIds = state.pendingProductIds.filter(
          (id) => id !== action.payload.productId,
        );
      });
  },
});

export const { clearProductWishlist } = productWishlistSlice.actions;
export default productWishlistSlice.reducer;
