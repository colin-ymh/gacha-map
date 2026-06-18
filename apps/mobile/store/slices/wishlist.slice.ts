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

    if (!headers.Authorization) {
      return rejectWithValue("Unauthorized");
    }

    if (isWished) {
      const res = await fetch(`${API_BASE}/api/wishlist/${shopId}`, {
        method: "DELETE",
        headers,
      });
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
      if (!res.ok)
        return rejectWithValue(
          await rejectWithResponseStatus(res, "Failed to add wish"),
        );
      const data = await res.json().catch(() => ({}));
      return {
        shopId,
        action: "add" as const,
        newBadge:
          (data.new_badge as {
            id: string;
            name: string;
            icon_url: string;
          } | null) ?? null,
      };
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
          // shops 목록은 건드리지 않음 — 새로고침 전까지 카드 유지
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
