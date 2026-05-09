import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { getAuthHeaders } from "@/lib/supabase";
import type { RootState } from "../store";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

interface WishlistState {
  shopIds: string[];
  loading: boolean;
  hasFetched: boolean;
}

const initialState: WishlistState = {
  shopIds: [],
  loading: false,
  hasFetched: false,
};

export const fetchWishlistAsync = createAsyncThunk(
  "wishlist/fetch",
  async () => {
    const headers = await getAuthHeaders();
    if (!headers.Authorization) return [];
    const res = await fetch(`${API_BASE}/api/wishlist`, { headers });
    if (!res.ok) return [];
    const { shops } = await res.json();
    return ((shops ?? []) as { id: string }[]).map((s) => s.id);
  },
);

export const toggleWishAndPersistAsync = createAsyncThunk(
  "wishlist/toggleAndPersist",
  async (shopId: string, { getState, rejectWithValue }) => {
    const state = getState() as RootState;
    const isWished = state.wishlist.shopIds.includes(shopId);
    const headers = await getAuthHeaders();

    if (!headers.Authorization) {
      return rejectWithValue("Unauthorized");
    }

    if (isWished) {
      const res = await fetch(`${API_BASE}/api/wishlist/${shopId}`, {
        method: "DELETE",
        headers,
      });
      if (!res.ok) return rejectWithValue(`Failed to remove wish: ${res.status}`);
      return { shopId, action: "remove" as const };
    } else {
      const res = await fetch(`${API_BASE}/api/wishlist`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ shopId }),
      });
      if (!res.ok) return rejectWithValue(`Failed to add wish: ${res.status}`);
      return { shopId, action: "add" as const };
    }
  },
);

const wishlistSlice = createSlice({
  name: "wishlist",
  initialState,
  reducers: {
    clearWishlist(state) {
      state.shopIds = [];
      state.hasFetched = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchWishlistAsync.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchWishlistAsync.fulfilled, (state, action) => {
        state.shopIds = action.payload;
        state.loading = false;
        state.hasFetched = true;
      })
      .addCase(fetchWishlistAsync.rejected, (state) => {
        state.loading = false;
      })
      .addCase(toggleWishAndPersistAsync.fulfilled, (state, action) => {
        const { shopId, action: act } = action.payload;
        if (act === "remove") {
          state.shopIds = state.shopIds.filter((id) => id !== shopId);
        } else if (!state.shopIds.includes(shopId)) {
          state.shopIds.push(shopId);
        }
      });
  },
});

export const { clearWishlist } = wishlistSlice.actions;
export default wishlistSlice.reducer;
