import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { fetchShops } from "@gacha-map/shared";
import type { ShopSummary, Bounds } from "@gacha-map/shared";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

interface ShopsState {
  shops: ShopSummary[];
  loading: boolean;
  error: string | null;
}

const initialState: ShopsState = {
  shops: [],
  loading: false,
  error: null,
};

export const fetchShopsByBoundsAsync = createAsyncThunk(
  "shops/fetchByBounds",
  async (bounds: Bounds, { rejectWithValue }) => {
    try {
      const result = await fetchShops(API_BASE, { bounds });
      return result.shops;
    } catch (e) {
      return rejectWithValue((e as Error).message);
    }
  },
);

const shopsSlice = createSlice({
  name: "shops",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchShopsByBoundsAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchShopsByBoundsAsync.fulfilled, (state, action) => {
        state.loading = false;
        state.shops = action.payload;
      })
      .addCase(fetchShopsByBoundsAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export default shopsSlice.reducer;
