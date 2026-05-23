import { createSlice, createAsyncThunk, createAction } from "@reduxjs/toolkit";
import { getAuthHeaders } from "@/lib/supabase";
import type { ShopSummary } from "@gacha-map/shared";

export const optimisticToggleWish = createAction<{
  shopId: string;
  wasWished: boolean;
}>("wishlist/optimisticToggle");

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
  pendingShopIds: string[];
  loading: boolean;
  hasFetched: boolean;
}

const initialState: WishlistState = {
  shopIds: [],
  shops: [],
  pendingShopIds: [],
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
      state.pendingShopIds = [];
      state.hasFetched = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(optimisticToggleWish, (state, action) => {
        const { shopId, wasWished } = action.payload;
        if (wasWished) {
          state.shopIds = state.shopIds.filter((id) => id !== shopId);
        } else {
          if (!state.shopIds.includes(shopId)) state.shopIds.push(shopId);
        }
      })
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
        const { shopId } = action.meta.arg;
        if (!state.pendingShopIds.includes(shopId)) {
          state.pendingShopIds.push(shopId);
        }
      })
      .addCase(toggleWishAndPersistAsync.rejected, (state, action) => {
        const { shopId, isWished } = action.meta.arg;
        state.pendingShopIds = state.pendingShopIds.filter(
          (id) => id !== shopId,
        );
        // 롤백: isWished는 API 호출 시점의 초기 서버 상태
        if (isWished) {
          // 해제 시도 실패 → 찜 상태로 복구
          if (!state.shopIds.includes(shopId)) {
            state.shopIds.push(shopId);
          }
        } else {
          // 추가 시도 실패 → 미찜 상태로 복구
          state.shopIds = state.shopIds.filter((id) => id !== shopId);
        }
      })
      .addCase(toggleWishAndPersistAsync.fulfilled, (state, action) => {
        state.pendingShopIds = state.pendingShopIds.filter(
          (id) => id !== action.payload.shopId,
        );
      });
  },
});

export const { clearWishlist } = wishlistSlice.actions;
export default wishlistSlice.reducer;
