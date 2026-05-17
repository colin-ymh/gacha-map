import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { getAuthHeaders } from "@/lib/supabase";
import type { ShopSummary } from "@gacha-map/shared";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

async function rejectWithResponseStatus(
  res: Response,
  fallbackMessage: string,
) {
  const body = await res.json().catch(() => null);
  console.log("[wish] error body:", body);
  return `${fallbackMessage}: ${res.status}`;
}

interface WishlistState {
  shopIds: string[];
  shops: ShopSummary[];
  loading: boolean;
  hasFetched: boolean;
}

const initialState: WishlistState = {
  shopIds: [],
  shops: [],
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
    return (shops ?? []) as ShopSummary[];
  },
);

export const toggleWishAndPersistAsync = createAsyncThunk(
  "wishlist/toggleAndPersist",
  async (
    { shopId, isWished }: { shopId: string; isWished: boolean },
    { rejectWithValue },
  ) => {
    const headers = await getAuthHeaders();
    console.log(
      "[wish] shopId:",
      shopId,
      "isWished:",
      isWished,
      "hasAuth:",
      !!headers.Authorization,
      "apiBase:",
      API_BASE,
    );

    if (!headers.Authorization) {
      console.log("[wish] Unauthorized - no auth header");
      return rejectWithValue("Unauthorized");
    }

    if (isWished) {
      const res = await fetch(`${API_BASE}/api/wishlist/${shopId}`, {
        method: "DELETE",
        headers,
      });
      console.log("[wish] DELETE status:", res.status);
      if (!res.ok)
        return rejectWithValue(
          await rejectWithResponseStatus(res, "Failed to remove wish"),
        );
      return { shopId, action: "remove" as const };
    } else {
      const res = await fetch(`${API_BASE}/api/wishlist`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ shopId }),
      });
      console.log("[wish] POST status:", res.status);
      if (!res.ok)
        return rejectWithValue(
          await rejectWithResponseStatus(res, "Failed to add wish"),
        );
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
      state.shops = [];
      state.hasFetched = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchWishlistAsync.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchWishlistAsync.fulfilled, (state, action) => {
        state.shops = action.payload;
        state.shopIds = action.payload.map((shop) => shop.id);
        state.loading = false;
        state.hasFetched = true;
      })
      .addCase(fetchWishlistAsync.rejected, (state) => {
        state.loading = false;
      })
      .addCase(toggleWishAndPersistAsync.pending, (state, action) => {
        const shopId = action.meta.arg.shopId;
        if (state.shopIds.includes(shopId)) {
          state.shopIds = state.shopIds.filter((id) => id !== shopId);
          state.shops = state.shops.filter((shop) => shop.id !== shopId);
        } else {
          state.shopIds.push(shopId);
        }
      })
      .addCase(toggleWishAndPersistAsync.rejected, (state, action) => {
        // 낙관적 업데이트 롤백
        const shopId = action.meta.arg.shopId;
        if (state.shopIds.includes(shopId)) {
          state.shopIds = state.shopIds.filter((id) => id !== shopId);
          state.shops = state.shops.filter((shop) => shop.id !== shopId);
        } else {
          state.shopIds.push(shopId);
        }
      })
      .addCase(toggleWishAndPersistAsync.fulfilled, (state, action) => {
        const { shopId, action: act } = action.payload;
        if (act === "remove") {
          state.shopIds = state.shopIds.filter((id) => id !== shopId);
          state.shops = state.shops.filter((shop) => shop.id !== shopId);
        } else if (!state.shopIds.includes(shopId)) {
          state.shopIds.push(shopId);
        }
      });
  },
});

export const { clearWishlist } = wishlistSlice.actions;
export default wishlistSlice.reducer;
