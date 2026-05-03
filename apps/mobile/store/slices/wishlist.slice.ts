import { createSlice } from "@reduxjs/toolkit";

interface WishlistState {
  shopIds: string[];
}

const initialState: WishlistState = {
  shopIds: [],
};

const wishlistSlice = createSlice({
  name: "wishlist",
  initialState,
  reducers: {
    toggleWish(state, action: { payload: string }) {
      const idx = state.shopIds.indexOf(action.payload);
      if (idx >= 0) {
        state.shopIds.splice(idx, 1);
      } else {
        state.shopIds.push(action.payload);
      }
    },
    setWishlist(state, action: { payload: string[] }) {
      state.shopIds = action.payload;
    },
  },
});

export const { toggleWish, setWishlist } = wishlistSlice.actions;
export default wishlistSlice.reducer;
