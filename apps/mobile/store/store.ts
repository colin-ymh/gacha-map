import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/auth.slice";
import shopsReducer from "./slices/shops.slice";
import wishlistReducer from "./slices/wishlist.slice";
import productWishlistReducer from "./slices/product-wishlist.slice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    shops: shopsReducer,
    wishlist: wishlistReducer,
    productWishlist: productWishlistReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
